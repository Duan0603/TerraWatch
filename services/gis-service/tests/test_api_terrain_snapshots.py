"""HTTP-level tests (fastapi TestClient) for terrain and snapshot routes of app/main.py.

Fake-repository tests need no DB; the test_db_* tests use the throwaway PostGIS configured via
POSTGRES_* (same as the existing DB tests) and skip when it is unreachable. They clean up after themselves.
"""
import math
from datetime import datetime, timezone, timedelta

import numpy as np
import psycopg2
import pytest

from api_fakes import (BATXAT, SECRET, FakeElevClient, FakeSnapRepo, FakeTerrainRepo)
from app import main
from app.pipeline.terrain_repository import TerrainRepository

pytestmark = pytest.mark.usefixtures("frozen_rain")

EXTRACT = "/api/v1/gis/terrain/extract"
TERRAIN = "/api/v1/gis/terrain/"
CREATE = "/api/v1/gis/snapshots/create"
SNAP = "/api/v1/gis/snapshots/"
AS_OF = "2031-03-04T05:00:00Z"


def test_extract_ok(client, monkeypatch):
    repo, el = FakeTerrainRepo(), FakeElevClient()
    monkeypatch.setattr(main, "terrain_repo", repo)
    monkeypatch.setattr(main, "terrain_client", el)
    r = client.post(EXTRACT, json={})
    body = r.json()
    assert r.status_code == 200 and body["success"] is True and body["total_processed"] == 1
    u = body["units"][0]
    assert u["unit_id"] == BATXAT["unit_id"] and u["success"] is True and u["dem_source"] == "COPERNICUS_GLO_30"
    assert u["relief_m"] == 60.0 and u["elevation_avg"] == 730.0 and u["slope_max"] >= u["slope_avg"] > 0
    assert el.calls == [(22.525, 103.855, 5, 0.0003)]
    assert len(repo.updates) == 1 and repo.updates[0][0] == BATXAT["unit_id"]


def test_extract_forwards_options_and_labels_dem_source(client, monkeypatch):
    repo, el = FakeTerrainRepo(), FakeElevClient()
    monkeypatch.setattr(main, "terrain_repo", repo)
    monkeypatch.setattr(main, "terrain_client", el)
    r = client.post(EXTRACT, json={"area_id": 2, "unit_ids": ["A"], "grid_size": 7, "step_deg": 0.001, "dem_source": "MY_DEM"})
    assert r.status_code == 200 and r.json()["units"][0]["dem_source"] == "MY_DEM"
    assert repo.queries == [(2, ["A"])] and el.calls == [(22.525, 103.855, 7, 0.001)]


def test_extract_fallback_dem_is_labelled_not_passed_off_as_requested_source(client, monkeypatch):
    monkeypatch.setattr(main, "terrain_repo", FakeTerrainRepo())
    monkeypatch.setattr(main, "terrain_client", FakeElevClient(source="FALLBACK_SYNTHETIC"))
    u = client.post(EXTRACT, json={"dem_source": "COPERNICUS_GLO_30"}).json()["units"][0]
    assert u["dem_source"] == "FALLBACK_SYNTHETIC"


def test_extract_real_client_provider_down_falls_back_to_labelled_synthetic(client, monkeypatch):
    """Current (documented) behaviour: elevation outage => synthetic grid persisted, labelled FALLBACK_SYNTHETIC."""
    import app.pipeline.terrain_client as tc
    monkeypatch.setattr(tc.requests, "get", lambda *a, **k: (_ for _ in ()).throw(tc.requests.ConnectionError("down")))
    monkeypatch.setattr(tc.time, "sleep", lambda s: None)
    repo = FakeTerrainRepo()
    monkeypatch.setattr(main, "terrain_repo", repo)
    monkeypatch.setattr(main, "terrain_client", tc.OpenMeteoElevationClient(max_retries=2))
    r = client.post(EXTRACT, json={"grid_size": 4})
    assert r.status_code == 200
    assert r.json()["units"][0]["dem_source"] == "FALLBACK_SYNTHETIC"
    assert repo.updates[0][1].dem_source == "FALLBACK_SYNTHETIC"


def test_extract_real_client_ok_path_with_mocked_http(client, monkeypatch):
    import app.pipeline.terrain_client as tc

    class Resp:
        def raise_for_status(self): pass
        def json(self): return {"elevation": [float(100 + i) for i in range(9)]}

    monkeypatch.setattr(tc.requests, "get", lambda *a, **k: Resp())
    monkeypatch.setattr(main, "terrain_repo", FakeTerrainRepo())
    monkeypatch.setattr(main, "terrain_client", tc.OpenMeteoElevationClient())
    r = client.post(EXTRACT, json={"grid_size": 3})
    assert r.status_code == 200 and r.json()["units"][0]["dem_source"] == "COPERNICUS_GLO_30"
    assert r.json()["units"][0]["relief_m"] == 8.0


@pytest.mark.parametrize("n", [3, 11])
def test_extract_grid_size_boundaries_pass(client, monkeypatch, n):
    monkeypatch.setattr(main, "terrain_repo", FakeTerrainRepo())
    el = FakeElevClient()
    monkeypatch.setattr(main, "terrain_client", el)
    assert client.post(EXTRACT, json={"grid_size": n}).status_code == 200
    assert el.calls[0][2] == n


@pytest.mark.parametrize("body", [
    {"grid_size": 2}, {"grid_size": 12}, {"grid_size": 0}, {"grid_size": -3}, {"grid_size": "x"}, {"grid_size": 3.5},
    {"step_deg": "x"}, {"area_id": "x"}, {"unit_ids": "A"}, {"unit_ids": [1, {}]}, {"dem_source": 5},
])
def test_extract_validation_422(client, monkeypatch, body):
    repo = FakeTerrainRepo()
    monkeypatch.setattr(main, "terrain_repo", repo)
    assert client.post(EXTRACT, json=body).status_code == 422
    assert repo.queries == []


def test_extract_no_units_404(client, monkeypatch):
    monkeypatch.setattr(main, "terrain_repo", FakeTerrainRepo(units=[]))
    assert client.post(EXTRACT, json={"unit_ids": ["NOPE"]}).status_code == 404


def test_extract_unit_without_centroid_skipped(client, monkeypatch):
    bad = {"unit_id": "U2", "centroid_lat": None, "centroid_lon": 1.0}
    repo = FakeTerrainRepo(units=[bad, BATXAT])
    monkeypatch.setattr(main, "terrain_repo", repo)
    monkeypatch.setattr(main, "terrain_client", FakeElevClient())
    body = client.post(EXTRACT, json={}).json()
    assert body["total_processed"] == 1 and [u["unit_id"] for u in body["units"]] == [BATXAT["unit_id"]]


def test_extract_update_reports_false_when_row_missing(client, monkeypatch):
    monkeypatch.setattr(main, "terrain_repo", FakeTerrainRepo(update_ok=False))
    monkeypatch.setattr(main, "terrain_client", FakeElevClient())
    assert client.post(EXTRACT, json={}).json()["units"][0]["success"] is False


def test_extract_db_down_500(client, monkeypatch):
    monkeypatch.setattr(main, "terrain_repo", FakeTerrainRepo(fail=True))
    assert client.post(EXTRACT, json={}).status_code == 500


@pytest.mark.xfail(strict=True, reason="BUG: 500 detail is raw str(exception); DB driver text leaks to client")
def test_extract_db_down_does_not_leak_driver_text(client, monkeypatch):
    monkeypatch.setattr(main, "terrain_repo", FakeTerrainRepo(fail=True))
    assert "hunter2" not in client.post(EXTRACT, json={}).text


def test_extract_all_nodata_grid_500(client, monkeypatch):
    class NoData(FakeElevClient):
        def fetch_grid_around_point(self, center_lat, center_lon, grid_size, step_deg):
            return np.full((grid_size, grid_size), -9999.0), step_deg, "COPERNICUS_GLO_30"
    repo = FakeTerrainRepo()
    monkeypatch.setattr(main, "terrain_repo", repo)
    monkeypatch.setattr(main, "terrain_client", NoData())
    r = client.post(EXTRACT, json={})
    assert r.status_code == 500 and repo.updates == []  # nothing persisted for invalid DEM


TERRAIN = "/api/v1/gis/terrain/"


def test_terrain_summary_ok(client, monkeypatch):
    s = {"unit_id": "U", "slope_avg": 1.5}
    monkeypatch.setattr(main, "terrain_repo", FakeTerrainRepo(summary=s))
    r = client.get(TERRAIN + "U")
    assert r.status_code == 200 and r.json() == {"success": True, "data": s}


def test_terrain_summary_unknown_404(client, monkeypatch):
    monkeypatch.setattr(main, "terrain_repo", FakeTerrainRepo(summary=None))
    r = client.get(TERRAIN + "NOPE")
    assert r.status_code == 404 and "NOPE" in r.json()["detail"]


def test_terrain_summary_db_down_500(client, monkeypatch):
    monkeypatch.setattr(main, "terrain_repo", FakeTerrainRepo(fail=True))
    assert client.get(TERRAIN + "U").status_code == 500


@pytest.mark.xfail(strict=True, reason="BUG: 500 detail is raw str(exception); DB driver text leaks to client")
def test_terrain_summary_db_down_does_not_leak_driver_text(client, monkeypatch):
    monkeypatch.setattr(main, "terrain_repo", FakeTerrainRepo(fail=True))
    assert "hunter2" not in client.get(TERRAIN + "U").text


def test_terrain_get_extract_path_is_treated_as_unit_id(client, monkeypatch):
    """/terrain/extract only exists for POST; GET falls into /terrain/{unit_id}."""
    monkeypatch.setattr(main, "terrain_repo", FakeTerrainRepo(summary=None))
    assert client.get(EXTRACT).status_code == 404


def test_create_snapshots_ok(client, snap_env):
    r = client.post(CREATE, json={"as_of_time": AS_OF})
    body = r.json()
    assert r.status_code == 200 and body["success"] is True and body["total_created"] == 2
    s = body["snapshots"][0]
    assert s["snapshot_id"].startswith("00000000-") and s["unit_id"] == BATXAT["unit_id"]
    assert s["as_of_time"] == "2031-03-04T05:00:00+00:00" and s["coverage_quality"] == "good"
    f = s["features"]
    assert f["rain_1h_mm"] == 1.0 and f["rain_24h_acc_mm"] == 24.0 and f["rain_7d_acc_mm"] == 168.0
    assert f["forecast_next_24h_mm"] == 12.5 and f["slope_avg"] == 30.0
    assert [d["schema_version"] for d in snap_env.saved] == ["rainfall-terrain-24h.v1"] * 2


def test_create_snapshot_default_as_of_is_current_utc_hour(client, snap_env, monkeypatch):
    class Frozen(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2031, 3, 4, 5, 47, 12, tzinfo=timezone.utc)
    monkeypatch.setattr(main, "datetime", Frozen)
    r = client.post(CREATE, json={})
    assert r.status_code == 200
    assert r.json()["snapshots"][0]["as_of_time"] == "2031-03-04T05:00:00+00:00"


def test_create_snapshot_schema_version_and_naive_time_treated_as_utc(client, snap_env):
    r = client.post(CREATE, json={"as_of_time": "2031-03-04T05:00:00", "schema_version": "custom.v9"})
    assert r.status_code == 200
    assert snap_env.saved[0]["schema_version"] == "custom.v9"
    assert r.json()["snapshots"][0]["as_of_time"] == "2031-03-04T05:00:00+00:00"


def test_create_snapshot_offset_time_normalised_to_utc(client, snap_env):
    r = client.post(CREATE, json={"as_of_time": "2031-03-04T12:00:00+07:00"})
    assert r.json()["snapshots"][0]["as_of_time"] == "2031-03-04T05:00:00+00:00"


@pytest.mark.parametrize("body", [
    {"unit_ids": "A"}, {"unit_ids": [1]}, {"area_id": "x"}, {"as_of_time": 5}, {"as_of_time": ["x"]}, {"schema_version": 1},
])
def test_create_snapshot_validation_422(client, snap_env, body):
    assert client.post(CREATE, json=body).status_code == 422
    assert snap_env.saved == []


def test_create_snapshot_no_units_404(client, monkeypatch):
    monkeypatch.setattr(main, "terrain_repo", FakeTerrainRepo(units=[]))
    repo = FakeSnapRepo()
    monkeypatch.setattr(main, "snapshot_repo", repo)
    assert client.post(CREATE, json={"unit_ids": ["NOPE"]}).status_code == 404
    assert repo.saved == []


def test_create_snapshot_db_down_500_nothing_saved(client, snap_env):
    snap_env.fail = True
    assert client.post(CREATE, json={"as_of_time": AS_OF}).status_code == 500
    assert snap_env.saved == []


@pytest.mark.xfail(strict=True, reason="BUG: 500 detail is raw str(exception); DB driver text leaks to client")
def test_create_snapshot_db_down_does_not_leak_driver_text(client, snap_env):
    snap_env.fail = True
    assert "hunter2" not in client.post(CREATE, json={"as_of_time": AS_OF}).text


@pytest.mark.xfail(strict=True, reason="BUG: unparseable as_of_time ('garbage') is client input error but yields 500 "
                                       "(ValueError text echoed); expected 400/422")
def test_create_snapshot_bad_as_of_time_is_client_error(client, snap_env):
    assert client.post(CREATE, json={"as_of_time": "garbage"}).status_code in (400, 422)


def test_latest_snapshot_ok(client, monkeypatch):
    snap = {"snapshot_id": "x", "unit_id": "U", "features": {}}
    monkeypatch.setattr(main, "snapshot_repo", FakeSnapRepo(latest=snap))
    r = client.get(SNAP + "latest/U")
    assert r.status_code == 200 and r.json() == {"success": True, "data": snap}


def test_latest_snapshot_unknown_unit_404(client, monkeypatch):
    monkeypatch.setattr(main, "snapshot_repo", FakeSnapRepo())
    r = client.get(SNAP + "latest/NOPE")
    assert r.status_code == 404 and "NOPE" in r.json()["detail"]


def test_latest_snapshot_db_down_500(client, monkeypatch):
    monkeypatch.setattr(main, "snapshot_repo", FakeSnapRepo(fail=True))
    assert client.get(SNAP + "latest/U").status_code == 500


@pytest.mark.xfail(strict=True, reason="BUG: 500 detail is raw str(exception); DB driver text leaks to client")
def test_latest_snapshot_db_down_does_not_leak_driver_text(client, monkeypatch):
    monkeypatch.setattr(main, "snapshot_repo", FakeSnapRepo(fail=True))
    assert "hunter2" not in client.get(SNAP + "latest/U").text


def test_snapshot_by_id_ok(client, monkeypatch):
    snap = {"snapshot_id": "11111111-1111-1111-1111-111111111111", "unit_id": "U"}
    monkeypatch.setattr(main, "snapshot_repo", FakeSnapRepo(by_id=snap))
    r = client.get(SNAP + snap["snapshot_id"])
    assert r.status_code == 200 and r.json() == {"success": True, "data": snap}


def test_snapshot_by_id_unknown_404(client, monkeypatch):
    monkeypatch.setattr(main, "snapshot_repo", FakeSnapRepo())
    r = client.get(SNAP + "22222222-2222-2222-2222-222222222222")
    assert r.status_code == 404


def test_snapshot_by_id_db_down_500(client, monkeypatch):
    monkeypatch.setattr(main, "snapshot_repo", FakeSnapRepo(fail=True))
    assert client.get(SNAP + "22222222-2222-2222-2222-222222222222").status_code == 500


@pytest.mark.xfail(strict=True, reason="BUG: 500 detail is raw str(exception); DB driver text leaks to client")
def test_snapshot_by_id_db_down_does_not_leak_driver_text(client, monkeypatch):
    monkeypatch.setattr(main, "snapshot_repo", FakeSnapRepo(fail=True))
    assert "hunter2" not in client.get(SNAP + "22222222-2222-2222-2222-222222222222").text


# ---------------------------------------------------------------- real PostGIS (skipped if unreachable)


def test_db_terrain_summary_seeded_unit(client, db):
    r = client.get(TERRAIN + "VN_LC_BATXAT_0001")
    d = r.json()["data"]
    assert r.status_code == 200 and d["unit_id"] == "VN_LC_BATXAT_0001"
    assert math.isclose(d["centroid_lat"], 22.525, abs_tol=1e-6) and math.isclose(d["centroid_lon"], 103.855, abs_tol=1e-6)


def test_db_terrain_summary_unknown_404(client, db):
    assert client.get(TERRAIN + "NO_SUCH_UNIT").status_code == 404


def test_db_snapshot_create_roundtrip_and_cleanup(client, db):
    unit, as_of = "VN_LC_BATXAT_0001", "2031-03-04T05:00:00Z"
    try:
        r = client.post(CREATE, json={"unit_ids": [unit], "as_of_time": as_of})
        assert r.status_code == 200 and r.json()["total_created"] == 1
        sid = r.json()["snapshots"][0]["snapshot_id"]
        by_id = client.get(SNAP + sid)
        assert by_id.status_code == 200 and by_id.json()["data"]["unit_id"] == unit
        latest = client.get(SNAP + "latest/" + unit)
        assert latest.status_code == 200 and latest.json()["data"]["unit_id"] == unit
        # idempotent: same (unit, version, as_of, schema) returns same id
        again = client.post(CREATE, json={"unit_ids": [unit], "as_of_time": as_of})
        assert again.json()["snapshots"][0]["snapshot_id"] == sid
    finally:
        with db.cursor() as cur:
            cur.execute("DELETE FROM gis_schema.feature_snapshots WHERE as_of_time = %s", (as_of,))
        db.commit()


def test_db_snapshot_unknown_unit_filter_404(client, db):
    assert client.post(CREATE, json={"unit_ids": ["NO_SUCH_UNIT"]}).status_code == 404


def test_db_latest_snapshot_unknown_unit_404(client, db):
    assert client.get(SNAP + "latest/NO_SUCH_UNIT").status_code == 404


def test_db_snapshot_by_id_unknown_uuid_404(client, db):
    assert client.get(SNAP + "33333333-3333-3333-3333-333333333333").status_code == 404


@pytest.mark.xfail(strict=True, reason="BUG: non-UUID snapshot id reaches the uuid column -> psycopg2 DataError -> 500; "
                                       "expected 404/422")
def test_db_snapshot_by_id_malformed_uuid_is_client_error(client, db):
    assert client.get(SNAP + "not-a-uuid").status_code in (404, 422)


def test_db_unreachable_gives_500(client, monkeypatch):
    bad = TerrainRepository(db_url="postgresql://x:y@127.0.0.1:1/none")  # closed port, refused immediately
    monkeypatch.setattr(main, "terrain_repo", bad)
    assert client.get(TERRAIN + "U").status_code == 500
    assert client.post(EXTRACT, json={}).status_code == 500
