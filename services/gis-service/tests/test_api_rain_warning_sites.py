"""HTTP tests for GET /api/v1/gis/rainfall/warning/sites (config injected, no file/DB/network)."""
import pytest

from app.pipeline import rain_warning

URL = "/api/v1/gis/rainfall/warning/sites"
TH = {"72": {"p95": 10, "p99": 20, "p99_9": 30}, "120": {"p95": 15, "p99": 25, "p99_9": 40}}
SITE = {"key": "1.0000,2.0000", "name": "Site A", "latitude": 1.0, "longitude": 2.0, "thresholds": TH,
        "last_event_at_level": {"watch": None}, "impact_zone": {"type": "Polygon"}, "extra_secret": "x"}
CONFIG = {"source": "src", "period": "1998-2026", "method": "m", "hit_rates": {"watch": {"one_in": 50}},
          "hit_rate_sites": 3, "people_source": "p", "footprint_source": "f",
          "sites": {SITE["key"]: SITE},
          "replays": {"ev1": {"label": "Event 1", "site_key": SITE["key"], "hourly_mm": [0]}}}


@pytest.fixture
def config(monkeypatch):
    monkeypatch.setattr(rain_warning, "load_config", lambda: CONFIG)


def test_sites_success_shape(client, config):
    r = client.get(URL)
    assert r.status_code == 200
    body = r.json()
    assert body["period"] == "1998-2026" and body["source"] == "src" and body["method"] == "m"
    assert body["hit_rates"] == {"watch": {"one_in": 50}} and body["hit_rate_sites"] == 3
    assert body["people_source"] == "p" and body["footprint_source"] == "f"
    assert body["buildings_source"] is None  # optional key absent from config
    assert body["replays"] == [{"replay_id": "ev1", "label": "Event 1", "site_key": SITE["key"]}]
    assert body["sites"] == [{"key": SITE["key"], "name": "Site A", "latitude": 1.0, "longitude": 2.0,
                              "thresholds": TH, "last_event_at_level": {"watch": None},
                              "impact_zone": {"type": "Polygon"}, "runout": None}]


def test_sites_only_whitelisted_site_fields(client, config):
    assert "extra_secret" not in client.get(URL).json()["sites"][0]


def test_sites_includes_runout_when_configured(client, monkeypatch):
    cfg = {**CONFIG, "sites": {SITE["key"]: {**SITE, "runout": {"max_m": 120}}}}
    monkeypatch.setattr(rain_warning, "load_config", lambda: cfg)
    assert client.get(URL).json()["sites"][0]["runout"] == {"max_m": 120}


@pytest.mark.parametrize("cfg", [None, {}])
def test_sites_missing_config_503(client, monkeypatch, cfg):
    monkeypatch.setattr(rain_warning, "load_config", lambda: cfg)
    r = client.get(URL)
    assert r.status_code == 503
    assert r.json() == {"detail": "Chưa có cấu hình cảnh báo theo mưa."}


def test_sites_real_config_file_serves_ok(client):
    """Shipped config file must load and expose the documented keys."""
    rain_warning.load_config.cache_clear()
    r = client.get(URL)
    assert r.status_code == 200
    body = r.json()
    assert body["sites"] and body["replays"]
    assert all(set(s) >= {"key", "name", "thresholds", "impact_zone"} for s in body["sites"])


def test_sites_post_not_allowed(client, config):
    assert client.post(URL).status_code == 405
