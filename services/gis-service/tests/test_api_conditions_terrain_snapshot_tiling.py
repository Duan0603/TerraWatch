"""Terrain / snapshot / tiling / mvt HTTP conditions from docs/test-cases/test-conditions.csv that no older test asserts.

Condition IDs (PY-GIS-*) are in test names, parametrize ids or comments. In-memory fakes only; no DB, no network.
"""
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

from api_fakes import BATXAT, SECRET, FakeElevClient, FakeSnapRepo, FakeTerrainRepo
from app import main

pytestmark = pytest.mark.usefixtures("frozen_rain")

EXTRACT = "/api/v1/gis/terrain/extract"
TERRAIN = "/api/v1/gis/terrain/"
CREATE = "/api/v1/gis/snapshots/create"
SNAP = "/api/v1/gis/snapshots/"
TILING = "/api/v1/gis/tiling"
GENERIC_500 = {"detail": "Internal server error."}
UUID_A = "11111111-1111-1111-1111-111111111111"

JSON_CT = {"content-type": "application/json"}
NOT_AN_OBJECT = [(None, {}), ("null", JSON_CT), ("[]", JSON_CT), ('{"area_id": 1}', {"content-type": "text/plain"})]
NOT_AN_OBJECT_IDS = ["no-body", "json-null", "json-array", "wrong-content-type"]


class RecTerrainRepo(FakeTerrainRepo):
    def __init__(self, **kw):
        super().__init__(**kw)
        self.asked = []

    def get_terrain_summary(self, unit_id):
        self.asked.append(unit_id)
        return super().get_terrain_summary(unit_id)


class RecSnapRepo(FakeSnapRepo):
    def __init__(self, **kw):
        super().__init__(**kw)
        self.asked_latest, self.asked_id = [], []

    def get_latest_snapshot(self, unit_id):
        self.asked_latest.append(unit_id)
        return super().get_latest_snapshot(unit_id)

    def get_snapshot_by_id(self, sid):
        self.asked_id.append(sid)
        return super().get_snapshot_by_id(sid)


# ---------------------------------------------------------------- sanitised 5xx for every dependency failure (P0)
class UpdateFails(FakeTerrainRepo):
    def update_terrain_metrics(self, unit_id, metrics):
        raise RuntimeError(SECRET)


class TerrainReadFails(FakeTerrainRepo):
    def get_terrain_summary(self, unit_id):
        raise RuntimeError(SECRET)


class ObsFails(FakeSnapRepo):
    def get_observations_as_of(self, unit_id, as_of_time, days_back=7):
        raise RuntimeError(SECRET)


class LatestFails(FakeSnapRepo):
    def get_latest_snapshot(self, unit_id):
        raise RuntimeError(SECRET)


class ByIdFails(FakeSnapRepo):
    def get_snapshot_by_id(self, sid):
        raise RuntimeError(SECRET)


DEP_FAILURES = {
    "PY-GIS-025-elevation-client": ("post", EXTRACT, {"terrain_repo": FakeTerrainRepo(), "terrain_client": FakeElevClient(exc=RuntimeError(SECRET))}),
    "PY-GIS-025-metrics-write": ("post", EXTRACT, {"terrain_repo": UpdateFails(), "terrain_client": FakeElevClient()}),
    "PY-GIS-029-terrain-read": ("get", TERRAIN + "U", {"terrain_repo": TerrainReadFails()}),
    "PY-GIS-034-snapshot-inputs": ("post", CREATE, {"terrain_repo": FakeTerrainRepo(), "snapshot_repo": ObsFails()}),
    "PY-GIS-038-latest-read": ("get", SNAP + "latest/U", {"snapshot_repo": LatestFails()}),
    "PY-GIS-043-by-id-read": ("get", SNAP + UUID_A, {"snapshot_repo": ByIdFails()}),
}


@pytest.mark.parametrize("verb,url,deps", list(DEP_FAILURES.values()), ids=list(DEP_FAILURES))
def test_dependency_failure_is_generic_500_with_no_internals(client, monkeypatch, verb, url, deps):
    for name, fake in deps.items():
        monkeypatch.setattr(main, name, fake)
    r = getattr(client, verb)(url, **({"json": {}} if verb == "post" else {}))
    assert r.status_code == 500
    assert r.json() == GENERIC_500
    assert "10.0.0.9" not in r.text and "password" not in r.text


def test_py_gis_025_extract_failure_midway_returns_500_and_keeps_earlier_units_only(client, monkeypatch):
    """No partial 200: the failing unit turns the whole call into 500; earlier writes are not reported as success."""
    second = {**BATXAT, "unit_id": "U2"}
    calls = []

    class Flaky(FakeElevClient):
        def fetch_grid_around_point(self, center_lat, center_lon, grid_size, step_deg):
            calls.append(1)
            if len(calls) == 2:
                raise RuntimeError(SECRET)
            return super().fetch_grid_around_point(center_lat, center_lon, grid_size, step_deg)

    repo = FakeTerrainRepo(units=[BATXAT, second])
    monkeypatch.setattr(main, "terrain_repo", repo)
    monkeypatch.setattr(main, "terrain_client", Flaky())
    r = client.post(EXTRACT, json={})
    assert r.status_code == 500 and r.json() == GENERIC_500
    assert [u for u, _ in repo.updates] == [BATXAT["unit_id"]]


# ---------------------------------------------------------------- terrain extract: PY-GIS-024/026/068-082
@pytest.mark.parametrize("content,headers", NOT_AN_OBJECT, ids=[f"PY-GIS-026-{i}" for i in NOT_AN_OBJECT_IDS])
def test_extract_body_must_be_a_json_object(client, monkeypatch, content, headers):
    """CSV 026 says 'missing required parameter => 422'; every field is optional, so only a non-object body is rejected."""
    repo = FakeTerrainRepo()
    monkeypatch.setattr(main, "terrain_repo", repo)
    assert client.post(EXTRACT, content=content, headers=headers).status_code == 422
    assert repo.queries == []


def test_py_gis_024_extract_response_contract_for_two_units(client, monkeypatch):
    second = {**BATXAT, "unit_id": "U2", "unit_name": "Unit 2", "centroid_lat": 22.6, "centroid_lon": 103.9}
    repo, el = FakeTerrainRepo(units=[BATXAT, second]), FakeElevClient()
    monkeypatch.setattr(main, "terrain_repo", repo)
    monkeypatch.setattr(main, "terrain_client", el)
    body = client.post(EXTRACT, json={"grid_size": 3}).json()
    assert set(body) == {"success", "message", "total_processed", "units"}
    assert body["message"] == "Successfully extracted terrain features for 2 assessment units."
    assert body["total_processed"] == 2 == len(body["units"])
    assert [u["unit_id"] for u in body["units"]] == [BATXAT["unit_id"], "U2"]
    assert all(set(u) == {"unit_id", "unit_name", "success", "elevation_avg", "slope_avg", "slope_max", "relief_m", "dem_source"}
               for u in body["units"])
    assert [c[:2] for c in el.calls] == [(22.525, 103.855), (22.6, 103.9)]  # each unit sampled at its own centroid
    assert [u for u, _ in repo.updates] == [BATXAT["unit_id"], "U2"]


@pytest.mark.parametrize("body,expected", [
    ({"area_id": None}, (None, None)),                                   # PY-GIS-068/070 explicit null = no filter
    ({"area_id": 0}, (0, None)),                                         # PY-GIS-070 zero is a value
    ({"area_id": "3"}, (3, None)),                                       # PY-GIS-069 numeric string coerced
    ({"unit_ids": None}, (None, None)),                                  # PY-GIS-071/073
    ({"unit_ids": []}, (None, [])),                                      # PY-GIS-073 empty list forwarded as-is
    ({"unit_ids": ["B", "A", "A"]}, (None, ["B", "A", "A"])),            # PY-GIS-073 order and duplicates untouched
], ids=["PY-GIS-068-area-null", "PY-GIS-070-area-zero", "PY-GIS-069-area-numeric-string", "PY-GIS-071-ids-null",
        "PY-GIS-073-ids-empty", "PY-GIS-073-ids-duplicates"])
def test_extract_optional_filters_forwarded_exactly(client, monkeypatch, body, expected):
    repo = FakeTerrainRepo()
    monkeypatch.setattr(main, "terrain_repo", repo)
    monkeypatch.setattr(main, "terrain_client", FakeElevClient())
    assert client.post(EXTRACT, json=body).status_code == 200
    assert repo.queries == [expected]


@pytest.mark.parametrize("body", [
    {"area_id": 1.5}, {"area_id": []}, {"unit_ids": [None]}, {"unit_ids": {"a": 1}},
    {"grid_size": None}, {"grid_size": True}, {"grid_size": [5]},
    {"step_deg": None}, {"step_deg": "fast"}, {"step_deg": [0.1]},
    {"dem_source": None}, {"dem_source": ["SRTM"]},
], ids=["PY-GIS-069-area-fraction", "PY-GIS-069-area-list", "PY-GIS-072-ids-null-item", "PY-GIS-072-ids-object",
        "PY-GIS-075-grid-null", "PY-GIS-076-grid-bool", "PY-GIS-075-grid-list",
        "PY-GIS-078-step-null", "PY-GIS-078-step-word", "PY-GIS-078-step-list",
        "PY-GIS-081-dem-null", "PY-GIS-081-dem-list"])
def test_extract_field_type_errors_422_without_touching_dependencies(client, monkeypatch, body):
    repo, el = FakeTerrainRepo(), FakeElevClient()
    monkeypatch.setattr(main, "terrain_repo", repo)
    monkeypatch.setattr(main, "terrain_client", el)
    assert client.post(EXTRACT, json=body).status_code == 422
    assert repo.queries == [] and el.calls == []


@pytest.mark.parametrize("sent,forwarded", [("5", 5), (4, 4), (10, 10)],
                         ids=["PY-GIS-075-numeric-string", "PY-GIS-076-even-forwarded-to-client", "PY-GIS-076-even-upper"])
def test_extract_grid_size_coercion_and_even_sizes_reach_client(client, monkeypatch, sent, forwarded):
    monkeypatch.setattr(main, "terrain_repo", FakeTerrainRepo())
    el = FakeElevClient()
    monkeypatch.setattr(main, "terrain_client", el)
    assert client.post(EXTRACT, json={"grid_size": sent}).status_code == 200
    assert el.calls[0][2] == forwarded


@pytest.mark.parametrize("step", [0, -0.0003], ids=["PY-GIS-079-zero", "PY-GIS-079-negative"])
@pytest.mark.xfail(strict=True, reason="BUG: expected step_deg <= 0 to be rejected with 422 (a zero/negative grid step is "
                                       "meaningless and yields divide-by-zero slopes); actual: 200 and the garbage metrics "
                                       "(e.g. slope_avg 90.0 for step_deg=0) are persisted via update_terrain_metrics.")
def test_py_gis_079_extract_rejects_non_positive_step_deg(client, monkeypatch, step):
    repo = FakeTerrainRepo()
    monkeypatch.setattr(main, "terrain_repo", repo)
    monkeypatch.setattr(main, "terrain_client", FakeElevClient())
    assert client.post(EXTRACT, json={"step_deg": step}).status_code == 422
    assert repo.updates == []


@pytest.mark.parametrize("label", ["SRTM_30M", "Ô DEM v2", "x" * 100], ids=["name", "unicode", "max-length"])
def test_py_gis_082_dem_source_label_is_used_verbatim_when_live_fetch_succeeds(client, monkeypatch, label):
    repo = FakeTerrainRepo()
    monkeypatch.setattr(main, "terrain_repo", repo)
    monkeypatch.setattr(main, "terrain_client", FakeElevClient())
    assert client.post(EXTRACT, json={"dem_source": label}).json()["units"][0]["dem_source"] == label
    assert repo.updates[0][1].dem_source == label


@pytest.mark.xfail(strict=True, reason="BUG: expected 422 for a dem_source that is empty or longer than 100 characters "
                                       "(provenance label; column dem_source is VARCHAR(100)); actual: 200 and the value is "
                                       "handed to update_terrain_metrics unchanged.")
@pytest.mark.parametrize("label", ["", "x" * 101], ids=["PY-GIS-082-empty", "PY-GIS-082-too-long"])
def test_py_gis_082_extract_rejects_empty_or_oversized_dem_source(client, monkeypatch, label):
    repo = FakeTerrainRepo()
    monkeypatch.setattr(main, "terrain_repo", repo)
    monkeypatch.setattr(main, "terrain_client", FakeElevClient())
    assert client.post(EXTRACT, json={"dem_source": label}).status_code == 422
    assert repo.updates == []


# ---------------------------------------------------------------- terrain GET: PY-GIS-030/031
@pytest.mark.parametrize("raw,decoded", [("U%201", "U 1"), ("%C3%94-1", "Ô-1"), ("12345", "12345"), ("%3Cb%3E", "<b>")],
                         ids=["space", "unicode", "numeric", "markup"])
def test_py_gis_031_terrain_unit_id_is_any_string_passed_verbatim(client, monkeypatch, raw, decoded):
    """CSV expects 422 for a wrong-typed unit_id; it is a plain str path segment, so it is looked up as-is (404 if unknown)."""
    repo = RecTerrainRepo()
    monkeypatch.setattr(main, "terrain_repo", repo)
    assert client.get(TERRAIN + raw).status_code == 404
    assert repo.asked == [decoded]


def test_py_gis_030_terrain_without_unit_id_is_route_not_found(client, monkeypatch):
    repo = RecTerrainRepo()
    monkeypatch.setattr(main, "terrain_repo", repo)
    assert client.get(TERRAIN, follow_redirects=False).status_code == 404
    assert repo.asked == []


# ---------------------------------------------------------------- snapshot create: PY-GIS-035/036/083-094
@pytest.mark.parametrize("content,headers", NOT_AN_OBJECT, ids=[f"PY-GIS-035-{i}" for i in NOT_AN_OBJECT_IDS])
def test_create_snapshot_body_must_be_a_json_object(client, snap_env, content, headers):
    """CSV 035 says 'missing required parameter => 422'; every field is optional, so only a non-object body is rejected."""
    assert client.post(CREATE, content=content, headers=headers).status_code == 422
    assert snap_env.saved == []


def test_create_snapshot_filters_forwarded_to_unit_lookup(client, snap_env, monkeypatch):
    """PY-GIS-083/086: unit_ids and area_id reach the repository untouched."""
    repo = FakeTerrainRepo(units=[BATXAT])
    monkeypatch.setattr(main, "terrain_repo", repo)
    assert client.post(CREATE, json={"area_id": 3, "unit_ids": ["B", "A"], "as_of_time": "2031-03-04T05:00:00Z"}).status_code == 200
    assert repo.queries == [(3, ["B", "A"])]


@pytest.mark.parametrize("body,expected", [
    ({"area_id": None, "unit_ids": None}, (None, None)),       # PY-GIS-083/086 explicit null = no filter
    ({"unit_ids": []}, (None, [])),                            # PY-GIS-085 empty list forwarded as-is
    ({"area_id": 0}, (0, None)),                               # PY-GIS-088 zero is a value
], ids=["PY-GIS-083-null-filters", "PY-GIS-085-empty-ids", "PY-GIS-088-area-zero"])
def test_create_snapshot_optional_filter_edge_values(client, snap_env, monkeypatch, body, expected):
    repo = FakeTerrainRepo(units=[BATXAT])
    monkeypatch.setattr(main, "terrain_repo", repo)
    assert client.post(CREATE, json={**body, "as_of_time": "2031-03-04T05:00:00Z"}).status_code == 200
    assert repo.queries == [expected]


@pytest.mark.parametrize("body", [
    {"unit_ids": [None]}, {"unit_ids": {"a": 1}}, {"area_id": 1.5}, {"area_id": []},
    {"as_of_time": True}, {"as_of_time": 20310304}, {"schema_version": None}, {"schema_version": ["v1"]},
], ids=["PY-GIS-084-null-item", "PY-GIS-084-object", "PY-GIS-087-fraction", "PY-GIS-087-list",
        "PY-GIS-090-bool", "PY-GIS-090-number", "PY-GIS-093-null", "PY-GIS-093-list"])
def test_create_snapshot_field_type_errors_422_before_any_lookup(client, snap_env, monkeypatch, body):
    repo = FakeTerrainRepo()
    monkeypatch.setattr(main, "terrain_repo", repo)
    assert client.post(CREATE, json=body).status_code == 422
    assert repo.queries == [] and snap_env.saved == []


@pytest.mark.parametrize("value", ["garbage", "2031-03-04T25:00:00Z", "2031-13-01", "2031-03-04 05:00:00 UTC", "   "],
                         ids=["words", "hour-25", "month-13", "trailing-zone-name", "blank"])
def test_py_gis_091_unparseable_as_of_time_is_422_with_detail_and_nothing_read_or_saved(client, snap_env, value):
    """Changed behaviour: unparseable as_of_time is exactly 422 (older test accepts 400 or 422)."""
    r = client.post(CREATE, json={"as_of_time": value})
    assert r.status_code == 422
    assert r.json() == {"detail": "as_of_time is not a valid ISO-8601 timestamp."}
    assert snap_env.asof_seen == [] and snap_env.saved == []


@pytest.mark.parametrize("value,expected", [
    ("2031-03-04", "2031-03-04T00:00:00+00:00"),                    # date only = midnight UTC
    ("2031-03-04T05:00:00.250000Z", "2031-03-04T05:00:00.250000+00:00"),   # sub-second kept
    ("20310304T050000Z", "2031-03-04T05:00:00+00:00"),              # compact ISO accepted
    ("2031-03-03T23:00:00-06:00", "2031-03-04T05:00:00+00:00"),     # negative offset normalised
], ids=["date-only", "subsecond", "compact", "negative-offset"])
def test_py_gis_091_valid_iso_variants_are_normalised_to_utc(client, snap_env, value, expected):
    r = client.post(CREATE, json={"as_of_time": value})
    assert r.status_code == 200
    assert r.json()["snapshots"][0]["as_of_time"] == expected
    assert snap_env.saved[0]["as_of_time"] == expected


@pytest.mark.xfail(strict=True, reason="BUG: expected 422 for a schema_version that is empty or longer than 50 characters "
                                       "(column schema_version is VARCHAR(50) and part of the unique key); actual: 200 and the "
                                       "snapshot is built and handed to save_snapshot with that value.")
@pytest.mark.parametrize("version", ["", "v" * 51], ids=["PY-GIS-094-empty", "PY-GIS-094-too-long"])
def test_py_gis_094_create_snapshot_rejects_empty_or_oversized_schema_version(client, snap_env, version):
    r = client.post(CREATE, json={"as_of_time": "2031-03-04T05:00:00Z", "schema_version": version})
    assert r.status_code == 422
    assert snap_env.saved == []


def test_py_gis_089_empty_as_of_time_means_current_utc_hour(client, snap_env, monkeypatch):
    class Frozen(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2031, 3, 4, 5, 47, 12, tzinfo=timezone.utc)

    monkeypatch.setattr(main, "datetime", Frozen)
    r = client.post(CREATE, json={"as_of_time": ""})
    assert r.status_code == 200
    assert r.json()["snapshots"][0]["as_of_time"] == "2031-03-04T05:00:00+00:00"


def test_py_gis_033_all_units_in_one_request_share_one_as_of_and_schema(client, snap_env):
    r = client.post(CREATE, json={"as_of_time": "2031-03-04T05:00:00Z", "schema_version": "v-test"})
    assert r.status_code == 200 and r.json()["total_created"] == 2
    assert [d["unit_id"] for d in snap_env.saved] == [BATXAT["unit_id"], "U2"]
    assert {d["as_of_time"] for d in snap_env.saved} == {"2031-03-04T05:00:00+00:00"}
    assert {d["schema_version"] for d in snap_env.saved} == {"v-test"}
    assert {t.isoformat() for t in snap_env.asof_seen} == {"2031-03-04T05:00:00+00:00"}
    ids = [s["snapshot_id"] for s in r.json()["snapshots"]]
    assert len(set(ids)) == 2  # one id per unit


def test_py_gis_034_second_unit_save_failure_is_500_after_first_was_saved(client, snap_env):
    """Documents current behaviour: no all-or-nothing transaction across units; the call fails, earlier row stays."""
    first_ok = snap_env.save_snapshot

    def fail_on_second(d):
        if len(snap_env.saved) == 1:
            raise RuntimeError(SECRET)
        return first_ok(d)

    snap_env.save_snapshot = fail_on_second
    r = client.post(CREATE, json={"as_of_time": "2031-03-04T05:00:00Z"})
    assert r.status_code == 500 and r.json() == GENERIC_500
    assert [d["unit_id"] for d in snap_env.saved] == [BATXAT["unit_id"]]


# ---------------------------------------------------------------- snapshot GET: PY-GIS-039/040/044/045/046
@pytest.mark.parametrize("raw,decoded", [("U%201", "U 1"), ("%C3%94-1", "Ô-1"), ("12345", "12345"), ("%3Cb%3E", "<b>")],
                         ids=["space", "unicode", "numeric", "markup"])
def test_py_gis_040_latest_unit_id_is_any_string_passed_verbatim(client, monkeypatch, raw, decoded):
    """CSV expects 422 for a wrong-typed unit_id; it is a plain str path segment, so it is looked up as-is (404 if unknown)."""
    repo = RecSnapRepo()
    monkeypatch.setattr(main, "snapshot_repo", repo)
    assert client.get(SNAP + "latest/" + raw).status_code == 404
    assert repo.asked_latest == [decoded] and repo.asked_id == []


def test_py_gis_044_snapshots_collection_root_is_not_a_route(client, monkeypatch):
    repo = RecSnapRepo()
    monkeypatch.setattr(main, "snapshot_repo", repo)
    assert client.get(SNAP, follow_redirects=False).status_code == 404
    assert repo.asked_id == [] and repo.asked_latest == []


@pytest.mark.parametrize("sid", ["not-a-uuid", "123", "latest", "1111111-1111-1111-1111-111111111111",
                                 "g1111111-1111-1111-1111-111111111111", UUID_A + "0", "%20"],
                         ids=["words", "number", "reserved-word", "short-group", "non-hex", "too-long", "space"])
def test_py_gis_045_non_uuid_snapshot_id_is_422_and_never_reaches_repository(client, monkeypatch, sid):
    repo = RecSnapRepo(by_id={"snapshot_id": "WRONG"})
    monkeypatch.setattr(main, "snapshot_repo", repo)
    r = client.get(SNAP + sid)
    assert r.status_code == 422
    assert r.json() == {"detail": "snapshot_id must be a UUID."}
    assert repo.asked_id == []


@pytest.mark.parametrize("sid", [UUID_A.upper(), UUID_A.replace("-", ""), "{" + UUID_A + "}", "urn:uuid:" + UUID_A],
                         ids=["uppercase", "no-dashes", "braces", "urn"])
def test_py_gis_046_any_uuid_spelling_is_looked_up_verbatim(client, monkeypatch, sid):
    repo = RecSnapRepo()
    monkeypatch.setattr(main, "snapshot_repo", repo)
    assert client.get(SNAP + sid).status_code == 404
    assert repo.asked_id == [sid]


# ---------------------------------------------------------------- tiling: PY-GIS-048/049/095-103
def test_py_gis_048_tiling_internal_failure_hides_internals(client, monkeypatch):
    def boom(bbox, size):
        raise RuntimeError(SECRET)

    monkeypatch.setattr(main.processor, "generate_tiles", boom)
    r = client.post(TILING, json={"area_id": 1, "bbox": [104.05, 21.80, 104.20, 21.90]})
    assert r.status_code == 500
    assert "10.0.0.9" not in r.text and "password" not in r.text


@pytest.mark.parametrize("content,headers", NOT_AN_OBJECT, ids=[f"PY-GIS-049-{i}" for i in NOT_AN_OBJECT_IDS])
def test_tiling_body_must_be_a_json_object(client, content, headers):
    assert client.post(TILING, content=content, headers=headers).status_code == 422


def test_tiling_tiles_cover_the_whole_bbox_with_sequential_ids(client):
    """PY-GIS-047: the grid has no gaps at the edges and ids run tile_0001.. in order."""
    bbox = [104.05, 21.80, 104.20, 21.90]
    body = client.post(TILING, json={"area_id": 1, "bbox": bbox, "patch_size_km": 5}).json()
    tiles = body["tiles"]
    assert [t["tile_id"] for t in tiles] == [f"tile_{i:04d}" for i in range(1, len(tiles) + 1)]
    assert min(t["bbox"][0] for t in tiles) == bbox[0] and max(t["bbox"][2] for t in tiles) == bbox[2]
    assert min(t["bbox"][1] for t in tiles) == bbox[1] and max(t["bbox"][3] for t in tiles) == bbox[3]
    assert all(t["bbox"][0] < t["bbox"][2] and t["bbox"][1] < t["bbox"][3] for t in tiles)


def test_py_gis_103_patch_larger_than_bbox_gives_one_tile_equal_to_the_bbox(client):
    r = client.post(TILING, json={"area_id": 1, "bbox": [104.05, 21.80, 104.06, 21.81], "patch_size_km": 1000})
    assert r.status_code == 200
    assert r.json()["tiles"] == [{"tile_id": "tile_0001", "bbox": [104.05, 21.8, 104.06, 21.81], "size_km": 1000.0,
                                  "status": "ready_for_inference"}]


@pytest.mark.parametrize("bbox", [[104.1, 21.8, 104.1, 21.9], [104.2, 21.8, 104.05, 21.9], [104.05, 21.9, 104.2, 21.8]],
                         ids=["PY-GIS-100-zero-width", "PY-GIS-100-inverted-lon", "PY-GIS-100-inverted-lat"])
def test_tiling_empty_or_inverted_bbox_yields_zero_tiles(client, bbox):
    """Current behaviour: 200 with an empty list rather than a client error."""
    r = client.post(TILING, json={"area_id": 1, "bbox": bbox})
    assert r.status_code == 200 and r.json()["total_tiles"] == 0 and r.json()["tiles"] == []


@pytest.mark.parametrize("body,area", [
    ({"area_id": 0}, 0), ({"area_id": -7}, -7), ({"area_id": "3"}, 3),
], ids=["PY-GIS-097-zero", "PY-GIS-097-negative", "PY-GIS-096-numeric-string"])
def test_tiling_area_id_is_echoed_as_int(client, body, area):
    r = client.post(TILING, json={**body, "bbox": [104.05, 21.80, 104.06, 21.81]})
    assert r.status_code == 200 and r.json()["area_id"] == area


def test_tiling_numeric_string_bbox_is_coerced(client):
    r = client.post(TILING, json={"area_id": 1, "bbox": ["104.05", "21.80", "104.06", "21.81"]})
    assert r.status_code == 200 and r.json()["tiles"][0]["bbox"] == [104.05, 21.8, 104.06, 21.81]


@pytest.mark.parametrize("body", [
    {"area_id": None, "bbox": [1, 2, 3, 4]}, {"area_id": 1.5, "bbox": [1, 2, 3, 4]}, {"area_id": [1], "bbox": [1, 2, 3, 4]},
    {"area_id": 1, "bbox": None}, {"area_id": 1, "bbox": [None, 2, 3, 4]}, {"area_id": 1, "bbox": {"a": 1}},
    {"area_id": 1, "bbox": [1, 2, 3, 4], "patch_size_km": None}, {"area_id": 1, "bbox": [1, 2, 3, 4], "patch_size_km": [2]},
], ids=["PY-GIS-096-area-null", "PY-GIS-096-area-fraction", "PY-GIS-096-area-list", "PY-GIS-099-bbox-null",
        "PY-GIS-099-bbox-null-item", "PY-GIS-099-bbox-object", "PY-GIS-102-size-null", "PY-GIS-102-size-list"])
def test_tiling_field_type_errors_422(client, body):
    assert client.post(TILING, json=body).status_code == 422


# The three inputs below make GISProcessor.generate_tiles loop forever (zero/negative step, or latitude beyond the poles makes
# cos() negative). They run in a child process with a 0.5 s timer so a hang can never block the suite.
_CHILD = """
import json, os, signal, sys
sys.path.insert(0, "tests"); sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from app import main
def hang(*_):
    print("HANG"); sys.stdout.flush(); os._exit(3)
signal.signal(signal.SIGALRM, hang)
client = TestClient(main.app, raise_server_exceptions=False)
signal.setitimer(signal.ITIMER_REAL, 0.5)
print(client.post("/api/v1/gis/tiling", json=json.loads(sys.argv[1])).status_code)
"""


@pytest.mark.skipif(sys.platform == "win32", reason="uses SIGALRM")
@pytest.mark.xfail(strict=True, reason="BUG: expected 422 for patch_size_km <= 0 and for a bbox beyond +/-90 latitude; actual: "
                                       "the request never returns (generate_tiles loops forever and grows the tile list), so one "
                                       "unauthenticated POST can pin a worker and exhaust memory.")
@pytest.mark.parametrize("body", [
    {"area_id": 1, "bbox": [104.0, 21.0, 104.1, 21.1], "patch_size_km": 0},
    {"area_id": 1, "bbox": [104.0, 21.0, 104.1, 21.1], "patch_size_km": -1},
    {"area_id": 1, "bbox": [0, 91, 1, 92], "patch_size_km": 50},
], ids=["PY-GIS-103-size-zero", "PY-GIS-103-size-negative", "PY-GIS-100-latitude-beyond-pole"])
def test_tiling_rejects_inputs_that_would_never_terminate(body):
    out = subprocess.run([sys.executable, "-c", _CHILD, json.dumps(body)], cwd=Path(__file__).resolve().parents[1],
                         capture_output=True, text=True, timeout=30).stdout.strip().splitlines()[-1]
    assert out == "422"


# ---------------------------------------------------------------- mvt: PY-GIS-053/054/055
@pytest.mark.parametrize("path", ["/api/v1/gis/mvt/3/4/5.png", "/api/v1/gis/mvt/3/4/5", "/api/v1/gis/mvt/3/4/5.PBF",
                                  "/api/v1/gis/mvt/3/4/.pbf"],
                         ids=["PY-GIS-055-png", "PY-GIS-055-no-extension", "PY-GIS-055-uppercase-ext", "PY-GIS-053-empty-y"])
def test_mvt_only_serves_the_pbf_extension(client, path):
    assert client.get(path).status_code == 404


@pytest.mark.parametrize("path", ["/api/v1/gis/mvt/3/x/5.pbf", "/api/v1/gis/mvt/1e3/4/5.pbf"],
                         ids=["PY-GIS-054-x-letter", "PY-GIS-054-z-exponent"])
def test_mvt_malformed_coordinate_is_422(client, path):
    assert client.get(path).status_code == 422


@pytest.mark.xfail(strict=True, reason="BUG: expected a 4xx for tile coordinates outside the XYZ scheme (negative z/x/y, or "
                                       "x/y >= 2**z); actual: 200 with an empty body for any integers.")
@pytest.mark.parametrize("path", ["/api/v1/gis/mvt/-1/0/0.pbf", "/api/v1/gis/mvt/3/-1/0.pbf", "/api/v1/gis/mvt/3/0/-1.pbf",
                                  "/api/v1/gis/mvt/0/1/0.pbf", "/api/v1/gis/mvt/2/4/0.pbf"],
                         ids=["PY-GIS-054-z-negative", "PY-GIS-054-x-negative", "PY-GIS-054-y-negative",
                              "PY-GIS-054-x-beyond-z0", "PY-GIS-054-x-beyond-z2"])
def test_py_gis_054_mvt_out_of_scheme_coordinates_rejected(client, path):
    assert 400 <= client.get(path).status_code < 500
