"""
Standard Library Test Runner for Story 2.1 (Rainfall Ingestion) & Story 2.2 (DEM Terrain)
Runs cleanly in any Python environment without external test runners.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import unittest
import numpy as np
from datetime import datetime, timezone, timedelta
from app.pipeline.rainfall_processor import RainfallProcessor
from app.pipeline.rainfall_repository import RainfallRepository
from app.pipeline.terrain_processor import TerrainProcessor, TerrainMetrics
from app.pipeline.terrain_repository import TerrainRepository
from app.pipeline.terrain_client import OpenMeteoElevationClient
from app.pipeline.snapshot_processor import SnapshotProcessor
from app.pipeline.snapshot_repository import SnapshotRepository


class TestRainfallProcessing(unittest.TestCase):
    def test_rainfall_accumulations(self):
        """Test calculation of 1h, 24h, 72h, 7d accumulations."""
        as_of = datetime(2026, 10, 14, 12, 0, 0, tzinfo=timezone.utc)
        times = []
        precip = []

        start_time = as_of - timedelta(days=7)
        curr = start_time + timedelta(hours=1)
        
        while curr <= as_of + timedelta(hours=24):
            times.append(curr.strftime("%Y-%m-%dT%H:%M"))
            if as_of - timedelta(hours=24) < curr <= as_of:
                precip.append(2.0)  # 24h * 2.0 = 48.0 mm
            elif as_of < curr <= as_of + timedelta(hours=24):
                precip.append(1.5)  # 24h * 1.5 = 36.0 mm
            else:
                precip.append(0.5)  # 120h * 0.5 = 60.0 mm
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
        self.assertIsNotNone(summary)
        self.assertEqual(summary["quality_flag"], "good")
        self.assertEqual(summary["rain_1h_mm"], 2.0)
        self.assertEqual(summary["rain_24h_acc_mm"], 48.0)
        self.assertEqual(summary["forecast_next_24h_mm"], 36.0)
        self.assertEqual(summary["rain_72h_acc_mm"], 72.0)
        self.assertEqual(summary["rain_7d_acc_mm"], 120.0)

    def test_missing_data_quality_invariant(self):
        """Test invariant: Missing intervals yield quality_flag='missing' and NOT zero."""
        as_of = datetime(2026, 10, 14, 12, 0, 0, tzinfo=timezone.utc)
        times = [
            (as_of - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M"),
            (as_of - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M"),
            as_of.strftime("%Y-%m-%dT%H:%M")
        ]
        precip = [10.0, None, 5.0]

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
        self.assertIsNotNone(summary)
        self.assertEqual(summary["quality_flag"], "missing")
        self.assertIsNone(summary["rain_24h_acc_mm"])

    def test_idempotent_database_persistence(self):
        """Test AC4: Upserting observations and forecasts into PostGIS is idempotent."""
        repo = RainfallRepository()
        unit_id = "VN_LC_BATXAT_0001"
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

        c1 = repo.save_rainfall_observations(obs)
        ok1 = repo.save_rainfall_forecast(fcst)
        self.assertEqual(c1, 1)
        self.assertTrue(ok1)

        c2 = repo.save_rainfall_observations(obs)
        ok2 = repo.save_rainfall_forecast(fcst)
        self.assertEqual(c2, 1)
        self.assertTrue(ok2)


class TestTerrainProcessing(unittest.TestCase):
    def setUp(self):
        self.processor = TerrainProcessor()

    def test_flat_terrain(self):
        """Uniform flat grid yields 0 slope and 0 relief."""
        grid = np.full((5, 5), 650.0)
        metrics = self.processor.compute_metrics_from_grid(
            elevation_grid=grid,
            center_lat=22.5,
            step_deg=0.0003
        )
        self.assertEqual(metrics.elevation_avg, 650.0)
        self.assertEqual(metrics.relief_m, 0.0)
        self.assertEqual(metrics.slope_avg, 0.0)

    def test_uniform_incline_slope(self):
        """Uniform incline gives accurate slope angle in degrees."""
        lat = 22.5
        dx = self.processor.degrees_to_meters_lon(0.0003, lat)
        grid = np.zeros((3, 3))
        for col in range(3):
            grid[:, col] = col * dx  # 45 deg incline
        metrics = self.processor.compute_metrics_from_grid(
            elevation_grid=grid,
            center_lat=lat,
            step_deg=0.0003
        )
        self.assertAlmostEqual(metrics.slope_avg, 45.0, delta=1.0)
        self.assertGreater(metrics.relief_m, 0.0)

    def test_nodata_filtering(self):
        """Nodata values (-9999) must be filtered without distorting statistics."""
        grid = np.array([
            [500.0, 510.0, -9999.0],
            [520.0, np.nan, 530.0],
            [-9999.0, 540.0, 550.0]
        ])
        metrics = self.processor.compute_metrics_from_grid(
            elevation_grid=grid,
            center_lat=22.5,
            step_deg=0.0003
        )
        self.assertAlmostEqual(metrics.elevation_avg, 525.0, places=1)
        self.assertEqual(metrics.relief_m, 50.0)

    def test_terrain_repository_persistence(self):
        """Verify updating and querying terrain metrics in PostGIS."""
        repo = TerrainRepository()
        unit_id = "VN_LC_BATXAT_0001"
        sample_metrics = TerrainMetrics(
            elevation_avg=725.5,
            elevation_min=610.0,
            elevation_max=841.0,
            relief_m=231.0,
            slope_avg=28.4,
            slope_max=41.2,
            dem_source="COPERNICUS_GLO_30",
            dem_resolution_m=30.0,
            effective_resolution_m=1000.0,
            valid_cell_count=25
        )

        success = repo.update_terrain_metrics(unit_id, sample_metrics)
        self.assertTrue(success)

        summary = repo.get_terrain_summary(unit_id)
        self.assertIsNotNone(summary)
        self.assertEqual(summary["unit_id"], unit_id)
        self.assertEqual(summary["slope_avg"], 28.4)
        self.assertEqual(summary["slope_max"], 41.2)
        self.assertEqual(summary["relief_m"], 231.0)
        self.assertEqual(summary["elevation_avg"], 725.5)
        self.assertEqual(summary["dem_source"], "COPERNICUS_GLO_30")

    def test_even_grid_size_normalization(self):
        """Even grid sizes must be promoted to odd sizes to guarantee valid centroid and reshaping."""
        client = OpenMeteoElevationClient()
        grid, step, source = client.fetch_grid_around_point(center_lat=22.5, center_lon=103.8, grid_size=4)
        self.assertEqual(grid.shape, (5, 5))
        self.assertIn(source, ["COPERNICUS_GLO_30", "FALLBACK_SYNTHETIC"])


class TestSnapshotProcessing(unittest.TestCase):
    def setUp(self):
        self.processor = SnapshotProcessor()

    def test_temporal_alignment_lookahead_prevention(self):
        """Verify only observations with available_at <= as_of_time are included."""
        as_of = datetime(2026, 10, 14, 12, 0, 0, tzinfo=timezone.utc)
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
        # Future leaked observation
        obs_list.append({
            "interval_start": as_of.isoformat(),
            "interval_end": (as_of + timedelta(hours=1)).isoformat(),
            "available_at": (as_of + timedelta(hours=1)).isoformat(),
            "rainfall_mm": 50.0,
            "quality_flag": "good"
        })

        terrain_dict = {
            "slope_avg": 25.0,
            "slope_max": 38.0,
            "elevation_avg": 600.0,
            "relief_m": 75.0,
            "dem_source": "COPERNICUS_GLO_30"
        }

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
        self.assertEqual(features["rain_24h_acc_mm"], 48.0)
        self.assertEqual(features["forecast_next_24h_mm"], 35.0)
        self.assertEqual(snapshot["coverage_quality"], "good")

    def test_missing_data_degrades_quality_without_zero_filling(self):
        """Verify missing data flags quality as missing and rain fields as None."""
        as_of = datetime(2026, 10, 14, 12, 0, 0, tzinfo=timezone.utc)
        sparse_obs = [{
            "interval_start": (as_of - timedelta(hours=2)).isoformat(),
            "interval_end": (as_of - timedelta(hours=1)).isoformat(),
            "available_at": (as_of - timedelta(hours=1)).isoformat(),
            "rainfall_mm": 5.0,
            "quality_flag": "good"
        }]

        snapshot = self.processor.build_snapshot(
            unit_id="TEST_SPARSE_01",
            unit_version="v1",
            as_of_time=as_of,
            observations=sparse_obs,
            forecast=None,
            terrain={"slope_avg": 20.0}
        )
        self.assertIsNone(snapshot["features"]["rain_24h_acc_mm"])
        self.assertEqual(snapshot["coverage_quality"], "missing")

    def test_snapshot_persistence_and_retrieval(self):
        """Verify idempotent persistence into PostGIS and retrieval."""
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

        latest = repo.get_latest_snapshot(unit_id)
        self.assertIsNotNone(latest)
        self.assertEqual(latest["unit_id"], unit_id)
        self.assertEqual(latest["features"]["rain_24h_acc_mm"], 32.0)

        by_id = repo.get_snapshot_by_id(snapshot_id)
        self.assertIsNotNone(by_id)
        self.assertEqual(by_id["snapshot_id"], snapshot_id)


if __name__ == "__main__":
    unittest.main()
