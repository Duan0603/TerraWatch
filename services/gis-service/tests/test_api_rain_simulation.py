"""HTTP tests for GET /api/v1/gis/rainfall/simulate (fake service, no DB, no network)."""
import pytest

from api_fakes import FakeLive
from app import main

URL = "/api/v1/gis/rainfall/simulate"


class SimLive(FakeLive):
    def __init__(self, result):
        super().__init__()
        self.result, self.calls = result, []

    def simulate(self, key, past, now):
        self.calls.append((key, past, now))
        return self.result


def use(monkeypatch, result):
    fake = SimLive(result)
    monkeypatch.setattr(main, "live_rainfall", fake)
    return fake


def test_simulate_returns_labelled_scores(client, monkeypatch):
    live = use(monkeypatch, {"ready": True, "hazard_score": 0.4, "temporal_score": 0.8, "spatial_score": 0.5})
    r = client.get(URL, params={"key": "k", "past_7d_mm": 300, "next_24h_mm": 80})
    assert r.status_code == 200 and r.json()["simulated"] is True and r.json()["hazard_score"] == 0.4
    assert live.calls == [("k", 300.0, 80.0)]


@pytest.mark.parametrize("reason,status", [("STATIC_FEATURES_UNAVAILABLE", 404), ("MODEL_UNAVAILABLE_OR_INVALID_INPUT", 503)])
def test_simulate_not_ready_maps_to_status(client, monkeypatch, reason, status):
    use(monkeypatch, {"ready": False, "reason": reason})
    assert client.get(URL, params={"key": "k", "past_7d_mm": 0, "next_24h_mm": 0}).status_code == status


@pytest.mark.parametrize("params", [{"key": "k", "past_7d_mm": -1, "next_24h_mm": 0},
                                    {"key": "k", "past_7d_mm": 0, "next_24h_mm": 5000}, {"key": "k"}])
def test_simulate_rejects_out_of_range_rain(client, monkeypatch, params):
    live = use(monkeypatch, {"ready": True})
    assert client.get(URL, params=params).status_code == 422 and live.calls == []


def test_simulation_locations(client):
    r = client.get(URL + "/locations")
    assert r.status_code == 200 and len(r.json()["items"]) > 0
