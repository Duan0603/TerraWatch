import numpy as np
import pytest
import requests

from app.pipeline import terrain_client as tc
from app.pipeline.terrain_client import OpenMeteoElevationClient
from pipeline_fakes import FakeResponse, Recorder


@pytest.fixture
def sleeps(monkeypatch):
    rec = []
    monkeypatch.setattr(tc.time, "sleep", rec.append)
    return rec


def patch_get(monkeypatch, *outcomes):
    rec = Recorder(*outcomes)
    monkeypatch.setattr(tc.requests, "get", rec)
    return rec


def test_batch_request_construction_and_parse(monkeypatch):
    rec = patch_get(monkeypatch, FakeResponse({"elevation": [10, 20.5]}))
    out = OpenMeteoElevationClient(timeout_sec=4).fetch_elevations_batch([22.123456, 22.0], [103.5, 103.25])
    assert out == [10.0, 20.5]
    c = rec.calls[0]
    assert c["url"] == "https://api.open-meteo.com/v1/elevation" and c["timeout"] == 4
    assert c["params"] == {"latitude": "22.12346,22.00000", "longitude": "103.50000,103.25000"}


def test_length_mismatch_input_rejected_before_network(monkeypatch):
    rec = patch_get(monkeypatch, FakeResponse({"elevation": []}))
    with pytest.raises(ValueError, match="identical length"):
        OpenMeteoElevationClient().fetch_elevations_batch([1.0], [1.0, 2.0])
    assert rec.calls == []


def test_empty_batch_returns_empty(monkeypatch):
    patch_get(monkeypatch, FakeResponse({"elevation": []}))
    assert OpenMeteoElevationClient().fetch_elevations_batch([], []) == []


def test_null_elevation_becomes_nodata_sentinel_not_zero(monkeypatch):
    patch_get(monkeypatch, FakeResponse({"elevation": [None, 5]}))
    out = OpenMeteoElevationClient().fetch_elevations_batch([1, 2], [1, 2])
    assert out == [-9999.0, 5.0]  # sentinel is in TerrainProcessor's default nodata list


@pytest.mark.parametrize("outcome", [
    FakeResponse({}, status=500), FakeResponse({}, status=404),
    requests.exceptions.Timeout("t"), requests.exceptions.ConnectionError("c"),
    FakeResponse({"nope": 1}), FakeResponse({"elevation": "abc"}), FakeResponse({"elevation": ["x"]}),
    FakeResponse(json_error=ValueError("bad json")),
])
def test_failures_retry_with_backoff_then_raise(monkeypatch, sleeps, outcome):
    rec = patch_get(monkeypatch, outcome)
    with pytest.raises(RuntimeError, match="Elevation query failed"):
        OpenMeteoElevationClient(max_retries=3).fetch_elevations_batch([1.0], [1.0])
    assert len(rec.calls) == 3
    assert sleeps == [1.0, 2.0]  # no sleep after last attempt


def test_recovers_after_transient_error(monkeypatch, sleeps):
    rec = patch_get(monkeypatch, requests.exceptions.ConnectionError("x"), FakeResponse({"elevation": [7]}))
    assert OpenMeteoElevationClient().fetch_elevations_batch([1.0], [1.0]) == [7.0]
    assert len(rec.calls) == 2 and sleeps == [1.0]


def test_zero_retries_raises_without_calling(monkeypatch):
    rec = patch_get(monkeypatch, FakeResponse({"elevation": [1]}))
    with pytest.raises(RuntimeError):
        OpenMeteoElevationClient(max_retries=0).fetch_elevations_batch([1.0], [1.0])
    assert rec.calls == []


def test_grid_layout_and_odd_size(monkeypatch):
    rec = patch_get(monkeypatch, FakeResponse({"elevation": list(range(9))}))
    grid, step, src = OpenMeteoElevationClient().fetch_grid_around_point(22.0, 103.0, grid_size=2, step_deg=0.01)
    assert src == "COPERNICUS_GLO_30" and step == 0.01 and grid.shape == (3, 3)
    assert grid.tolist() == np.arange(9, dtype=float).reshape(3, 3).tolist()
    lats = [float(x) for x in rec.calls[0]["params"]["latitude"].split(",")]
    lons = [float(x) for x in rec.calls[0]["params"]["longitude"].split(",")]
    assert lats[0] == pytest.approx(22.01) and lats[-1] == pytest.approx(21.99)  # north first
    assert lons[0] == pytest.approx(102.99) and lons[2] == pytest.approx(103.01)  # west to east


def test_grid_outage_uses_labelled_deterministic_fallback(monkeypatch, sleeps):
    patch_get(monkeypatch, requests.exceptions.Timeout("t"))
    c = OpenMeteoElevationClient(max_retries=1)
    g1, _, s1 = c.fetch_grid_around_point(22.3, 103.8, grid_size=3)
    g2, _, s2 = c.fetch_grid_around_point(22.3, 103.8, grid_size=3)
    assert s1 == s2 == "FALLBACK_SYNTHETIC" and g1.shape == (3, 3)
    assert np.array_equal(g1, g2) and np.isfinite(g1).all()


@pytest.mark.xfail(strict=True, reason="BUG: expected provider outage to raise (no fabricated values); actual "
                                       "terrain_client.py:82-88 returns a synthetic DEM grid (labelled FALLBACK_SYNTHETIC)")
def test_grid_outage_must_not_fabricate_elevations(monkeypatch, sleeps):
    patch_get(monkeypatch, requests.exceptions.Timeout("t"))
    with pytest.raises(RuntimeError):
        OpenMeteoElevationClient(max_retries=1).fetch_grid_around_point(22.3, 103.8, grid_size=3)


@pytest.mark.xfail(strict=True, reason="BUG: expected error when provider returns fewer elevations than points; actual "
                                       "terrain_client.py:40-41 returns the short list unchecked")
def test_batch_short_response_rejected(monkeypatch, sleeps):
    patch_get(monkeypatch, FakeResponse({"elevation": [1.0]}))
    with pytest.raises(RuntimeError):
        OpenMeteoElevationClient(max_retries=1).fetch_elevations_batch([1.0, 2.0], [1.0, 2.0])


def test_fallback_grid_values_realistic_range():
    g = OpenMeteoElevationClient()._generate_fallback_grid(22.3, 103.8, 5, 0.0003)
    assert g.shape == (5, 5) and 500 < g.min() and g.max() < 2000
