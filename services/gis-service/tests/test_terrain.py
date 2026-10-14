import unittest
import numpy as np
from app.pipeline.terrain_processor import TerrainProcessor, TerrainMetrics


class TestTerrainProcessor(unittest.TestCase):
    def setUp(self):
        self.processor = TerrainProcessor()

    def test_flat_terrain_metrics(self):
        """Uniform flat elevation grid should yield 0 slope and 0 relief."""
        lat = 22.5
        lon = 103.8
        # 5x5 grid of 500m elevation
        elevation_grid = np.full((5, 5), 500.0)
        # grid step: 0.0003 degrees (~30m)
        step_deg = 0.00027

        metrics = self.processor.compute_metrics_from_grid(
            elevation_grid=elevation_grid,
            center_lat=lat,
            step_deg=step_deg
        )

        self.assertAlmostEqual(metrics.elevation_avg, 500.0, places=1)
        self.assertAlmostEqual(metrics.elevation_min, 500.0, places=1)
        self.assertAlmostEqual(metrics.elevation_max, 500.0, places=1)
        self.assertAlmostEqual(metrics.relief_m, 0.0, places=1)
        self.assertAlmostEqual(metrics.slope_avg, 0.0, places=1)
        self.assertAlmostEqual(metrics.slope_max, 0.0, places=1)

    def test_uniform_incline_slope(self):
        """Test a 45 degree slope where dz == dx."""
        lat = 22.5
        # Calculate metric dx for step_deg
        dx = self.processor.degrees_to_meters_lon(0.0003, lat)
        
        # Create a 3x3 grid sloping East-West
        # dz between col 0 and col 2 is 2 * dx => dz/dx = 1.0 (45 degrees)
        grid = np.zeros((3, 3))
        for col in range(3):
            grid[:, col] = col * dx

        metrics = self.processor.compute_metrics_from_grid(
            elevation_grid=grid,
            center_lat=lat,
            step_deg=0.0003
        )

        # Center cell should have slope ~ 45 degrees
        self.assertAlmostEqual(metrics.slope_avg, 45.0, delta=1.0)
        self.assertGreater(metrics.relief_m, 0.0)

    def test_nodata_filtering(self):
        """Points with -9999 or NaN must be masked out and not distort relief or mean."""
        lat = 22.5
        grid = np.array([
            [500.0, 510.0, -9999.0],
            [520.0, np.nan, 530.0],
            [-9999.0, 540.0, 550.0]
        ])

        metrics = self.processor.compute_metrics_from_grid(
            elevation_grid=grid,
            center_lat=lat,
            step_deg=0.0003,
            nodata_values=[-9999.0]
        )

        # Mean of [500, 510, 520, 530, 540, 550] = 525.0
        self.assertAlmostEqual(metrics.elevation_avg, 525.0, places=1)
        self.assertEqual(metrics.elevation_min, 500.0)
        self.assertEqual(metrics.elevation_max, 550.0)
        self.assertEqual(metrics.relief_m, 50.0)

    def test_metric_coordinate_conversion(self):
        """Check conversion factors around Lao Cai (lat 22.5)."""
        dy = self.processor.degrees_to_meters_lat(1.0)
        dx = self.processor.degrees_to_meters_lon(1.0, lat=22.5)

        # 1 deg latitude is roughly 110.5 - 110.8 km
        self.assertGreater(dy, 110000.0)
        self.assertLess(dy, 111500.0)

        # 1 deg longitude at 22.5 N is roughly 102 - 104 km
        self.assertGreater(dx, 101000.0)
        self.assertLess(dx, 104000.0)

    def test_even_grid_size_normalization(self):
        """Even grid sizes must be promoted to odd sizes to guarantee valid centroid and reshaping."""
        from app.pipeline.terrain_client import OpenMeteoElevationClient
        client = OpenMeteoElevationClient()
        grid, step, source = client.fetch_grid_around_point(center_lat=22.5, center_lon=103.8, grid_size=4)
        self.assertEqual(grid.shape, (5, 5))
        self.assertIn(source, ["COPERNICUS_GLO_30", "FALLBACK_SYNTHETIC"])


if __name__ == '__main__':
    unittest.main()
