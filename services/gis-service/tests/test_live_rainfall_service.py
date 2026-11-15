"""LiveRainfallService / LiveWeatherRepository. Service logic uses a fake repo and a fake clock (no sleeps, no
network); the repository and advisory lock are exercised against the throwaway DB when reachable."""
import json
import random
import threading
from datetime import timedelta

import pytest
import requests

from app.pipeline import live_rainfall as lr
from app.pipeline.live_rainfall import (LiveRainfallService, LiveWeatherRepository, normalize_weather,
                                        RETRY_AFTER_ERROR_SECONDS)
from pipeline_fakes import FakeResponse, Recorder, db, db_url, dt, needs_db  # noqa: F401

NOW = dt(2026, 11, 5, 8, 25)
KEY = "21.8450,104.0850"  # has ready static GRU features in app/config
LOC = {"key": KEY, "name": "Khau Pha", "latitude": 21.845, "longitude": 104.085}


class Clock:
    def __init__(self, now=NOW):
        self.now = now

    def __call__(self):
        return self.now

    def advance(self, **kw):
        self.now += timedelta(**kw)


@pytest.fixture
def clock(monkeypatch):
    c = Clock()
    monkeypatch.setattr(lr, "utc_now", c)
    return c


@pytest.fixture(autouse=True)
def env(monkeypatch):
    for k in ("RAINFALL_REFRESH_SECONDS", "RAINFALL_AUTO_ENABLED", "OPEN_METEO_API_KEY", "LIVE_GRU_ENABLED",
              "AI_SERVICE_URL"):
        monkeypatch.delenv(k, raising=False)


def raw_weather(now=NOW, value=1.0, **over):
    end = now.replace(minute=0, second=0, microsecond=0)
    raw = {"utc_offset_seconds": 0, "hourly_units": {"precipitation": "mm"}, "latitude": 21.8, "longitude": 104.1,
           "elevation": 1200, "hourly": {"time": [(end + timedelta(hours=h)).isoformat() for h in range(-167, 25)],
                                         "precipitation": [value] * 192}}
    raw.update(over)
    return raw


def payload(now=NOW, **kw):
    return normalize_weather(raw_weather(now, **kw), now)


class FakeConn:
    def __init__(self, got_lock=True):
        self.got_lock, self.closed, self.autocommit = got_lock, False, False
        self.sql = []

    def cursor(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=None):
        self.sql.append((sql, params))

    def fetchone(self):
        return (self.got_lock,)

    def close(self):
        self.closed = True


class FakeRepo:
    def __init__(self, got_lock=True):
        self.cache, self.saves, self.preds, self.conn = {}, [], [], FakeConn(got_lock)
        self.schema_calls = 0
        self.rows, self.hist = [], []

    def ensure_schema(self):
        self.schema_calls += 1

    def connect(self):
        return self.conn

    def get(self, key):
        return self.cache.get(key)

    def save(self, location, payload=None, error=None):
        self.saves.append((location["key"], payload, error))

    def save_prediction(self, key, as_of, pred):
        self.preds.append((key, as_of, pred))

    def map_rows(self):
        return self.rows

    def history(self, key, since):
        self.hist.append((key, since))
        return []


@pytest.fixture
def svc(monkeypatch, clock):
    s = LiveRainfallService()
    s.repo = FakeRepo()
    s.locations = lambda: [LOC]
    s.fetch_calls = 0

    def fetch(location):
        s.fetch_calls += 1
        return payload(clock.now)
    s.fetch = fetch
    monkeypatch.setenv("LIVE_GRU_ENABLED", "false")
    return s


def cached(clock, age_s, error=None, pl=None):
    return {"location_key": KEY, "last_attempt_at": clock.now - timedelta(seconds=age_s), "last_error": error,
            "payload": pl}


# ---------- config ----------
@pytest.mark.parametrize("env_val,expected", [(None, 3600), ("10", 900), ("899", 900), ("900", 900), ("901", 901),
                                              ("7200", 7200)])
def test_interval_clamped_to_minimum(monkeypatch, env_val, expected):
    if env_val is not None:
        monkeypatch.setenv("RAINFALL_REFRESH_SECONDS", env_val)
    s = LiveRainfallService()
    assert s.interval == expected and s.state["interval_seconds"] == expected


def test_invalid_interval_env_raises(monkeypatch):
    monkeypatch.setenv("RAINFALL_REFRESH_SECONDS", "abc")
    with pytest.raises(ValueError):
        LiveRainfallService()


@pytest.mark.parametrize("v,enabled", [("true", True), ("TRUE", True), ("false", False), ("0", False)])
def test_enabled_flag(monkeypatch, v, enabled):
    monkeypatch.setenv("RAINFALL_AUTO_ENABLED", v)
    assert LiveRainfallService().enabled is enabled


# ---------- locations ----------
def test_locations_skip_invalid_and_dedupe(monkeypatch):
    units = [{"unit_id": "U1", "unit_name": None, "latitude": 21.84500004, "longitude": 104.085},  # dup of config key
             {"unit_id": "U2", "unit_name": "Two", "latitude": None, "longitude": 1.0},
             {"unit_id": "U3", "unit_name": "Three", "latitude": 95.0, "longitude": 1.0},
             {"unit_id": "U4", "unit_name": "Four", "latitude": float("nan"), "longitude": 1.0},
             {"unit_id": "U5", "unit_name": "Five", "latitude": "3.5", "longitude": "4.25"}]
    monkeypatch.setattr(lr.RainfallRepository, "get_assessment_units", lambda self: units)
    keys = {x["key"]: x for x in LiveRainfallService().locations()}
    assert KEY in keys and "3.5000,4.2500" in keys
    assert keys["3.5000,4.2500"]["name"] == "Five" and keys["3.5000,4.2500"]["latitude"] == 3.5
    assert not any(k.startswith(("95", "nan")) for k in keys)
    assert keys[KEY]["name"] == "U1"  # later duplicate overrides the config entry; name falls back to unit_id
    assert "U2" not in {x["name"] for x in keys.values()}


@pytest.mark.parametrize("lat,lon,ok", [(90, 180, True), (-90, -180, True), (90.0001, 0, False), (0, 180.0001, False),
                                        (float("inf"), 0, False), (0, float("nan"), False)])
def test_location_key_bounds(lat, lon, ok):
    if ok:
        assert lr.location_key(lat, lon) == f"{lat:.4f},{lon:.4f}"
    else:
        with pytest.raises(ValueError):
            lr.location_key(lat, lon)


# ---------- fetch ----------
def test_fetch_request_without_key(monkeypatch, clock):
    rec = Recorder(FakeResponse(raw_weather(clock.now)))
    monkeypatch.setattr(lr.requests, "get", rec)
    out = LiveRainfallService().fetch(LOC)
    c = rec.calls[0]
    assert c["url"] == "https://api.open-meteo.com/v1/forecast" and c["timeout"] == (5, 20)
    assert c["params"] == {"latitude": 21.845, "longitude": 104.085, "hourly": lr.HOURLY_VARIABLES,
                           "timezone": "UTC", "past_days": 8, "forecast_days": 8}
    assert out["fetched_at"] == clock.now.isoformat() and out["source_kind"] == "WEATHER_MODEL_ESTIMATE"


def test_fetch_with_api_key_uses_customer_endpoint(monkeypatch, clock):
    monkeypatch.setenv("OPEN_METEO_API_KEY", "  secret  ")
    rec = Recorder(FakeResponse(raw_weather(clock.now)))
    monkeypatch.setattr(lr.requests, "get", rec)
    LiveRainfallService().fetch(LOC)
    assert rec.calls[0]["url"] == "https://customer-api.open-meteo.com/v1/forecast"
    assert rec.calls[0]["params"]["apikey"] == "secret"


@pytest.mark.parametrize("outcome", [FakeResponse({}, status=503), requests.exceptions.Timeout("t"),
                                     requests.exceptions.ConnectionError("c"),
                                     FakeResponse(json_error=ValueError("bad"))])
def test_fetch_outage_raises(monkeypatch, outcome):
    monkeypatch.setattr(lr.requests, "get", Recorder(outcome))
    with pytest.raises(Exception):
        LiveRainfallService().fetch(LOC)


@pytest.mark.parametrize("mutate", [
    lambda r: r.update(hourly_units={"precipitation": "inch"}),
    lambda r: r.update(utc_offset_seconds=25200),
    lambda r: r["hourly"].update(precipitation=r["hourly"]["precipitation"][:-1]),
    lambda r: r["hourly"].update(time=[], precipitation=[]),
    lambda r: r["hourly"].update(precipitation=[None] * 192),
    lambda r: r["hourly"]["time"].__setitem__(1, r["hourly"]["time"][0]),
    lambda r: r["hourly"]["time"].__setitem__(0, "2026-10-29T01:30"),
])
def test_normalize_rejects_bad_payloads(mutate):
    raw = raw_weather()
    mutate(raw)
    with pytest.raises(ValueError):
        normalize_weather(raw, NOW)


def test_normalize_null_negative_nan_stay_missing_never_zero():
    raw = raw_weather()
    p = raw["hourly"]["precipitation"]
    end = NOW.replace(minute=0)
    p[-1 - 24] = None       # last past hour
    p[0] = -1.0
    p[1] = float("nan")
    data = normalize_weather(raw, NOW)
    assert data["history"]["1"]["mm"] is None and data["history"]["1"]["valid_hours"] == 0
    assert data["history"]["24"]["mm"] is None and data["history"]["24"]["valid_hours"] == 23
    assert data["history"]["168"]["valid_hours"] == 165 and data["quality"] == "partial"
    hourly = {h["interval_end"]: h["mm"] for h in data["hourly"]}
    assert hourly[end.isoformat()] is None


def test_weather_summary_failure_does_not_block_rain():
    data = normalize_weather(raw_weather(), NOW)  # no temperature etc.
    assert data["weather"] is None and data["history"]["24"]["mm"] == 24.0


# ---------- run_once: caching and retry timing ----------
def test_no_cache_fetches_and_saves(svc, clock):
    svc.run_once()
    (key, pl, err), = svc.repo.saves
    assert key == KEY and err is None and pl["gru_inference"]["reason"] == "DISABLED" and "rain_anomaly" in pl
    assert svc.repo.schema_calls == 1 and svc.repo.conn.closed and svc.state["running"] is False
    assert svc.state["locations"] == 1 and svc.state["last_cycle_at"] == clock.now.isoformat()


@pytest.mark.parametrize("age,expect_fetch", [(0, False), (3599, False), (3600, True), (7200, True)])
def test_cache_hit_within_refresh_interval(svc, clock, age, expect_fetch):
    svc.repo.cache[KEY] = cached(clock, age, pl=payload(clock.now))
    svc.run_once()
    assert svc.fetch_calls == (1 if expect_fetch else 0)


@pytest.mark.parametrize("age,expect_fetch", [(299, False), (300, True), (301, True)])
def test_retry_after_error_is_five_minutes_not_full_interval(svc, clock, age, expect_fetch):
    assert RETRY_AFTER_ERROR_SECONDS == 300
    svc.repo.cache[KEY] = cached(clock, age, error="ConnectionError")
    svc.run_once()
    assert svc.fetch_calls == (1 if expect_fetch else 0)


def test_interval_clamp_drives_cache_expiry(svc, clock, monkeypatch):
    monkeypatch.setenv("RAINFALL_REFRESH_SECONDS", "10")
    s = LiveRainfallService()
    s.repo, s.locations, s.fetch = svc.repo, svc.locations, svc.fetch
    svc.repo.cache[KEY] = cached(clock, 899, pl=payload(clock.now))
    s.run_once()
    assert svc.fetch_calls == 0  # clamped to 900, so 899s old is still fresh
    svc.repo.cache[KEY] = cached(clock, 900, pl=payload(clock.now))
    s.run_once()
    assert svc.fetch_calls == 1


def test_failure_saves_safe_error_and_no_payload(svc, clock):
    class Boom(Exception):
        response = type("R", (), {"status_code": 503})()

    def fetch(loc):
        raise Boom("https://x/?apikey=SECRET")
    svc.fetch = fetch
    svc.run_once()
    assert svc.repo.saves == [(KEY, None, "Boom HTTP 503")]  # no fabricated payload, no secret in text


def test_failure_without_status(svc):
    svc.fetch = lambda loc: (_ for _ in ()).throw(requests.exceptions.Timeout("SECRET"))
    svc.run_once()
    assert svc.repo.saves == [(KEY, None, "Timeout")]


def test_malformed_provider_payload_recorded_as_error(svc, monkeypatch):
    del svc.fetch
    monkeypatch.setattr(lr.requests, "get", Recorder(FakeResponse({"hourly": {"time": [], "precipitation": []},
                                                                  "utc_offset_seconds": 0,
                                                                  "hourly_units": {"precipitation": "mm"}})))
    svc.run_once()
    assert svc.repo.saves == [(KEY, None, "ValueError")]


def test_other_instance_holds_lock_means_no_work(svc):
    svc.repo = FakeRepo(got_lock=False)
    svc.run_once()
    assert svc.fetch_calls == 0 and svc.repo.saves == [] and svc.repo.conn.closed and svc.state["running"] is False


def test_stop_event_breaks_location_loop(svc):
    svc.locations = lambda: [LOC, dict(LOC, key="1.0000,2.0000")]
    svc.stop_event.set()
    svc.run_once()
    assert svc.fetch_calls == 0 and svc.repo.conn.closed


def test_connection_closed_when_locations_fail(svc):
    def bad():
        raise RuntimeError("db gone")
    svc.locations = bad
    with pytest.raises(RuntimeError):
        svc.run_once()
    assert svc.repo.conn.closed and svc.state["running"] is False


def test_prediction_retry_on_cached_payload_respects_five_minute_gap(svc, clock, monkeypatch):
    monkeypatch.setenv("LIVE_GRU_ENABLED", "true")
    pl = payload(clock.now)
    pl["gru_inference"] = {"ready": False, "attempted_at": (clock.now - timedelta(seconds=299)).isoformat()}
    svc.repo.cache[KEY] = cached(clock, 60, pl=pl)
    svc.predict = lambda loc, d: {"ready": False, "reason": "X"}
    svc.run_once()
    assert svc.repo.preds == []
    clock.advance(seconds=1)
    svc.repo.cache[KEY] = cached(clock, 60, pl=pl)
    svc.run_once()
    assert svc.repo.preds == [(KEY, pl["as_of"], {"ready": False, "reason": "X"})] and svc.fetch_calls == 0
    pl["gru_inference"] = {"ready": True}
    svc.repo.preds.clear()
    svc.run_once()
    assert svc.repo.preds == []  # ready results are not recomputed
    pl2 = dict(pl, gru_inference={})  # never attempted
    svc.repo.cache[KEY] = cached(clock, 60, pl=pl2)
    svc.run_once()
    assert len(svc.repo.preds) == 1


# ---------- predict ----------
def gru_ok(pl, **over):
    r = {"unit_id": "UTM48N_1km_405000_2415000", "issue_time": pl["as_of"], "temporal_score": 0.4,
         "spatial_score": 0.5, "hazard_score": 0.45, "model_id": "m"}
    r.update(over)
    return r


@pytest.fixture
def post(monkeypatch):
    rec = Recorder(FakeResponse({}))
    monkeypatch.setattr(lr.requests, "post", rec)
    return rec


def test_predict_success_request_and_result(clock, post, monkeypatch):
    monkeypatch.setenv("AI_SERVICE_URL", "http://ai:1/")
    pl = payload(clock.now)
    post.outcomes = [FakeResponse(gru_ok(pl))]
    out = LiveRainfallService().predict(LOC, pl)
    assert out["ready"] is True and out["hazard_score"] == 0.45 and out["experimental"] is True
    assert {"static_values", "static_coverage", "static_source_sha256", "grid_version"} <= set(out)
    c = post.calls[0]
    assert c["url"] == "http://ai:1/api/v1/inference/gru/live" and c["timeout"] == (3, 15)
    assert len(c["json"]["history"]) == 168 and c["json"]["forecast_24h_mm"] == 24.0
    assert c["json"]["weather_source"] == "OPEN_METEO" and c["json"]["issue_time"] == pl["as_of"]


def test_predict_disabled_does_not_call(clock, post, monkeypatch):
    monkeypatch.setenv("LIVE_GRU_ENABLED", "false")
    assert LiveRainfallService().predict(LOC, payload(clock.now))["reason"] == "DISABLED"
    assert post.calls == []


@pytest.mark.parametrize("age_s,reason", [(0, None), (5400, None), (5401, "WEATHER_STALE")])
def test_predict_staleness_boundary(clock, post, age_s, reason):
    pl = payload(clock.now)
    post.outcomes = [FakeResponse(gru_ok(pl))]
    clock.now = dt(2026, 11, 5, 8, 0) + timedelta(seconds=age_s)
    out = LiveRainfallService().predict(LOC, pl)
    assert (out.get("reason") if not out["ready"] else None) == reason


def test_predict_future_asof_and_naive_asof_are_stale(clock, post):
    pl = payload(clock.now)
    clock.now = dt(2026, 11, 5, 7, 59)
    assert LiveRainfallService().predict(LOC, pl)["reason"] == "WEATHER_STALE"
    clock.now = NOW
    assert LiveRainfallService().predict(LOC, dict(pl, as_of="2026-11-05T08:00:00"))["reason"] == "WEATHER_STALE"
    assert post.calls == []


def test_predict_unknown_location_has_no_static_features(clock, post):
    out = LiveRainfallService().predict(dict(LOC, key="0.0000,0.0000"), payload(clock.now))
    assert out["reason"] == "STATIC_FEATURES_UNAVAILABLE" and out["ready"] is False and post.calls == []


def test_predict_missing_hour_is_incomplete_not_zero_filled(clock, post):
    raw = raw_weather(clock.now)
    raw["hourly"]["precipitation"][100] = None
    out = LiveRainfallService().predict(LOC, normalize_weather(raw, clock.now))
    assert out["reason"] == "INCOMPLETE_WEATHER" and post.calls == []


def test_predict_missing_forecast_hour_is_incomplete(clock, post):
    raw = raw_weather(clock.now)
    raw["hourly"]["precipitation"][-3] = None
    assert LiveRainfallService().predict(LOC, normalize_weather(raw, clock.now))["reason"] == "INCOMPLETE_WEATHER"


@pytest.mark.parametrize("bad", [
    {"hazard_score": 1.5}, {"hazard_score": -0.1}, {"temporal_score": float("nan")},
    {"unit_id": "OTHER"}, {"issue_time": "2020-01-01T00:00:00+00:00"},
])
def test_predict_invalid_model_result_is_held(clock, post, bad):
    pl = payload(clock.now)
    post.outcomes = [FakeResponse(gru_ok(pl, **bad))]
    out = LiveRainfallService().predict(LOC, pl)
    assert out["ready"] is False and out["reason"] == "MODEL_UNAVAILABLE_OR_INVALID_INPUT" and "hazard_score" not in out


@pytest.mark.parametrize("outcome", [FakeResponse({}, status=500), requests.exceptions.Timeout("t"),
                                     requests.exceptions.ConnectionError("c"), FakeResponse({"x": 1}),
                                     FakeResponse(json_error=ValueError("j"))])
def test_predict_ai_outage_is_held_never_fabricated(clock, post, outcome):
    post.outcomes = [outcome]
    out = LiveRainfallService().predict(LOC, payload(clock.now))
    assert out["ready"] is False and out["reason"] == "MODEL_UNAVAILABLE_OR_INVALID_INPUT"
    assert not {"hazard_score", "temporal_score", "spatial_score"} & set(out)


# ---------- read / history / map ----------
def row(clock, success_age=None, error=None):
    return {"location_name": "n", "latitude": 21.845, "longitude": 104.085, "payload": {"a": 1},
            "last_success_at": None if success_age is None else clock.now - timedelta(seconds=success_age),
            "last_attempt_at": clock.now, "last_error": error}


def test_read_unknown_and_stale_flags(svc, clock):
    assert svc.read(21.845, 104.085) is None
    for age, err, stale in [(0, None, False), (5400, None, False), (5401, None, True), (10, "Timeout", True),
                            (None, "Timeout", True), (None, None, True)]:
        svc.repo.cache[KEY] = row(clock, age, err)
        out = svc.read(21.845, 104.085)
        assert out["stale"] is stale, (age, err)
        assert out["refresh_interval_seconds"] == 3600
        assert out["last_success_at"] == (None if age is None else (clock.now - timedelta(seconds=age)).isoformat())
    assert out["data"] == {"a": 1}


def test_read_invalid_coordinates_raise(svc):
    with pytest.raises(ValueError):
        svc.read(100, 0)


def test_history_window_and_validation(svc, clock):
    svc.history(21.845, 104.085, 3)
    assert svc.repo.hist == [(KEY, clock.now - timedelta(days=3))]
    with pytest.raises(ValueError):
        svc.history(float("nan"), 0, 1)


def test_map_collection_flags_never_current_when_stale(svc, clock):
    gru = {"ready": True, "valid_until": (clock.now + timedelta(hours=1)).isoformat(), "hazard_score": 0.5}
    base = {"location_key": KEY, "location_name": "n", "latitude": 1.0, "longitude": 2.0, "gru": gru,
            "last_error": None, "geom": None, "rain_24h_mm": None, "forecast_24h_mm": None}
    svc.repo.rows = [dict(base, last_success_at=clock.now - timedelta(seconds=5400)),
                     dict(base, last_success_at=clock.now - timedelta(seconds=5401)),
                     dict(base, last_success_at=None)]
    fc = svc.map_collection()
    cur = [f["properties"]["current"] for f in fc["features"]]
    assert cur == [True, False, False]
    assert fc["operational_alert"] is False and fc["calibrated_probability"] is False
    assert fc["features"][2]["properties"]["rain_24h_mm"] is None  # missing stays missing


# ---------- background worker ----------
def test_start_disabled_creates_no_thread(monkeypatch):
    monkeypatch.setenv("RAINFALL_AUTO_ENABLED", "false")
    s = LiveRainfallService()
    s.start()
    assert s.thread is None
    s.stop()  # stop without thread is a no-op


def test_start_stop_runs_cycles_and_leaves_no_thread(monkeypatch):
    s = LiveRainfallService()
    ran = threading.Event()
    calls = []
    s.run_once = lambda: (calls.append(1), ran.set())
    s.start()
    first = s.thread
    s.start()  # second start must not spawn another worker
    assert s.thread is first and first.daemon and first.name == "rainfall-refresh"
    assert ran.wait(5)
    s.stop()
    assert not first.is_alive()
    assert [t for t in threading.enumerate() if t.name == "rainfall-refresh"] == []


def test_loop_survives_cycle_exception_and_records_safe_error(monkeypatch):
    s = LiveRainfallService()
    waits = []

    def boom():
        raise RuntimeError("password=hunter2")
    s.run_once = boom
    s.stop_event.wait = lambda t: (waits.append(t), s.stop_event.set())[0]
    s._loop()
    assert s.state["last_error"] == "RuntimeError" and waits == [60]


def test_loop_wait_is_min_of_interval_and_60(monkeypatch):
    s = LiveRainfallService()
    waits = []
    s.run_once = lambda: None
    n = []
    s.stop_event.wait = lambda t: (waits.append(t), n.append(1), len(n) >= 2 and s.stop_event.set())[0]
    s.interval = 30
    s._loop()
    assert waits == [30, 30]


def test_stop_does_not_hang_when_worker_blocked(monkeypatch):
    s = LiveRainfallService()
    gate = threading.Event()
    s.run_once = lambda: gate.wait(10)
    s.start()
    monkeypatch.setattr(s.thread, "join", lambda timeout=None: setattr(s, "joined_with", timeout))
    s.stop()
    assert s.joined_with == 2 and s.stop_event.is_set()
    gate.set()
    threading.Thread.join(s.thread, 5)
    assert not s.thread.is_alive()


# ---------- DB-backed ----------
def lkey(db_):
    k = f"{random.uniform(-5, -1):.4f},{random.uniform(-179, -170):.4f}"
    db_.live_keys.append(k)
    lat, lon = k.split(",")
    return {"key": k, "name": "TWT " + db_.prefix, "latitude": float(lat), "longitude": float(lon)}


@pytest.fixture
def repo(db):
    r = LiveWeatherRepository()
    r.ensure_schema()
    return r


@needs_db
def test_ensure_schema_idempotent(repo):
    repo.ensure_schema()


@needs_db
def test_connection_failure_raises(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:55499/terrawatch")
    import psycopg2
    with pytest.raises(psycopg2.OperationalError):
        LiveWeatherRepository().get("x")


@needs_db
def test_save_success_then_error_keeps_last_payload(db, repo):
    loc = lkey(db)
    assert repo.get(loc["key"]) is None
    pl = payload()
    repo.save(loc, payload=pl)
    row_ = repo.get(loc["key"])
    assert row_["payload"]["as_of"] == pl["as_of"] and row_["last_error"] is None and row_["last_success_at"]
    ok_at = row_["last_success_at"]
    repo.save(loc, error="Timeout")
    row_ = repo.get(loc["key"])
    assert row_["last_error"] == "Timeout" and row_["payload"]["as_of"] == pl["as_of"]
    assert row_["last_success_at"] == ok_at  # failure never refreshes success time


@needs_db
def test_first_failure_has_no_payload_and_no_success(db, repo):
    loc = lkey(db)
    repo.save(loc, error="HTTPError HTTP 503")
    r = repo.get(loc["key"])
    assert r["payload"] is None and r["last_success_at"] is None and r["last_error"] == "HTTPError HTTP 503"


@needs_db
def test_history_is_append_only_first_fetch_wins_and_drops_weather(db, repo):
    loc = lkey(db)
    first = payload(NOW, value=1.0)
    first["weather"] = {"x": 1}
    second = payload(NOW + timedelta(minutes=10), value=9.0)  # same as_of hour, different fetch
    repo.save(loc, payload=first)
    repo.save(loc, payload=second)
    rows = db.q("SELECT payload FROM gis_schema.live_rainfall_history WHERE location_key=%s", (loc["key"],))
    assert len(rows) == 1 and rows[0][0]["history"]["24"]["mm"] == 24.0 and "weather" not in rows[0][0]


@needs_db
def test_history_query_since_boundary_and_order(db, repo):
    loc = lkey(db)
    for h in (0, 1, 2):
        repo.save(loc, payload=payload(NOW + timedelta(hours=h)))
    since = NOW.replace(minute=0) + timedelta(hours=1)
    rows = repo.history(loc["key"], since)
    assert [r["as_of"] for r in rows] == [since, since + timedelta(hours=1)]  # inclusive at boundary, oldest first
    assert rows[0]["rain_24h_mm"] == 24.0 and rows[0]["quality"] == "complete" and rows[0]["hazard_score"] is None
    assert repo.history(loc["key"], since + timedelta(days=1)) == []
    assert repo.history("0.0000,0.0000", since) == []


@needs_db
def test_save_prediction_updates_only_matching_as_of(db, repo):
    loc = lkey(db)
    pl = payload()
    repo.save(loc, payload=pl)
    stored_attempt = repo.get(loc["key"])["last_attempt_at"]
    repo.save_prediction(loc["key"], "1999-01-01T00:00:00+00:00", {"ready": True, "hazard_score": 0.9})
    assert repo.get(loc["key"])["payload"]["gru_inference"]["ready"] is False  # other as_of: untouched
    repo.save_prediction(loc["key"], pl["as_of"], {"ready": True, "hazard_score": 0.9, "model_id": "m"})
    got = repo.get(loc["key"])
    assert got["payload"]["gru_inference"]["hazard_score"] == 0.9 and got["last_attempt_at"] == stored_attempt
    assert repo.history(loc["key"], NOW - timedelta(days=1))[0]["model_id"] == "m"


@needs_db
def test_map_rows_joins_unit_polygon_by_centroid_and_null_geom_otherwise(db, repo):
    loc = lkey(db)
    repo.save(loc, payload=payload())
    unit = db.unit("M", x=round(random.uniform(150, 160), 3), y=round(random.uniform(30, 40), 3))
    cx, cy = db.q("SELECT ST_X(centroid), ST_Y(centroid) FROM gis_schema.spatial_assessment_units WHERE unit_id=%s",
                  (unit,))[0]
    loc2 = {"key": f"{cy:.4f},{cx:.4f}", "name": "at unit", "latitude": cy, "longitude": cx}
    db.live_keys.append(loc2["key"])
    repo.save(loc2, payload=payload())
    rows = {r["location_key"]: r for r in repo.map_rows()}
    assert rows[loc["key"]]["geom"] is None and rows[loc["key"]]["rain_24h_mm"] == 24.0
    assert json.loads(rows[loc2["key"]]["geom"])["type"] == "Polygon"
    db.q("UPDATE gis_schema.spatial_assessment_units SET is_active=FALSE WHERE unit_id=%s", (unit,))
    assert {r["location_key"]: r for r in repo.map_rows()}[loc2["key"]]["geom"] is None  # inactive unit not joined


@needs_db
def test_service_read_and_history_end_to_end(db, repo):
    loc = lkey(db)
    repo.save(loc, payload=payload())
    s = LiveRainfallService()
    out = s.read(loc["latitude"], loc["longitude"])
    assert out["stale"] is False and out["data"]["as_of"] == payload()["as_of"]
    repo.save(loc, error="Timeout")
    assert s.read(loc["latitude"], loc["longitude"])["stale"] is True
    assert s.read(1.2345, -170.1234) is None


@needs_db
def test_run_once_skips_when_another_session_holds_advisory_lock(db, repo, monkeypatch):
    s = LiveRainfallService()
    calls = []
    s.locations = lambda: calls.append(1) or []
    db.q("SELECT pg_advisory_lock(%s)", (lr.LOCK_ID,))  # held by db.conn until closed
    try:
        s.run_once()
        assert calls == []
    finally:
        db.q("SELECT pg_advisory_unlock(%s)", (lr.LOCK_ID,))
    s.run_once()
    assert calls == [1]  # lock was released by run_once's connection close, so a new cycle proceeds


@needs_db
def test_run_once_real_repo_stores_failure_for_registered_location(db, repo, clock):
    loc = lkey(db)
    s = LiveRainfallService()
    s.locations = lambda: [loc]
    s.fetch = lambda l: (_ for _ in ()).throw(requests.exceptions.ConnectionError("down"))
    s.run_once()
    r = repo.get(loc["key"])
    assert r["last_error"] == "ConnectionError" and r["payload"] is None and r["last_success_at"] is None


def test_load_climatology_unreadable_file_is_none(monkeypatch):
    monkeypatch.setattr(lr.Path, "read_text", lambda self, **k: "{not json")
    assert lr.load_climatology(KEY) is None
    assert lr.load_climatology("0.0000,0.0000") is None
