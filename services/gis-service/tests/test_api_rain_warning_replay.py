"""HTTP tests for GET /api/v1/gis/rainfall/warning/replay/{replay_id} (config injected, no file/DB/network)."""
import pytest

from app.pipeline import rain_warning

URL = "/api/v1/gis/rainfall/warning/replay/"
TH = {"72": {"p95": 10, "p99": 20, "p99_9": 30}, "120": {"p95": 15, "p99": 25, "p99_9": 40}}
KEY = "1.0000,2.0000"
SITE = {"name": "Site A", "thresholds": TH, "daily_peak_72h_quantiles": [[0, 0], [50, 10], [100, 100]],
        "last_event_at_level": {"watch": "2020-01-01"}}
# 122 hourly values: zeros, then 1 mm/h => 120 h total reaches 120 mm at the last index.
HOURLY = [0.0] * 2 + [1.0] * 120
ITEM = {"label": "Event 1", "site_key": KEY, "hourly_mm": HOURLY, "replay_from_index": 119,
        "first_interval_end_utc": "2024-09-01T00:00:00+00:00", "event_utc": "2024-09-08T00:00:00Z",
        "event_label": "lbl", "event_end_utc": None}
CONFIG = {"hit_rates": {"watch": {"one_in": 50}}, "sites": {KEY: SITE}, "replays": {"ev1": ITEM}}


@pytest.fixture
def config(monkeypatch):
    monkeypatch.setattr(rain_warning, "load_config", lambda: CONFIG)


def test_replay_success_shape(client, config):
    r = client.get(URL + "ev1")
    assert r.status_code == 200
    b = r.json()
    assert (b["replay_id"], b["label"], b["site_key"], b["site_name"]) == ("ev1", "Event 1", KEY, "Site A")
    assert b["event_utc"] == "2024-09-08T00:00:00Z" and b["event_label"] == "lbl" and b["event_end_utc"] is None
    assert b["event_precision"] == "hour"  # default when absent
    assert b["thresholds_mm"] == TH and b["hit_rates"] == CONFIG["hit_rates"]


def test_replay_hours_start_at_replay_from_index_with_timestamps(client, config):
    hours = client.get(URL + "ev1").json()["hours"]
    assert len(hours) == len(HOURLY) - 119 == 3
    assert hours[0]["interval_end"] == "2024-09-05T23:00:00+00:00"  # t0 + 119 h
    assert hours[-1]["interval_end"] == "2024-09-06T01:00:00+00:00"
    assert set(hours[0]) == {"interval_end", "mm", "totals_mm", "level", "percent_days_below"}
    assert hours[0]["mm"] == 1.0


def test_replay_levels_follow_rolling_totals(client, config):
    first, _, last = client.get(URL + "ev1").json()["hours"]
    # index 119: 72 h sum = 72, 120 h sum = 118 -> above every threshold -> danger
    assert first["totals_mm"] == {"24": 24.0, "72": 72.0, "120": 118.0}
    assert first["level"] == "danger"
    assert last["totals_mm"]["120"] == 120.0 and last["percent_days_below"] == 84.44  # 72 mm interpolated between quantiles [50,10] and [100,100]


def test_replay_incomplete_window_has_null_level(client, monkeypatch):
    item = {**ITEM, "replay_from_index": 10}
    monkeypatch.setattr(rain_warning, "load_config", lambda: {**CONFIG, "replays": {"ev1": item}})
    h = client.get(URL + "ev1").json()["hours"][0]
    assert h["level"] is None and h["totals_mm"]["120"] is None


@pytest.mark.parametrize("rid", ["nope", "EV1", "ev1%20"])
def test_replay_unknown_id_404(client, config, rid):
    r = client.get(URL + rid)
    assert r.status_code == 404
    assert r.json() == {"detail": "Không có dữ liệu phát lại này."}


def test_replay_missing_config_404(client, monkeypatch):
    monkeypatch.setattr(rain_warning, "load_config", lambda: None)
    assert client.get(URL + "ev1").status_code == 404


def test_replay_empty_id_not_routed(client, config):
    assert client.get(URL).status_code in (404, 405)


def test_replay_real_config_ids_resolve(client):
    rain_warning.load_config.cache_clear()
    ids = [x["replay_id"] for x in client.get("/api/v1/gis/rainfall/warning/sites").json()["replays"]]
    assert ids
    for rid in ids:
        r = client.get(URL + rid)
        assert r.status_code == 200 and r.json()["replay_id"] == rid and r.json()["hours"]
