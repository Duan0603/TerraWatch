"""Rainfall / health HTTP conditions from docs/test-cases/test-conditions.csv that no older test asserts.

Condition IDs (PY-GIS-*, BL-GIS-*) are in test names, parametrize ids or comments. In-memory fakes only.
"""
import pytest
from fastapi.testclient import TestClient

from api_fakes import BATXAT, SECRET, FakeLive, FakeRainClient, FakeRainRepo, FakeSnapRepo, FakeTerrainRepo, RainfallClientError
from app import main

pytestmark = pytest.mark.usefixtures("frozen_rain")

INGEST = "/api/v1/gis/rainfall/ingest"
SUMMARY = "/api/v1/gis/rainfall/summary/"
SAMPLE = "/api/v1/gis/rainfall/live-sample"


class RecordingRainRepo(FakeRainRepo):
    def __init__(self, **kw):
        super().__init__(**kw)
        self.summary_asked = []

    def get_latest_rainfall_summary(self, unit_id):
        self.summary_asked.append(unit_id)
        return super().get_latest_rainfall_summary(unit_id)


# ---------------------------------------------------------------- PY-GIS-002 / PY-GIS-010 (no dependency on the failing parts)
def test_py_gis_002_live_status_stays_200_when_cache_reads_fail(client, monkeypatch):
    """status reports in-memory scheduler state only; a broken cache/DB must not turn it into an error."""
    fake = FakeLive(exc=RuntimeError(SECRET))
    monkeypatch.setattr(main, "live_rainfall", fake)
    r = client.get("/api/v1/gis/rainfall/live/status")
    assert r.status_code == 200 and r.json()["success"] is True
    assert fake.read_args == []


def test_py_gis_010_health_stays_200_when_every_dependency_is_down(client, monkeypatch):
    monkeypatch.setattr(main, "rainfall_repo", FakeRainRepo(fail=True))
    monkeypatch.setattr(main, "terrain_repo", FakeTerrainRepo(fail=True))
    monkeypatch.setattr(main, "snapshot_repo", FakeSnapRepo(fail=True))
    monkeypatch.setattr(main, "rainfall_client", FakeRainClient(exc=RainfallClientError("down")))
    monkeypatch.setattr(main, "live_rainfall", FakeLive(exc=RuntimeError(SECRET)))
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


# ---------------------------------------------------------------- PY-GIS-013 (CSV out of date: every ingest field is optional)
@pytest.mark.parametrize("content,headers", [
    (None, {}),                                                    # no body at all
    ("null", {"content-type": "application/json"}),
    ("[]", {"content-type": "application/json"}),
    ('{"past_days": 3}', {"content-type": "text/plain"}),        # JSON in a non-JSON content type
], ids=["PY-GIS-013-no-body", "PY-GIS-013-json-null", "PY-GIS-013-json-array", "PY-GIS-013-wrong-content-type"])
def test_ingest_body_must_be_a_json_object(client, monkeypatch, content, headers):
    repo = FakeRainRepo()
    monkeypatch.setattr(main, "rainfall_repo", repo)
    r = client.post(INGEST, content=content, headers=headers)
    assert r.status_code == 422
    assert repo.queries == []


# ---------------------------------------------------------------- PY-GIS-056..067 field level
@pytest.mark.parametrize("body,expected", [
    ({"area_id": None}, (None, None)),            # PY-GIS-056/058: explicit null for Optional[int] = no filter
    ({"unit_id": None}, (None, None)),            # PY-GIS-059/061: explicit null for Optional[str] = no filter
    ({"unit_id": BATXAT["unit_id"]}, (None, BATXAT["unit_id"])),
    ({"area_id": 0}, (0, None)),                  # PY-GIS-058: 0 is a value, not "absent"
    ({"area_id": -1}, (-1, None)),
], ids=["PY-GIS-056-area-null", "PY-GIS-059-unit-null", "PY-GIS-060-unit-only", "PY-GIS-058-area-zero", "PY-GIS-058-area-negative"])
def test_ingest_optional_filters_forwarded_exactly(client, monkeypatch, body, expected):
    repo = FakeRainRepo()
    monkeypatch.setattr(main, "rainfall_repo", repo)
    monkeypatch.setattr(main, "rainfall_client", FakeRainClient())
    assert client.post(INGEST, json=body).status_code == 200
    assert repo.queries == [expected]


@pytest.mark.parametrize("body", [
    {"past_days": None}, {"forecast_days": None},        # PY-GIS-063/066: int fields are not Optional
    {"past_days": 7.5}, {"past_days": -1}, {"past_days": 2 ** 31}, {"forecast_days": -1}, {"forecast_days": "two"},
    {"past_days": [7]}, {"past_days": {"n": 7}},
], ids=["PY-GIS-063-past-null", "PY-GIS-066-forecast-null", "PY-GIS-063-past-fraction", "PY-GIS-064-past-negative",
        "PY-GIS-064-past-huge", "PY-GIS-067-forecast-negative", "PY-GIS-066-forecast-word",
        "PY-GIS-063-past-list", "PY-GIS-063-past-object"])
def test_ingest_int_fields_reject_bad_values_without_touching_dependencies(client, monkeypatch, body):
    repo, cl = FakeRainRepo(), FakeRainClient()
    monkeypatch.setattr(main, "rainfall_repo", repo)
    monkeypatch.setattr(main, "rainfall_client", cl)
    r = client.post(INGEST, json=body)
    assert r.status_code == 422
    assert repo.queries == [] and cl.calls == []


def test_py_gis_061_ingest_empty_unit_id_is_a_filter_not_absent(client, monkeypatch):
    """'' is forwarded as a filter (matches nothing) rather than silently ingesting every unit."""
    repo, cl = FakeRainRepo(), FakeRainClient()
    monkeypatch.setattr(main, "rainfall_repo", repo)
    monkeypatch.setattr(main, "rainfall_client", cl)
    assert client.post(INGEST, json={"unit_id": ""}).status_code == 404
    assert repo.queries == [(None, "")] and cl.calls == []


# ---------------------------------------------------------------- PY-GIS-012 (P0): sanitised error details
@pytest.mark.xfail(strict=True, reason="BUG: expected ingest per-unit failure text to be sanitised (no driver text/host) "
                                       "when saving observations fails; actual: 200 body carries str(exception) "
                                       "'password=*** host=10.0.0.9' in results[0].error (app/main.py except Exception).")
def test_py_gis_012_ingest_db_write_failure_does_not_leak_driver_text(client, monkeypatch):
    class WriteFails(FakeRainRepo):
        def save_rainfall_observations(self, obs):
            import psycopg2
            raise psycopg2.OperationalError(SECRET)

    monkeypatch.setattr(main, "rainfall_repo", WriteFails())
    monkeypatch.setattr(main, "rainfall_client", FakeRainClient())
    r = client.post(INGEST, json={})
    assert "10.0.0.9" not in r.text and "password" not in r.text


def test_py_gis_012_ingest_db_write_failure_reports_failure_and_saves_no_forecast(client, monkeypatch):
    class WriteFails(FakeRainRepo):
        def save_rainfall_observations(self, obs):
            raise RuntimeError("disk full")

    repo = WriteFails()
    monkeypatch.setattr(main, "rainfall_repo", repo)
    monkeypatch.setattr(main, "rainfall_client", FakeRainClient())
    body = client.post(INGEST, json={}).json()
    assert body["success"] is False
    assert body["total_observations_saved"] == 0 and body["total_forecasts_saved"] == 0
    assert body["results"][0]["status"] == "failed"
    assert repo.fcst == []  # forecast not written after the observation write failed


def test_py_gis_012_ingest_partial_provider_failure_keeps_other_units(client, monkeypatch):
    """One failing unit must not abort or hide the units that succeeded; overall success stays True."""
    second = {**BATXAT, "unit_id": "U2", "latitude": 21.0, "longitude": 104.0}

    class Flaky(FakeRainClient):
        def fetch_rainfall_series(self, latitude, longitude, past_days=7, forecast_days=2):
            if latitude == 21.0:
                raise RainfallClientError("upstream 503")
            return super().fetch_rainfall_series(latitude, longitude, past_days, forecast_days)

    repo = FakeRainRepo(units=[second, BATXAT])
    monkeypatch.setattr(main, "rainfall_repo", repo)
    monkeypatch.setattr(main, "rainfall_client", Flaky())
    body = client.post(INGEST, json={}).json()
    assert body["success"] is True and body["total_units_evaluated"] == 2
    assert [(r["unit_id"], r["status"]) for r in body["results"]] == [("U2", "failed"), (BATXAT["unit_id"], "success")]
    assert body["total_observations_saved"] == 48 and body["total_forecasts_saved"] == 1
    assert len(repo.obs) == 1


# ---------------------------------------------------------------- PY-GIS-016 (P0) / 017 / 018 summary
def test_py_gis_016_summary_provider_outage_detail_is_sanitised(client, monkeypatch):
    exc = RainfallClientError("Open-Meteo API network failure: HTTPSConnectionPool(host='api.open-meteo.com', port=443)")
    repo = RecordingRainRepo()
    monkeypatch.setattr(main, "rainfall_repo", repo)
    monkeypatch.setattr(main, "rainfall_client", FakeRainClient(exc=exc))
    r = client.get(SUMMARY + BATXAT["unit_id"])
    assert r.status_code == 502
    assert r.json() == {"detail": "Weather provider unavailable."}
    assert repo.obs == [] and repo.fcst == []  # nothing fabricated or persisted


@pytest.mark.parametrize("where", ["process", "save"])
def test_py_gis_016_summary_unexpected_failure_is_generic_500(client, monkeypatch, where):
    class Repo(FakeRainRepo):
        def save_rainfall_observations(self, obs):
            raise RuntimeError(SECRET)

    if where == "process":
        repo = FakeRainRepo()
        monkeypatch.setattr(main, "rainfall_repo", repo)
        monkeypatch.setattr(main, "rainfall_client", FakeRainClient(data={"hourly": {"time": ["x"], "precipitation": ["bad"]}}))
    else:
        repo = Repo()
        monkeypatch.setattr(main, "rainfall_repo", repo)
        monkeypatch.setattr(main, "rainfall_client", FakeRainClient())
    r = client.get(SUMMARY + BATXAT["unit_id"])
    assert r.status_code == 500
    assert r.json() == {"detail": "Internal server error."}
    assert repo.fcst == []


def test_py_gis_017_summary_without_unit_id_is_route_not_found(client, monkeypatch):
    """CSV expects 422; the unit id is a path segment, so an empty one never reaches the handler (404)."""
    repo = RecordingRainRepo()
    monkeypatch.setattr(main, "rainfall_repo", repo)
    assert client.get(SUMMARY, follow_redirects=False).status_code == 404
    assert repo.summary_asked == []


@pytest.mark.parametrize("raw,decoded", [("U%201", "U 1"), ("%C3%94-1", "Ô-1"), ("12345", "12345"), ("%3Cscript%3E", "<script>")],
                         ids=["space", "unicode", "numeric", "markup"])
def test_py_gis_018_summary_unit_id_is_any_string_passed_verbatim(client, monkeypatch, raw, decoded):
    """CSV expects 422 for the wrong type; unit_id is a plain str, so any value is looked up as-is (then 404)."""
    repo = RecordingRainRepo()
    monkeypatch.setattr(main, "rainfall_repo", repo)
    r = client.get(SUMMARY + raw)
    assert r.status_code == 404
    assert repo.summary_asked == [decoded]
    assert repo.queries == [(None, decoded)]


# ---------------------------------------------------------------- PY-GIS-021 (P0) / 022 / 023 + BL-GIS-017..020 for live-sample
def test_py_gis_021_live_sample_failure_detail_is_sanitised(client, monkeypatch):
    exc = RainfallClientError("HTTPSConnectionPool(host='api.open-meteo.com', port=443): Max retries")
    monkeypatch.setattr(main, "rainfall_client", FakeRainClient(exc=exc))
    r = client.get(SAMPLE)
    assert r.status_code == 500
    assert r.json() == {"detail": "Internal server error."}


@pytest.mark.parametrize("lat,lon", [(-90, -180), (90, 180), (-90, 180), (90, -180)],
                         ids=["BL-GIS-017/019-min", "BL-GIS-017/019-max", "BL-GIS-017/019-mixed-a", "BL-GIS-017/019-mixed-b"])
def test_bl_gis_017_019_live_sample_inclusive_bounds(client, monkeypatch, lat, lon):
    cl = FakeRainClient()
    monkeypatch.setattr(main, "rainfall_client", cl)
    r = client.get(SAMPLE, params={"lat": lat, "lon": lon})
    assert r.status_code == 200 and r.json()["coordinates"] == {"lat": lat, "lon": lon}
    assert cl.calls == [(lat, lon, 2, 2)]


@pytest.mark.parametrize("params", [
    {"lat": 90.0001}, {"lat": -90.0001}, {"lon": 180.0001}, {"lon": -180.0001},
    {"lat": "nan"}, {"lon": "nan"}, {"lat": "inf"}, {"lon": "-inf"},
], ids=["BL-GIS-018-lat-hi", "BL-GIS-018-lat-lo", "BL-GIS-020-lon-hi", "BL-GIS-020-lon-lo",
        "PY-GIS-023-lat-nan", "PY-GIS-023-lon-nan", "PY-GIS-023-lat-inf", "PY-GIS-023-lon-ninf"])
def test_live_sample_out_of_range_never_calls_provider(client, monkeypatch, params):
    cl = FakeRainClient()
    monkeypatch.setattr(main, "rainfall_client", cl)
    assert client.get(SAMPLE, params=params).status_code == 422
    assert cl.calls == []


def test_py_gis_022_live_sample_only_one_coordinate_uses_default_for_the_other(client, monkeypatch):
    cl = FakeRainClient()
    monkeypatch.setattr(main, "rainfall_client", cl)
    assert client.get(SAMPLE, params={"lat": 10}).json()["coordinates"] == {"lat": 10.0, "lon": 103.855}
    assert client.get(SAMPLE, params={"lon": 100}).json()["coordinates"] == {"lat": 22.525, "lon": 100.0}
    assert [c[:2] for c in cl.calls] == [(10.0, 103.855), (22.525, 100.0)]
