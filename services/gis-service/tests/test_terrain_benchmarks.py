import json
import os
import unittest
import numpy as np
from app.pipeline.terrain_processor import TerrainProcessor


class TestTerrainBenchmarks(unittest.TestCase):
    """Benchmark tests validating DEM terrain extraction algorithms and geodetic projections."""

    def setUp(self):
        self.processor = TerrainProcessor()
        fixtures_path = os.path.join(os.path.dirname(__file__), 'fixtures', 'synthetic_terrain_profiles.json')
        with open(fixtures_path, 'r', encoding='utf-8') as f:
            self.fixtures = json.load(f)

    def test_flat_plain_profile(self):
        """Flat terrain profile should have zero slope and zero relief."""
        profile = self.fixtures['profiles']['flat_plain']
        grid = np.array(profile['elevation_m'])
        metrics = self.processor.compute_metrics_from_grid(
            elevation_grid=grid,
            center_lat=22.5,
            step_deg=0.00027
        )
        self.assertAlmostEqual(metrics.slope_avg, 0.0, places=2)
        self.assertAlmostEqual(metrics.relief_m, 0.0, places=2)

    def test_escarpment_cliff_relief(self):
        """Escarpment profile should detect high relief and significant slope."""
        profile = self.fixtures['profiles']['escarpment_cliff']
        grid = np.array(profile['elevation_m'])
        metrics = self.processor.compute_metrics_from_grid(
            elevation_grid=grid,
            center_lat=22.3,
            step_deg=0.00027
        )
        self.assertEqual(metrics.relief_m, profile['expected_relief_m'])
        self.assertGreater(metrics.slope_max, 45.0)

    def test_geodesic_latitude_scaling(self):
        """Geodesic meter conversion must scale correctly between Northern and Southern Vietnam."""
        # Lao Cai (Northern border ~22.5 N)
        dx_north = self.processor.degrees_to_meters_lon(0.001, lat=22.5)
        # Ca Mau (Southern tip ~8.5 N)
        dx_south = self.processor.degrees_to_meters_lon(0.001, lat=8.5)

        # 1 deg lon is wider near the equator (Southern Vietnam) than near Tropic of Cancer (Northern Vietnam)
        self.assertGreater(dx_south, dx_north)
        self.assertAlmostEqual(dx_north / dx_south, np.cos(np.radians(22.5)) / np.cos(np.radians(8.5)), delta=0.01)


if __name__ == '__main__':
    unittest.main()
