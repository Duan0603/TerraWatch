"""Boundary values BL-GIS-001..008 from docs/test-cases/test-conditions.csv (rainfall forecast length, minimum window counts).

Pure functions, no DB, no network. BL-GIS-009..013 (QD 18 rain classes) are not tested: no such classification exists in the code.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.pipeline.rainfall_processor import RainfallProcessor
from app.pipeline.snapshot_processor import SnapshotProcessor

AS_OF = datetime(2026, 11, 12, 4, 0, tzinfo=timezone.utc)


def _series(forecast_hours, missing_forecast_hour=None):
    """Observations for the 24h before AS_OF plus `forecast_hours` hourly forecast steps (1 mm each)."""
    times, vals = [], []
    for h in range(-23, forecast_hours + 1):
        times.append((AS_OF + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M"))
        vals.append(None if h == missing_forecast_hour else 1.0)
    return {"hourly": {"time": times, "precipitation": vals}}


def test_bl_gis_002_exactly_20_forecast_hours_is_accepted_and_summed_as_is():
    """BL-GIS-001 (19h rejected) and BL-GIS-003 (24h accepted) are already asserted in test_rainfall_edge_cases.py."""
    r = RainfallProcessor.process_series("U", _series(20), as_of=AS_OF)
    assert r["forecast"]["predicted_rain_24h_mm"] == 20.0  # not scaled up to a 24h total
    assert r["summary"]["forecast_next_24h_mm"] == 20.0 and r["quality_flag"] == "good"


def test_bl_gis_004_enough_hours_but_one_missing_is_not_accepted_and_not_zero_filled():
    r = RainfallProcessor.process_series("U", _series(20, missing_forecast_hour=10), as_of=AS_OF)
    assert r["forecast"] is None and r["summary"]["forecast_next_24h_mm"] is None
    assert r["quality_flag"] == "missing"


def _obs(n):
    return [{"interval_end": (AS_OF - timedelta(hours=i)).isoformat(), "available_at": (AS_OF - timedelta(hours=i)).isoformat(),
             "rainfall_mm": 1.0} for i in range(n)]


@pytest.mark.parametrize("field,n,expected", [
    ("rain_1h_mm", 0, None), ("rain_1h_mm", 1, 1.0),
    ("rain_24h_acc_mm", 19, None), ("rain_24h_acc_mm", 20, 20.0),
    ("rain_72h_acc_mm", 59, None), ("rain_72h_acc_mm", 60, 60.0),
    ("rain_7d_acc_mm", 139, None), ("rain_7d_acc_mm", 140, 140.0),
], ids=["BL-GIS-005-1h-0", "BL-GIS-005-1h-1", "BL-GIS-006-24h-19", "BL-GIS-006-24h-20",
        "BL-GIS-007-72h-59", "BL-GIS-007-72h-60", "BL-GIS-008-7d-139", "BL-GIS-008-7d-140"])
def test_snapshot_window_minimum_value_counts(field, n, expected):
    f = SnapshotProcessor.build_snapshot("U", as_of_time=AS_OF, observations=_obs(n))["features"]
    assert f[field] == expected  # below the minimum the window is None, never a partial sum or 0.0


def test_bl_gis_006_one_value_short_of_24h_degrades_quality_to_stale():
    fc = {"available_at": AS_OF.isoformat(), "predicted_rain_24h_mm": 5.0}
    ok = SnapshotProcessor.build_snapshot("U", as_of_time=AS_OF, observations=_obs(20), forecast=fc, terrain={"slope_avg": 10})
    short = SnapshotProcessor.build_snapshot("U", as_of_time=AS_OF, observations=_obs(19), forecast=fc, terrain={"slope_avg": 10})
    assert ok["coverage_quality"] == "good"
    assert short["coverage_quality"] == "stale"  # forecast alone still counts; 24h rain is withheld
    assert short["features"]["rain_24h_acc_mm"] is None
