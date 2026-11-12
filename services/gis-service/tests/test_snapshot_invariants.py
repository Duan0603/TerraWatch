import unittest
from datetime import datetime, timezone, timedelta
from app.pipeline.snapshot_processor import SnapshotProcessor


class TestSnapshotInvariants(unittest.TestCase):
    """Edge-case tests enforcing temporal anti-lookahead and coverage quality invariants."""

    def test_future_forecast_available_at_rejected(self):
        """A forecast whose available_at is strictly after as_of_time must not leak into features."""
        as_of = datetime(2026, 11, 12, 4, 0, 0, tzinfo=timezone.utc)
        obs = [
            {
                "interval_end": (as_of - timedelta(hours=i)).isoformat(),
                "available_at": (as_of - timedelta(hours=i)).isoformat(),
                "rainfall_mm": 1.0,
            }
            for i in range(20)
        ]
        future_forecast = {
            "provider_run_id": "OPEN_METEO_FUTURE",
            "issued_at": (as_of + timedelta(hours=1)).isoformat(),
            "available_at": (as_of + timedelta(hours=1)).isoformat(),
            "predicted_rain_24h_mm": 99.0,
        }

        snapshot = SnapshotProcessor.build_snapshot(
            unit_id="VN_LOOKAHEAD",
            as_of_time=as_of,
            observations=obs,
            forecast=future_forecast,
            terrain={"slope_avg": 22.0},
        )

        self.assertIsNone(snapshot["features"]["forecast_next_24h_mm"])
        self.assertIsNone(snapshot["source_references"]["forecast_run_id"])
        self.assertEqual(snapshot["coverage_quality"], "stale")

    def test_stale_quality_when_terrain_missing(self):
        """Valid 24h rain + forecast without terrain slope must degrade quality to 'stale'."""
        as_of = datetime(2026, 11, 12, 4, 0, 0, tzinfo=timezone.utc)
        obs = [
            {
                "interval_end": (as_of - timedelta(hours=i)).isoformat(),
                "available_at": (as_of - timedelta(hours=i)).isoformat(),
                "rainfall_mm": 2.0,
            }
            for i in range(20)
        ]
        forecast = {
            "provider_run_id": "RUN_OK",
            "issued_at": as_of.isoformat(),
            "available_at": as_of.isoformat(),
            "predicted_rain_24h_mm": 18.0,
        }

        snapshot = SnapshotProcessor.build_snapshot(
            unit_id="VN_NO_TERRAIN",
            as_of_time=as_of,
            observations=obs,
            forecast=forecast,
            terrain=None,
        )

        self.assertEqual(snapshot["features"]["rain_24h_acc_mm"], 40.0)
        self.assertEqual(snapshot["features"]["forecast_next_24h_mm"], 18.0)
        self.assertIsNone(snapshot["features"]["slope_avg"])
        self.assertEqual(snapshot["coverage_quality"], "stale")

    def test_unparseable_observations_skipped_safely(self):
        """Corrupt timestamp or missing interval_end records must be skipped without exception."""
        as_of = datetime(2026, 11, 12, 4, 0, 0, tzinfo=timezone.utc)
        obs = [
            {"interval_end": "not-a-timestamp", "rainfall_mm": 10.0},
            {"rainfall_mm": 5.0},
            {"interval_end": as_of.isoformat(), "available_at": as_of.isoformat(), "rainfall_mm": 4.5},
        ]

        snapshot = SnapshotProcessor.build_snapshot(
            unit_id="VN_CORRUPT_OBS",
            as_of_time=as_of,
            observations=obs,
        )

        self.assertEqual(snapshot["source_references"]["rainfall_observations_count"], 1)
        self.assertEqual(snapshot["features"]["rain_1h_mm"], 4.5)
        self.assertEqual(snapshot["coverage_quality"], "missing")


if __name__ == "__main__":
    unittest.main()
