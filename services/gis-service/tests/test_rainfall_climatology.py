import unittest
from app.pipeline.live_rainfall import location_key, rain_anomaly, load_climatology


class RainfallClimatologyTests(unittest.TestCase):
    def test_location_key_formatting_and_validation(self):
        # 1. Standard Vietnam coordinates formatting (4 decimal places)
        self.assertEqual(location_key(22.3364, 103.8438), '22.3364,103.8438')
        self.assertEqual(location_key(22.1, 104.5), '22.1000,104.5000')

        # 2. Boundary coordinates
        self.assertEqual(location_key(90.0, 180.0), '90.0000,180.0000')
        self.assertEqual(location_key(-90.0, -180.0), '-90.0000,-180.0000')

        # 3. Invalid coordinates raise ValueError
        with self.assertRaises(ValueError):
            location_key(91.0, 105.0)
        with self.assertRaises(ValueError):
            location_key(22.0, 181.0)
        with self.assertRaises(ValueError):
            location_key(float('nan'), 105.0)
        with self.assertRaises(ValueError):
            location_key(22.0, float('inf'))

    def test_rain_anomaly_scoring(self):
        # Sample climatology reference
        climate = {
            'period': '2000-2025',
            'windows': {
                '24': {'p95': 35.0, 'p99': 70.0, 'p99_9': 120.0, 'max': 250.0},
                '72': {'p95': 85.0, 'p99': 160.0, 'p99_9': 240.0, 'max': 450.0}
            }
        }

        # 1. Anomaly for extreme rainfall (p99_9 level)
        payload_extreme = {
            'history': {'24': {'mm': 130.0}, '72': {'mm': 250.0}},
            'forecast_24h': {'mm': 40.0}
        }
        res_extreme = rain_anomaly(climate, payload_extreme)
        self.assertEqual(res_extreme['history_24h']['level'], 'p99_9')
        self.assertEqual(res_extreme['history_72h']['level'], 'p99_9')
        self.assertEqual(res_extreme['forecast_24h']['level'], 'p95')

        # 2. Anomaly for moderate rainfall (below p95 -> None)
        payload_low = {
            'history': {'24': {'mm': 10.0}, '72': {'mm': 20.0}},
            'forecast_24h': {'mm': 5.0}
        }
        res_low = rain_anomaly(climate, payload_low)
        self.assertIsNone(res_low['history_24h']['level'])
        self.assertIsNone(res_low['history_72h']['level'])
        self.assertIsNone(res_low['forecast_24h']['level'])

        # 3. None climate returns None
        self.assertIsNone(rain_anomaly(None, payload_extreme))


if __name__ == '__main__':
    unittest.main()
