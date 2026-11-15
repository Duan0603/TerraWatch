"""HTTP tests for GET /api/v1/gis/snapshots/latest/{unit_id} (in-memory FakeSnapRepo, no DB)."""
import pytest

from api_fakes import SECRET, FakeSnapRepo
from app import main

URL = "/api/v1/gis/snapshots/latest/"
SNAP = {"snapshot_id": "00000000-0000-0000-0000-000000000001", "unit_id": "VN_LC_BATXAT_0001",
        "schema_version": "rainfall-terrain-24h.v1", "features": {"rain_24h_mm": 12.5}}


class Repo(FakeSnapRepo):
    def __init__(self, **kw):
        super().__init__(**kw)
        self.asked = []

    def get_latest_snapshot(self, unit_id):
        self.asked.append(unit_id)
        return super().get_latest_snapshot(unit_id)


@pytest.fixture
def repo(monkeypatch):
    r = Repo(latest=SNAP)
    monkeypatch.setattr(main, "snapshot_repo", r)
    return r


def test_latest_success(client, repo):
    r = client.get(URL + "VN_LC_BATXAT_0001")
    assert r.status_code == 200
    assert r.json() == {"success": True, "data": SNAP}
    assert repo.asked == ["VN_LC_BATXAT_0001"]


def test_latest_unknown_unit_404(client, repo):
    repo.latest = None
    r = client.get(URL + "NOPE")
    assert r.status_code == 404
    assert r.json() == {"detail": "No feature snapshot found for unit 'NOPE'."}


def test_latest_empty_snapshot_treated_as_missing(client, repo):
    repo.latest = {}
    assert client.get(URL + "U1").status_code == 404


def test_latest_repository_failure_500(client, repo):
    repo.fail = True
    assert client.get(URL + "U1").status_code == 500


@pytest.mark.xfail(strict=True, reason="BUG: 500 detail is raw str(exception); DB driver text leaks to client")
def test_latest_repository_failure_does_not_leak_driver_text(client, repo):
    repo.fail = True
    assert "10.0.0.9" not in client.get(URL + "U1").text


def test_latest_no_unit_id_not_this_route(client, repo):
    assert client.get("/api/v1/gis/snapshots/latest/").status_code in (404, 405, 422)
    assert repo.asked == []


def test_latest_path_not_swallowed_by_snapshot_id_route(client, repo):
    """'latest/<unit>' must hit the latest-by-unit handler, not /snapshots/{snapshot_id}."""
    repo.by_id = {"snapshot_id": "WRONG"}
    assert client.get(URL + "VN_LC_BATXAT_0001").json()["data"] == SNAP
