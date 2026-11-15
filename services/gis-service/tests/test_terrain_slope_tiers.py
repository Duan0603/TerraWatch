import unittest
import numpy as np
from app.pipeline.terrain_processor import TerrainProcessor, TerrainMetrics


class TerrainSlopeTiersTests(unittest.TestCase):
    def setUp(self):
        self.processor = TerrainProcessor()

    def test_geodesic_distance_projections(self):
        # Around Lao Cai (lat 22.5 N):
        # 1 deg lat is approximately 110,750 m (valid range 110,000 - 112,000)
        dy = self.processor.degrees_to_meters_lat(1.0, 22.5)
        self.assertGreater(dy, 110000.0)
        self.assertLess(dy, 112000.0)

        # 1 deg lon at 22.5 N is approx 102,800 m (valid range 101,000 - 104,000)
        dx = self.processor.degrees_to_meters_lon(1.0, 22.5)
        self.assertGreater(dx, 101000.0)
        self.assertLess(dx, 104000.0)

        # 0 deg returns 0.0 meters
        self.assertEqual(self.processor.degrees_to_meters_lat(0.0, 22.5), 0.0)
        self.assertEqual(self.processor.degrees_to_meters_lon(0.0, 22.5), 0.0)

    def test_flat_grid_metrics(self):
        # 5x5 perfectly flat grid at 500m elevation
        flat_grid = np.full((5, 5), 500.0)
        metrics = self.processor.compute_metrics_from_grid(
            flat_grid, center_lat=22.5, step_deg=0.000277778  # ~30m
        )
        self.assertEqual(metrics.elevation_min, 500.0)
        self.assertEqual(metrics.elevation_max, 500.0)
        self.assertEqual(metrics.elevation_avg, 500.0)
        self.assertEqual(metrics.relief_m, 0.0)
        self.assertEqual(metrics.slope_avg, 0.0)
        self.assertEqual(metrics.slope_max, 0.0)
        self.assertEqual(metrics.valid_cell_count, 25)

    def test_nodata_and_nan_masking(self):
        # Grid with NaN and nodata sentinel -9999.0
        grid = np.array([
            [100.0, 100.0, 100.0],
            [100.0, -9999.0, 100.0],
            [100.0, np.nan, 200.0]
        ])
        metrics = self.processor.compute_metrics_from_grid(
            grid, center_lat=22.5, step_deg=0.000277778
        )
        self.assertEqual(metrics.elevation_min, 100.0)
        self.assertEqual(metrics.elevation_max, 200.0)
        self.assertEqual(metrics.relief_m, 100.0)
        self.assertEqual(metrics.valid_cell_count, 7)

    def test_all_invalid_grid_raises_value_error(self):
        invalid_grid = np.full((3, 3), -9999.0)
        with self.assertRaises(ValueError):
            self.processor.compute_metrics_from_grid(
                invalid_grid, center_lat=22.5, step_deg=0.000277778
            )


if __name__ == '__main__':
    unittest.main()
