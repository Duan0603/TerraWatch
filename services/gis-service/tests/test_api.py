"""HTTP-level tests (fastapi TestClient) for health, tiling, mvt, live-cache and rainfall routes of app/main.py.

No real network: repositories/clients in app.main are replaced with in-memory fakes from api_fakes.py.
"""
import psycopg2
import pytest
from fastapi.testclient import TestClient

from api_fakes import (BATXAT, SECRET, FakeLive, FakeRainClient, FakeRainRepo, RainfallClientError, om_series, NOW)
from app import main

pytestmark = pytest.mark.usefixtures("frozen_rain")


# ---------------------------------------------------------------- health / startup / mvt / tiling
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "service": "gis-service", "version": "2.0.0",
                        "supported_providers": ["OPEN_METEO", "SRTM_30M"]}


def test_cors_allows_any_origin(client):
    r = client.get("/health", headers={"Origin": "http://example.test"})
    assert r.headers["access-control-allow-origin"] in ("*", "http://example.test")


def test_startup_and_shutdown_hooks_call_live_service(monkeypatch):
    calls = []

    class Fake:
        def start(self): calls.append("start")
        def stop(self): calls.append("stop")

    monkeypatch.setattr(main, "live_rainfall", Fake())
    with TestClient(main.app) as c:
        assert c.get("/health").status_code == 200
        assert calls == ["start"]
    assert calls == ["start", "stop"]


def test_mvt_returns_empty_tile(client):
    r = client.get("/api/v1/gis/mvt/3/4/5.pbf")
    assert r.status_code == 200
    assert r.content == b""
    assert r.headers["content-type"] == "application/vnd.mapbox-vector-tile"


@pytest.mark.parametrize("path", ["/api/v1/gis/mvt/a/4/5.pbf", "/api/v1/gis/mvt/3/4.5/5.pbf"])
def test_mvt_non_integer_coords_422(client, path):
    assert client.get(path).status_code == 422


def test_tiling_valid(client):
    r = client.post("/api/v1/gis/tiling", json={"area_id": 1, "bbox": [104.05, 21.80, 104.20, 21.90], "patch_size_km": 5})
    body = r.json()
    assert r.status_code == 200
    assert body["success"] is True and body["area_id"] == 1
    assert body["total_tiles"] == len(body["tiles"]) > 0
    t = body["tiles"][0]
    assert t["tile_id"] == "tile_0001" and t["status"] == "ready_for_inference" and t["size_km"] == 5
    assert all(len(t["bbox"]) == 4 for t in body["tiles"])
    # tiles stay inside the requested bbox
    assert all(104.05 <= t["bbox"][0] and t["bbox"][2] <= 104.20 and 21.80 <= t["bbox"][1] and t["bbox"][3] <= 21.90
               for t in body["tiles"])


def test_tiling_default_patch_size(client):
    r = client.post("/api/v1/gis/tiling", json={"area_id": 1, "bbox": [104.05, 21.80, 104.06, 21.81]})
    assert r.status_code == 200 and r.json()["tiles"][0]["size_km"] == 2.0


@pytest.mark.parametrize("bbox", [[1, 2, 3], [1, 2, 3, 4, 5], []])
def test_tiling_bbox_wrong_length_400(client, bbox):
    r = client.post("/api/v1/gis/tiling", json={"area_id": 1, "bbox": bbox})
    assert r.status_code == 400
    assert r.json()["detail"] == "bbox must have 4 coordinates"


@pytest.mark.parametrize("body", [
    {}, {"area_id": 1}, {"bbox": [1, 2, 3, 4]},
    {"area_id": "x", "bbox": [1, 2, 3, 4]}, {"area_id": 1, "bbox": "nope"},
    {"area_id": 1, "bbox": [1, 2, "a", 4]}, {"area_id": 1, "bbox": [1, 2, 3, 4], "patch_size_km": "big"},
])
def test_tiling_validation_422(client, body):
    assert client.post("/api/v1/gis/tiling", json=body).status_code == 422


def test_tiling_get_not_allowed(client):
    assert client.get("/api/v1/gis/tiling").status_code == 405


# ---------------------------------------------------------------- live rainfall (cache) routes


def test_live_status(client, monkeypatch):
    monkeypatch.setattr(main, "live_rainfall", FakeLive())
    r = client.get("/api/v1/gis/rainfall/live/status")
    assert r.status_code == 200
    assert r.json() == {"success": True, "enabled": False, "interval_seconds": 3600, "running": False,
                        "last_cycle_at": None, "last_error": None, "locations": 0}


def test_live_map_ok(client, monkeypatch):
    fc = {"type": "FeatureCollection", "features": []}
    monkeypatch.setattr(main, "live_rainfall", FakeLive(map_=fc))
    r = client.get("/api/v1/gis/rainfall/live/map")
    assert r.status_code == 200 and r.json() == fc


def test_live_map_db_failure_is_sanitised_503(client, monkeypatch):
    monkeypatch.setattr(main, "live_rainfall", FakeLive(exc=RuntimeError(SECRET)))
    r = client.get("/api/v1/gis/rainfall/live/map")
    assert r.status_code == 503
    assert "hunter2" not in r.text and "10.0.0.9" not in r.text


LIVE = "/api/v1/gis/rainfall/live"


def test_live_ok_and_reads_cache_only(client, monkeypatch):
    fake = FakeLive(read={"location_name": "X", "data": {"a": 1}, "stale": False})
    monkeypatch.setattr(main, "live_rainfall", fake)
    r = client.get(LIVE, params={"latitude": 22.5, "longitude": 103.8})
    assert r.status_code == 200
    assert r.json() == {"success": True, "location_name": "X", "data": {"a": 1}, "stale": False}
    assert fake.read_args == [(22.5, 103.8)]


@pytest.mark.parametrize("lat,lon", [(-90, -180), (90, 180), (0, 0)])
def test_live_boundaries_pass(client, monkeypatch, lat, lon):
    monkeypatch.setattr(main, "live_rainfall", FakeLive(read={"data": None}))
    assert client.get(LIVE, params={"latitude": lat, "longitude": lon}).status_code == 200


@pytest.mark.parametrize("lat,lon", [(90.0001, 0), (-90.0001, 0), (0, 180.0001), (0, -180.0001)])
def test_live_out_of_range_422(client, monkeypatch, lat, lon):
    fake = FakeLive(read={"data": None})
    monkeypatch.setattr(main, "live_rainfall", fake)
    assert client.get(LIVE, params={"latitude": lat, "longitude": lon}).status_code == 422
    assert fake.read_args == []


@pytest.mark.parametrize("params", [{}, {"latitude": 1}, {"longitude": 1}, {"latitude": "abc", "longitude": 1},
                                    {"latitude": 1, "longitude": "abc"}, {"latitude": "nan", "longitude": 1}])
def test_live_invalid_params_422(client, monkeypatch, params):
    monkeypatch.setattr(main, "live_rainfall", FakeLive(read={"data": None}))
    assert client.get(LIVE, params=params).status_code == 422


def test_live_unregistered_point_404(client, monkeypatch):
    monkeypatch.setattr(main, "live_rainfall", FakeLive(read=None))
    r = client.get(LIVE, params={"latitude": 1, "longitude": 1})
    assert r.status_code == 404


def test_live_db_failure_is_sanitised_503(client, monkeypatch):
    monkeypatch.setattr(main, "live_rainfall", FakeLive(exc=psycopg2.OperationalError(SECRET)))
    r = client.get(LIVE, params={"latitude": 1, "longitude": 1})
    assert r.status_code == 503
    assert "hunter2" not in r.text


# ---------------------------------------------------------------- rainfall ingest
INGEST = "/api/v1/gis/rainfall/ingest"


def test_ingest_ok(client, monkeypatch):
    repo, cl = FakeRainRepo(), FakeRainClient()
    monkeypatch.setattr(main, "rainfall_repo", repo)
    monkeypatch.setattr(main, "rainfall_client", cl)
    r = client.post(INGEST, json={})
    body = r.json()
    assert r.status_code == 200
    assert body["success"] is True and body["total_units_evaluated"] == 1
    assert body["total_observations_saved"] == 48 and body["total_forecasts_saved"] == 1
    res = body["results"][0]
    assert res["unit_id"] == BATXAT["unit_id"] and res["status"] == "success" and res["observations_stored"] == 48
    assert res["summary"]["rain_24h_acc_mm"] == 24.0 and res["summary"]["quality_flag"] == "good"
    assert cl.calls == [(22.525, 103.855, 7, 2)]  # defaults forwarded
    assert repo.queries == [(None, None)]


def test_ingest_filters_and_options_forwarded(client, monkeypatch):
    repo, cl = FakeRainRepo(), FakeRainClient()
    monkeypatch.setattr(main, "rainfall_repo", repo)
    monkeypatch.setattr(main, "rainfall_client", cl)
    r = client.post(INGEST, json={"area_id": 2, "unit_id": BATXAT["unit_id"], "past_days": 14, "forecast_days": 3})
    assert r.status_code == 200
    assert repo.queries == [(2, BATXAT["unit_id"])]
    assert cl.calls == [(22.525, 103.855, 14, 3)]


@pytest.mark.parametrize("body", [{"past_days": 1, "forecast_days": 1}, {"past_days": 14, "forecast_days": 3}])
def test_ingest_boundaries_pass(client, monkeypatch, body):
    monkeypatch.setattr(main, "rainfall_repo", FakeRainRepo())
    monkeypatch.setattr(main, "rainfall_client", FakeRainClient())
    assert client.post(INGEST, json=body).status_code == 200


@pytest.mark.parametrize("body", [
    {"past_days": 0}, {"past_days": 15}, {"forecast_days": 0}, {"forecast_days": 4},
    {"past_days": "x"}, {"forecast_days": 1.5}, {"area_id": "abc"}, {"unit_id": 5}, {"unit_id": ["a"]},
])
def test_ingest_validation_422(client, monkeypatch, body):
    repo = FakeRainRepo()
    monkeypatch.setattr(main, "rainfall_repo", repo)
    assert client.post(INGEST, json=body).status_code == 422
    assert repo.queries == []


def test_ingest_malformed_json_422(client):
    assert client.post(INGEST, content="{nope", headers={"content-type": "application/json"}).status_code == 422


def test_ingest_no_units_404(client, monkeypatch):
    monkeypatch.setattr(main, "rainfall_repo", FakeRainRepo(units=[]))
    r = client.post(INGEST, json={"unit_id": "NOPE"})
    assert r.status_code == 404


def test_ingest_db_down_returns_500_and_stores_nothing(client, monkeypatch):
    monkeypatch.setattr(main, "rainfall_repo", FakeRainRepo(fail=True))
    cl = FakeRainClient()
    monkeypatch.setattr(main, "rainfall_client", cl)
    r = client.post(INGEST, json={})
    assert r.status_code == 500
    assert cl.calls == []


@pytest.mark.xfail(strict=True, reason="BUG: 500 detail embeds raw str(exception) from the DB driver "
                                       "(host/user/DSN fragments leak to the client); expected generic message")
def test_ingest_db_down_does_not_leak_driver_text(client, monkeypatch):
    monkeypatch.setattr(main, "rainfall_repo", FakeRainRepo(fail=True))
    assert "hunter2" not in client.post(INGEST, json={}).text


def test_ingest_unit_without_coordinates_skipped(client, monkeypatch):
    nocoord = {"unit_id": "U2", "unit_name": "n", "latitude": None, "longitude": None}
    cl = FakeRainClient()
    monkeypatch.setattr(main, "rainfall_repo", FakeRainRepo(units=[nocoord, BATXAT]))
    monkeypatch.setattr(main, "rainfall_client", cl)
    body = client.post(INGEST, json={}).json()
    assert body["total_units_evaluated"] == 2
    assert [r["unit_id"] for r in body["results"]] == [BATXAT["unit_id"]]
    assert len(cl.calls) == 1


def test_ingest_provider_error_reported_per_unit_without_fabricating(client, monkeypatch):
    repo = FakeRainRepo()
    monkeypatch.setattr(main, "rainfall_repo", repo)
    monkeypatch.setattr(main, "rainfall_client", FakeRainClient(exc=RainfallClientError("Open-Meteo API network failure")))
    body = client.post(INGEST, json={}).json()
    assert body["total_observations_saved"] == 0 and body["total_forecasts_saved"] == 0
    assert body["results"] == [{"unit_id": BATXAT["unit_id"], "status": "failed", "error": "Open-Meteo API network failure"}]
    assert repo.obs == [] and repo.fcst == []


def test_ingest_unexpected_error_per_unit(client, monkeypatch):
    repo = FakeRainRepo()
    monkeypatch.setattr(main, "rainfall_repo", repo)
    monkeypatch.setattr(main, "rainfall_client", FakeRainClient(exc=ValueError("boom")))
    res = client.post(INGEST, json={}).json()["results"][0]
    assert res["status"] == "failed" and res["error"] == "boom"


def test_ingest_without_forecast_skips_forecast_save(client, monkeypatch):
    repo = FakeRainRepo()
    monkeypatch.setattr(main, "rainfall_repo", repo)
    monkeypatch.setattr(main, "rainfall_client", FakeRainClient(data=om_series(future_hours=0)))
    body = client.post(INGEST, json={}).json()
    assert body["total_forecasts_saved"] == 0 and repo.fcst == []
    assert body["results"][0]["summary"]["forecast_next_24h_mm"] is None
    assert body["results"][0]["summary"]["quality_flag"] == "missing"


@pytest.mark.xfail(strict=True, reason="BUG: when every unit fails (provider down) the route still answers 200 with "
                                       "success=true; expected success=false or a 502/503")
def test_ingest_all_units_failed_not_reported_as_success(client, monkeypatch):
    monkeypatch.setattr(main, "rainfall_repo", FakeRainRepo())
    monkeypatch.setattr(main, "rainfall_client", FakeRainClient(exc=RainfallClientError("down")))
    r = client.post(INGEST, json={})
    assert r.status_code >= 500 or r.json()["success"] is False


# ---------------------------------------------------------------- rainfall summary
SUMMARY = "/api/v1/gis/rainfall/summary/"


def test_summary_from_db(client, monkeypatch):
    s = {"unit_id": "U", "rain_24h_acc_mm": 3.0}
    cl = FakeRainClient()
    monkeypatch.setattr(main, "rainfall_repo", FakeRainRepo(summary=s))
    monkeypatch.setattr(main, "rainfall_client", cl)
    r = client.get(SUMMARY + "U")
    assert r.status_code == 200 and r.json() == {"success": True, "data": s}
    assert cl.calls == []


def test_summary_missing_triggers_ingest_and_persists(client, monkeypatch):
    repo, cl = FakeRainRepo(), FakeRainClient()
    monkeypatch.setattr(main, "rainfall_repo", repo)
    monkeypatch.setattr(main, "rainfall_client", cl)
    r = client.get(SUMMARY + BATXAT["unit_id"])
    data = r.json()["data"]
    assert r.status_code == 200
    assert data["unit_id"] == BATXAT["unit_id"] and data["rain_24h_acc_mm"] == 24.0 and data["as_of"] == NOW.isoformat()
    assert len(repo.obs) == 1 and len(repo.fcst) == 1


def test_summary_unknown_unit_404(client, monkeypatch):
    monkeypatch.setattr(main, "rainfall_repo", FakeRainRepo())
    r = client.get(SUMMARY + "NOPE")
    assert r.status_code == 404 and "NOPE" in r.json()["detail"]


def test_summary_unit_without_centroid_400(client, monkeypatch):
    u = {"unit_id": "U2", "latitude": None, "longitude": 1.0}
    monkeypatch.setattr(main, "rainfall_repo", FakeRainRepo(units=[u]))
    cl = FakeRainClient()
    monkeypatch.setattr(main, "rainfall_client", cl)
    assert client.get(SUMMARY + "U2").status_code == 400
    assert cl.calls == []


def test_summary_provider_error_500_no_data(client, monkeypatch):
    monkeypatch.setattr(main, "rainfall_repo", FakeRainRepo())
    monkeypatch.setattr(main, "rainfall_client", FakeRainClient(exc=RainfallClientError("down")))
    r = client.get(SUMMARY + BATXAT["unit_id"])
    assert r.status_code == 500 and "data" not in r.json()


def test_summary_db_down_500(client, monkeypatch):
    monkeypatch.setattr(main, "rainfall_repo", FakeRainRepo(fail=True))
    assert client.get(SUMMARY + "U").status_code == 500


@pytest.mark.xfail(strict=True, reason="BUG: 500 detail is raw str(exception); DB driver text leaks to client")
def test_summary_db_down_does_not_leak_driver_text(client, monkeypatch):
    monkeypatch.setattr(main, "rainfall_repo", FakeRainRepo(fail=True))
    assert "hunter2" not in client.get(SUMMARY + "U").text


@pytest.mark.xfail(strict=True, reason="BUG: upstream (weather provider) outage surfaces as 500 'Internal'-style error "
                                       "instead of 502/503 Bad Gateway/Unavailable")
def test_summary_provider_down_is_gateway_error(client, monkeypatch):
    monkeypatch.setattr(main, "rainfall_repo", FakeRainRepo())
    monkeypatch.setattr(main, "rainfall_client", FakeRainClient(exc=RainfallClientError("down")))
    assert client.get(SUMMARY + BATXAT["unit_id"]).status_code in (502, 503, 504)


# ---------------------------------------------------------------- live-sample (direct provider probe)
SAMPLE = "/api/v1/gis/rainfall/live-sample"


def test_live_sample_defaults(client, monkeypatch):
    cl = FakeRainClient()
    monkeypatch.setattr(main, "rainfall_client", cl)
    r = client.get(SAMPLE)
    body = r.json()
    assert r.status_code == 200 and body["success"] is True
    assert body["coordinates"] == {"lat": 22.525, "lon": 103.855}
    assert body["summary"]["unit_id"] == "SAMPLE_PROBE" and body["summary"]["rain_24h_acc_mm"] == 24.0
    assert cl.calls == [(22.525, 103.855, 2, 2)]


def test_live_sample_custom_coords(client, monkeypatch):
    cl = FakeRainClient()
    monkeypatch.setattr(main, "rainfall_client", cl)
    assert client.get(SAMPLE, params={"lat": 10.5, "lon": 106.5}).json()["coordinates"] == {"lat": 10.5, "lon": 106.5}
    assert cl.calls[0][:2] == (10.5, 106.5)


@pytest.mark.parametrize("params", [{"lat": "abc"}, {"lon": "abc"}, {"lat": "", "lon": 1}])
def test_live_sample_wrong_types_422(client, monkeypatch, params):
    monkeypatch.setattr(main, "rainfall_client", FakeRainClient())
    assert client.get(SAMPLE, params=params).status_code == 422


def test_live_sample_provider_error_500_no_summary(client, monkeypatch):
    monkeypatch.setattr(main, "rainfall_client", FakeRainClient(exc=RainfallClientError("down")))
    r = client.get(SAMPLE)
    assert r.status_code == 500 and "summary" not in r.json()


@pytest.mark.xfail(strict=True, reason="BUG: lat/lon not range-validated (live route uses ge/le); lat=999 is forwarded "
                                       "to the upstream provider and answered 200 instead of 422")
def test_live_sample_out_of_range_coords_rejected(client, monkeypatch):
    monkeypatch.setattr(main, "rainfall_client", FakeRainClient())
    assert client.get(SAMPLE, params={"lat": 999, "lon": 999}).status_code == 422
