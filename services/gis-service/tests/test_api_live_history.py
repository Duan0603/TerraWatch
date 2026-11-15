"""HTTP tests for GET /api/v1/gis/rainfall/live/history (in-memory fakes, no DB, no network)."""
import psycopg2
import pytest

from api_fakes import SECRET, FakeLive
from app import main

URL = "/api/v1/gis/rainfall/live/history"
ROWS = [{"as_of": "2031-03-04T04:00:00+00:00", "rain_1h_mm": 1.0, "rain_24h_mm": 5.0},
        {"as_of": "2031-03-04T05:00:00+00:00", "rain_1h_mm": 2.0, "rain_24h_mm": 6.0}]
CLIMATE = {"period": "1998–2026", "windows": {"24": {"p95": 40.0, "p99": 80.0, "p99_9": 120.0}}}


class HistLive(FakeLive):
    def __init__(self, rows=ROWS, exc=None):
        super().__init__(exc=exc)
        self.rows, self.calls = rows, []

    def history(self, lat, lon, days):
        self.calls.append((lat, lon, days))
        if self.exc:
            raise self.exc
        return self.rows


@pytest.fixture
def live(monkeypatch):
    fake = HistLive()
    monkeypatch.setattr(main, "live_rainfall", fake)
    monkeypatch.setattr(main, "load_climatology", lambda key: CLIMATE)
    return fake


def test_history_success_shape_and_default_days(client, live):
    r = client.get(URL, params={"latitude": 22.1202, "longitude": 104.5278})
    assert r.status_code == 200
    assert r.json() == {"success": True, "source_kind": "WEATHER_MODEL_ESTIMATE", "experimental": True,
                        "thresholds_24h": {"period": "1998–2026", "p95": 40.0, "p99": 80.0}, "items": ROWS}
    assert live.calls == [(22.1202, 104.5278, 7)]


def test_history_passes_days(client, live):
    assert client.get(URL, params={"latitude": 1, "longitude": 2, "days": 90}).status_code == 200
    assert live.calls == [(1.0, 2.0, 90)]


def test_history_thresholds_null_without_climatology(client, live, monkeypatch):
    monkeypatch.setattr(main, "load_climatology", lambda key: None)
    r = client.get(URL, params={"latitude": 1, "longitude": 2})
    assert r.status_code == 200 and r.json()["thresholds_24h"] is None


def test_history_empty_items(client, live):
    live.rows = []
    r = client.get(URL, params={"latitude": 1, "longitude": 2})
    assert r.status_code == 200 and r.json()["items"] == []


def test_history_climatology_key_uses_four_decimals(client, live, monkeypatch):
    keys = []
    monkeypatch.setattr(main, "load_climatology", lambda key: keys.append(key))
    client.get(URL, params={"latitude": 22.12026, "longitude": 104.5278})
    assert keys == ["22.1203,104.5278"]


@pytest.mark.parametrize("params", [
    {}, {"latitude": 1}, {"longitude": 2},
    {"latitude": "abc", "longitude": 2},
    {"latitude": 91, "longitude": 2}, {"latitude": -91, "longitude": 2},
    {"latitude": 1, "longitude": 181}, {"latitude": 1, "longitude": -181},
    {"latitude": 1, "longitude": 2, "days": 0}, {"latitude": 1, "longitude": 2, "days": 91},
    {"latitude": 1, "longitude": 2, "days": "x"},
])
def test_history_bad_params_422(client, live, params):
    assert client.get(URL, params=params).status_code == 422
    assert live.calls == []


@pytest.mark.parametrize("exc", [psycopg2.OperationalError(SECRET), RuntimeError(SECRET)])
def test_history_repository_failure_503_hides_internals(client, live, exc):
    live.exc = exc
    r = client.get(URL, params={"latitude": 1, "longitude": 2})
    assert r.status_code == 503
    assert r.json() == {"detail": "Kho dữ liệu mưa tạm thời chưa sẵn sàng. Vui lòng thử lại."}
    assert "10.0.0.9" not in r.text
