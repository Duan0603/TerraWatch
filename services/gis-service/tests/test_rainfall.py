"""
Unit & Integration Tests for Story 2.1: Rainfall Ingestion & Processing
"""
import pytest
from datetime import datetime, timezone, timedelta
from app.pipeline.rainfall_processor import RainfallProcessor
from app.pipeline.rainfall_client import OpenMeteoRainfallClient, RainfallClientError
from app.pipeline.rainfall_repository import RainfallRepository

def test_rainfall_processor_accumulations():
    """
    Test that hourly rainfall correctly accumulates into 1h, 24h, 72h, 7d and 24h forecast windows.
    """
    as_of = datetime(2026, 10, 14, 12, 0, 0, tzinfo=timezone.utc)
    
    # Generate 7 days of past hourly data + 24 hours of future forecast
    times = []
    precip = []

    # 168 hours past (7 days) up to as_of
    start_time = as_of - timedelta(days=7)
    curr = start_time + timedelta(hours=1)
    
    while curr <= as_of + timedelta(hours=24):
        times.append(curr.strftime("%Y-%m-%dT%H:%M"))
        # Past 24h receives 2.0 mm/h (total 48.0 mm)
        if as_of - timedelta(hours=24) < curr <= as_of:
            precip.append(2.0)
        # Future 24h receives 1.5 mm/h (total 36.0 mm)
        elif as_of < curr <= as_of + timedelta(hours=24):
            precip.append(1.5)
        # Older past receives 0.5 mm/h
        else:
            precip.append(0.5)
        curr += timedelta(hours=1)

    mock_data = {
        "hourly": {
            "time": times,
            "precipitation": precip
        }
    }

    result = RainfallProcessor.process_series(
        unit_id="TEST_UNIT_01",
        open_meteo_data=mock_data,
        as_of=as_of
    )

    summary = result["summary"]
    assert summary is not None
    assert summary["quality_flag"] == "good"
    assert summary["rain_1h_mm"] == 2.0
    assert summary["rain_24h_acc_mm"] == 48.0
    assert summary["forecast_next_24h_mm"] == 36.0
    # 72h accumulation: 48h * 0.5 + 24h * 2.0 = 24.0 + 48.0 = 72.0 mm
    assert summary["rain_72h_acc_mm"] == 72.0

def test_rainfall_processor_missing_data_not_zero():
    """
    Test AC2 / Invariant: Missing hourly precipitation must NOT be filled with 0.0,
    and must trigger quality_flag = 'missing'.
    """
    as_of = datetime(2026, 10, 14, 12, 0, 0, tzinfo=timezone.utc)
    
    # Construct series with missing values (None) in the past 24h
    times = [
        (as_of - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M"),
        (as_of - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M"),
        as_of.strftime("%Y-%m-%dT%H:%M")
    ]
    precip = [10.0, None, 5.0] # Gap in interval

    mock_data = {
        "hourly": {
            "time": times,
            "precipitation": precip
        }
    }

    result = RainfallProcessor.process_series(
        unit_id="TEST_GAP_UNIT",
        open_meteo_data=mock_data,
        as_of=as_of
    )

    summary = result["summary"]
    assert summary is not None
    assert summary["quality_flag"] == "missing"
    assert summary["rain_24h_acc_mm"] is None # Does NOT report fake 0.0 or partial sum

def test_idempotent_database_persistence():
    """
    Test AC4: Upserting observations and forecasts into PostGIS is idempotent and error-free.
    """
    repo = RainfallRepository()
    unit_id = "VN_LC_BATXAT_0001"
    
    # Sample observation
    now = datetime.now(timezone.utc)
    obs = [{
        "unit_id": unit_id,
        "interval_start": (now - timedelta(hours=1)).isoformat(),
        "interval_end": now.isoformat(),
        "available_at": now.isoformat(),
        "rainfall_mm": 12.5,
        "source_provider": "OPEN_METEO",
        "source_revision": "v1",
        "quality_flag": "good"
    }]

    # Sample forecast
    fcst = {
        "unit_id": unit_id,
        "provider_run_id": "TEST_RUN_IDEMPOTENT",
        "provider_name": "OPEN_METEO",
        "issued_at": now.isoformat(),
        "valid_from": now.isoformat(),
        "valid_until": (now + timedelta(hours=24)).isoformat(),
        "available_at": now.isoformat(),
        "predicted_rain_24h_mm": 45.0,
        "quality_flag": "good"
    }

    # First insertion
    obs_count1 = repo.save_rainfall_observations(obs)
    fcst_ok1 = repo.save_rainfall_forecast(fcst)
    assert obs_count1 == 1
    assert fcst_ok1 is True

    # Second insertion (Identical data) - should succeed without primary/unique key violation
    obs_count2 = repo.save_rainfall_observations(obs)
    fcst_ok2 = repo.save_rainfall_forecast(fcst)
    assert obs_count2 == 1
    assert fcst_ok2 is True

if __name__ == "__main__":
    pytest.main(["-v", __file__])
