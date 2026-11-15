import unittest
from datetime import datetime, timedelta, timezone
from app.pipeline.live_rainfall import backfill_payloads, map_feature


class RainfallHistoryWindowingTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 15, 10, 0, tzinfo=timezone.utc)
        self.as_of = self.now
        # Synthetic payload with hourly intervals covering 168 hours past + 24 hours future
        self.payload = {
            'as_of': self.as_of.isoformat(),
            'fetched_at': self.now.isoformat(),
            'provider': 'OPEN_METEO',
            'source_kind': 'WEATHER_MODEL_ESTIMATE',
            'hourly': [
                {'interval_end': (self.as_of + timedelta(hours=h)).isoformat(), 'mm': 1.5}
                for h in range(-167, 25)
            ]
        }

    def test_backfill_empty_stored_returns_empty(self):
        # When nothing has been recorded yet, backfill returns []
        self.assertEqual(backfill_payloads(self.payload, set()), [])

    def test_backfill_fills_missing_hourly_intervals(self):
        # Point monitored since 5 hours ago, but only hours T-5 and T-1 exist in DB
        t_minus_5 = self.as_of - timedelta(hours=5)
        t_minus_1 = self.as_of - timedelta(hours=1)
        stored = {t_minus_5, t_minus_1}

        backfilled = backfill_payloads(self.payload, stored)
        # Should backfill T-4, T-3, T-2 (total 3 records)
        self.assertEqual(len(backfilled), 3)
        backfill_times = [datetime.fromisoformat(b['as_of']) for b in backfilled]
        self.assertIn(self.as_of - timedelta(hours=4), backfill_times)
        self.assertIn(self.as_of - timedelta(hours=3), backfill_times)
        self.assertIn(self.as_of - timedelta(hours=2), backfill_times)

        # Check metadata
        for b in backfilled:
            self.assertEqual(b['origin'], 'backfill')
            self.assertEqual(b['quality'], 'backfill')
            self.assertIsNone(b['forecast_24h']['mm'])

    def test_map_feature_stale_and_current_flags(self):
        # 1. Fresh location with ready GRU
        row_fresh = {
            'location_key': '22.3364,103.8438',
            'location_name': 'Sa Pa',
            'latitude': 22.3364,
            'longitude': 103.8438,
            'last_success_at': self.now - timedelta(minutes=15),
            'last_error': None,
            'gru': {
                'ready': True,
                'hazard_score': 0.72,
                'valid_until': (self.now + timedelta(hours=2)).isoformat(),
                'issue_time': self.now.isoformat()
            }
        }
        feat_fresh = map_feature(row_fresh, interval=3600, now=self.now)
        self.assertEqual(feat_fresh['type'], 'Feature')
        self.assertEqual(feat_fresh['geometry']['coordinates'], [103.8438, 22.3364])
        self.assertTrue(feat_fresh['properties']['current'])
        self.assertFalse(feat_fresh['properties']['stale'])
        self.assertFalse(feat_fresh['properties']['expired'])

        # 2. Stale location (last success > 1.5 * interval)
        row_stale = dict(row_fresh, last_success_at=self.now - timedelta(hours=3))
        feat_stale = map_feature(row_stale, interval=3600, now=self.now)
        self.assertTrue(feat_stale['properties']['stale'])
        self.assertFalse(feat_fresh['properties']['stale'] == feat_stale['properties']['stale'])
        self.assertFalse(feat_stale['properties']['current'])


if __name__ == '__main__':
    unittest.main()
