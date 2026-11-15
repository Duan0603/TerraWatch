import unittest
from app.pipeline import rain_warning as rw


class RainWarningExtendedTests(unittest.TestCase):
    def setUp(self):
        self.thresholds = {
            '24': {'p95': 30.0, 'p99': 60.0, 'p99_9': 100.0},
            '72': {'p95': 80.0, 'p99': 150.0, 'p99_9': 220.0},
            '120': {'p95': 100.0, 'p99': 180.0, 'p99_9': 260.0}
        }
        self.quantiles = [
            [0, 0.0],
            [50, 20.0],
            [75, 50.0],
            [90, 80.0],
            [95, 120.0],
            [99, 180.0],
            [100, 250.0]
        ]

    def test_days_below_boundary_conditions(self):
        # Exact lower boundary
        self.assertEqual(rw.days_below(0.0, self.quantiles), 0.0)
        # Exact upper boundary
        self.assertEqual(rw.days_below(250.0, self.quantiles), 100.0)
        # Above maximum (capped at 100.0)
        self.assertEqual(rw.days_below(300.0, self.quantiles), 100.0)
        # Linear interpolation between 50% (20.0mm) and 75% (50.0mm): at 35.0mm -> 62.5%
        self.assertAlmostEqual(rw.days_below(35.0, self.quantiles), 62.5, places=1)
        # None input returns None
        self.assertIsNone(rw.days_below(None, self.quantiles))

    def test_level_of_dominance_and_boundaries(self):
        # 1. Below all thresholds -> level 0 (None)
        self.assertEqual(rw.level_of({'72': 50.0, '120': 80.0}, self.thresholds), 0)
        # 2. 72h reaches watch (80.0mm), 120h is low
        self.assertEqual(rw.level_of({'72': 80.0, '120': 50.0}, self.thresholds), 1)
        # 3. 120h reaches warning (180.0mm), 72h is watch
        self.assertEqual(rw.level_of({'72': 90.0, '120': 185.0}, self.thresholds), 2)
        # 4. 72h reaches danger (225.0mm), 120h is normal
        self.assertEqual(rw.level_of({'72': 225.0, '120': 90.0}, self.thresholds), 3)
        # 5. Missing 72h total returns None
        self.assertIsNone(rw.level_of({'72': None, '120': 200.0}, self.thresholds))
        # 6. Missing 120h total returns None
        self.assertIsNone(rw.level_of({'72': 200.0, '120': None}, self.thresholds))

    def test_totals_ending_window_exact_lengths(self):
        # Short sequence (< 24) returns all None
        vals_short = [2.0] * 20
        self.assertEqual(rw.totals_ending(vals_short, 19), {'24': None, '72': None, '120': None})

        # Exactly 24 elements (24 is valid, 72 and 120 are None)
        vals_24 = [1.5] * 24
        t24 = rw.totals_ending(vals_24, 23)
        self.assertEqual(t24['24'], 36.0)
        self.assertIsNone(t24['72'])
        self.assertIsNone(t24['120'])

        # Exactly 72 elements (24 and 72 valid, 120 is None)
        vals_72 = [1.0] * 72
        t72 = rw.totals_ending(vals_72, 71)
        self.assertEqual(t72['24'], 24.0)
        self.assertEqual(t72['72'], 72.0)
        self.assertIsNone(t72['120'])

        # Exactly 120 elements (all valid)
        vals_120 = [0.5] * 120
        t120 = rw.totals_ending(vals_120, 119)
        self.assertEqual(t120['24'], 12.0)
        self.assertEqual(t120['72'], 36.0)
        self.assertEqual(t120['120'], 60.0)


if __name__ == '__main__':
    unittest.main()
