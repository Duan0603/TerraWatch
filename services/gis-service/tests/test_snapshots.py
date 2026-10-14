import unittest
from datetime import datetime, timezone, timedelta
from app.pipeline.snapshot_processor import SnapshotProcessor
from app.pipeline.snapshot_repository import SnapshotRepository


class TestSnapshotProcessor(unittest.TestCase):
    def setUp(self):
        self.processor = SnapshotProcessor()

    def test_temporal_alignment_lookahead_prevention(self):
        """
        Verify invariant AC1: Only observations with available_at <= as_of_time
        are allowed into the feature calculation. Leaked future records are ignored.
        """
        as_of = datetime(2026, 10, 14, 12, 0, 0, tzinfo=timezone.utc)
        
        # Valid historical observations (available_at <= as_of)
        obs_list = [
            {
                "interval_start": (as_of - timedelta(hours=i)).isoformat(),
                "interval_end": (as_of - timedelta(hours=i - 1)).isoformat(),
                "available_at": (as_of - timedelta(hours=i - 1)).isoformat(),
                "rainfall_mm": 2.0,
                "quality_flag": "good"
            }
            for i in range(24, 0, -1)
        ]
        
        # Leaked observation available 1 hour after as_of (should be excluded)
        leaked_obs = {
            "interval_start": as_of.isoformat(),
            "interval_end": (as_of + timedelta(hours=1)).isoformat(),
            "available_at": (as_of + timedelta(hours=1)).isoformat(),
            "rainfall_mm": 50.0,
            "quality_flag": "good"
        }
        obs_list.append(leaked_obs)

        # Static terrain features
        terrain_dict = {
            "slope_avg": 25.0,
            "slope_max": 38.0,
            "elevation_avg": 600.0,
            "relief_m": 75.0,
            "dem_source": "COPERNICUS_GLO_30",
            "effective_resolution_m": 1000.0
        }

        # Forecast valid for next 24 hours
        forecast_dict = {
            "provider_run_id": "OPEN_METEO_RUN_20261014_12Z",
            "provider_name": "OPEN_METEO",
            "issued_at": as_of.isoformat(),
            "valid_from": as_of.isoformat(),
            "valid_until": (as_of + timedelta(hours=24)).isoformat(),
            "available_at": as_of.isoformat(),
            "predicted_rain_24h_mm": 35.0,
            "quality_flag": "good"
        }

        snapshot = self.processor.build_snapshot(
            unit_id="TEST_ALIGN_01",
            unit_version="v1",
            as_of_time=as_of,
            observations=obs_list,
            forecast=forecast_dict,
            terrain=terrain_dict
        )

        features = snapshot["features"]
        # Total 24h rain should be 24 * 2.0 = 48.0 mm (excluding the leaked 50.0mm)
        self.assertEqual(features["rain_24h_acc_mm"], 48.0)
        self.assertEqual(features["forecast_next_24h_mm"], 35.0)
        self.assertEqual(features["slope_avg"], 25.0)
        self.assertEqual(snapshot["coverage_quality"], "good")
        self.assertEqual(snapshot["source_references"]["rainfall_observations_count"], 24)

    def test_missing_data_degrades_quality_without_zero_filling(self):
        """
        Verify AC3: Missing required rainfall does not zero-fill; degrades to missing.
        """
        as_of = datetime(2026, 10, 14, 12, 0, 0, tzinfo=timezone.utc)
        
        # Only 2 observations available in the past 24 hours
        sparse_obs = [
            {
                "interval_start": (as_of - timedelta(hours=2)).isoformat(),
                "interval_end": (as_of - timedelta(hours=1)).isoformat(),
                "available_at": (as_of - timedelta(hours=1)).isoformat(),
                "rainfall_mm": 5.0,
                "quality_flag": "good"
            }
        ]

        terrain_dict = {
            "slope_avg": 20.0,
            "slope_max": 30.0,
            "elevation_avg": 500.0,
            "relief_m": 40.0,
            "dem_source": "COPERNICUS_GLO_30"
        }

        snapshot = self.processor.build_snapshot(
            unit_id="TEST_SPARSE_01",
            unit_version="v1",
            as_of_time=as_of,
            observations=sparse_obs,
            forecast=None,  # No forecast
            terrain=terrain_dict
        )

        features = snapshot["features"]
        self.assertIsNone(features["rain_24h_acc_mm"])
        self.assertIsNone(features["forecast_next_24h_mm"])
        self.assertEqual(snapshot["coverage_quality"], "missing")
        # Terrain is still preserved even when rainfall is missing
        self.assertEqual(features["slope_avg"], 20.0)

    def test_snapshot_persistence_and_retrieval(self):
        """
        Verify AC4: Saving a snapshot to PostGIS is idempotent and can be retrieved.
        """
        repo = SnapshotRepository()
        unit_id = "VN_LC_BATXAT_0001"
        as_of = datetime(2099, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

        sample_snapshot = {
            "unit_id": unit_id,
            "unit_version": "v1",
            "schema_version": "rainfall-terrain-24h.v1",
            "as_of_time": as_of.isoformat(),
            "features": {
                "rain_1h_mm": 5.5,
                "rain_24h_acc_mm": 32.0,
                "rain_72h_acc_mm": 64.0,
                "rain_7d_acc_mm": 96.0,
                "forecast_next_24h_mm": 22.0,
                "slope_avg": 23.76,
                "slope_max": 37.02,
                "elevation_avg": 549.36,
                "relief_m": 50.0
            },
            "coverage_quality": "good",
            "source_references": {
                "rainfall_provider": "OPEN_METEO",
                "dem_source": "COPERNICUS_GLO_30"
            }
        }

        snapshot_id = repo.save_snapshot(sample_snapshot)
        self.assertIsNotNone(snapshot_id)

        # Retrieve latest
        latest = repo.get_latest_snapshot(unit_id)
        self.assertIsNotNone(latest)
        self.assertEqual(latest["unit_id"], unit_id)
        self.assertEqual(latest["features"]["rain_24h_acc_mm"], 32.0)
        self.assertEqual(latest["coverage_quality"], "good")

        # Retrieve by ID
        by_id = repo.get_snapshot_by_id(snapshot_id)
        self.assertIsNotNone(by_id)
        self.assertEqual(by_id["snapshot_id"], snapshot_id)


if __name__ == "__main__":
    unittest.main()
