import pytest
import requests

from app.pipeline.rainfall_client import OpenMeteoRainfallClient, RainfallClientError
from pipeline_fakes import FakeResponse, Recorder

GOOD = {"hourly": {"time": ["2026-11-01T00:00", "2026-11-01T01:00"], "precipitation": [0.0, 1.5]}}


def client_with(monkeypatch, *outcomes):
    c = OpenMeteoRainfallClient()
    rec = Recorder(*outcomes)
    monkeypatch.setattr(c.session, "get", rec)
    return c, rec


def test_request_construction(monkeypatch):
    c, rec = client_with(monkeypatch, FakeResponse(GOOD))
    out = c.fetch_rainfall_series(22.123456789, 103.987654321, past_days=3, forecast_days=1)
    assert out == GOOD
    call = rec.calls[0]
    assert call["url"] == "https://api.open-meteo.com/v1/forecast"
    assert call["params"] == {"latitude": 22.1235, "longitude": 103.9877, "hourly": "precipitation",
                              "timezone": "UTC", "past_days": 3, "forecast_days": 1}
    assert call["timeout"] == 10


def test_defaults_and_custom_timeout(monkeypatch):
    c = OpenMeteoRainfallClient(timeout_sec=3, max_retries=5)
    rec = Recorder(FakeResponse(GOOD))
    monkeypatch.setattr(c.session, "get", rec)
    c.fetch_rainfall_series(1, 2)
    assert rec.calls[0]["timeout"] == 3
    assert (rec.calls[0]["params"]["past_days"], rec.calls[0]["params"]["forecast_days"]) == (7, 2)
    retry = c.session.get_adapter("https://api.open-meteo.com").max_retries
    assert retry.total == 5 and 503 in retry.status_forcelist and 429 in retry.status_forcelist


def test_null_values_stay_null(monkeypatch):
    payload = {"hourly": {"time": ["a", "b"], "precipitation": [None, 0.2]}}
    c, _ = client_with(monkeypatch, FakeResponse(payload))
    assert c.fetch_rainfall_series(1, 2)["hourly"]["precipitation"] == [None, 0.2]


def test_empty_arrays_are_returned_not_invented(monkeypatch):
    payload = {"hourly": {"time": [], "precipitation": []}}
    c, _ = client_with(monkeypatch, FakeResponse(payload))
    assert c.fetch_rainfall_series(1, 2)["hourly"]["precipitation"] == []


@pytest.mark.parametrize("status", [400, 404, 429, 500, 503])
def test_http_errors_become_client_error(monkeypatch, status):
    c, _ = client_with(monkeypatch, FakeResponse({}, status=status))
    with pytest.raises(RainfallClientError, match="network failure"):
        c.fetch_rainfall_series(1, 2)


@pytest.mark.parametrize("exc", [requests.exceptions.Timeout("slow"), requests.exceptions.ConnectionError("down"),
                                 requests.exceptions.RetryError("gave up")])
def test_network_errors_become_client_error(monkeypatch, exc):
    c, _ = client_with(monkeypatch, exc)
    with pytest.raises(RainfallClientError) as ei:
        c.fetch_rainfall_series(1, 2)
    assert ei.value.__cause__ is exc


def test_invalid_json_body(monkeypatch):
    c, _ = client_with(monkeypatch, FakeResponse(json_error=requests.exceptions.JSONDecodeError("bad", "x", 0)))
    with pytest.raises(RainfallClientError):
        c.fetch_rainfall_series(1, 2)


@pytest.mark.parametrize("payload", [{}, {"hourly": {}}, {"hourly": {"time": ["a"]}}, {"error": True, "reason": "x"}])
def test_partial_payload_rejected(monkeypatch, payload):
    c, _ = client_with(monkeypatch, FakeResponse(payload))
    with pytest.raises(RainfallClientError, match="missing hourly precipitation"):
        c.fetch_rainfall_series(1, 2)


def test_mismatched_array_lengths_passed_through_for_processor(monkeypatch):
    # Client does not validate lengths; RainfallProcessor flags them 'missing' (covered in test_rainfall*.py).
    payload = {"hourly": {"time": ["a", "b"], "precipitation": [1.0]}}
    c, _ = client_with(monkeypatch, FakeResponse(payload))
    assert c.fetch_rainfall_series(1, 2) == payload


@pytest.mark.xfail(strict=True, reason="BUG: expected RainfallClientError for 'hourly': null; actual TypeError "
                                       "('in' on None) escapes at rainfall_client.py:62")
def test_null_hourly_object_gives_client_error(monkeypatch):
    c, _ = client_with(monkeypatch, FakeResponse({"hourly": None}))
    with pytest.raises(RainfallClientError):
        c.fetch_rainfall_series(1, 2)


def test_non_object_json_body_gives_client_error(monkeypatch):
    c, _ = client_with(monkeypatch, FakeResponse([1, 2, 3]))
    with pytest.raises(RainfallClientError):
        c.fetch_rainfall_series(1, 2)
