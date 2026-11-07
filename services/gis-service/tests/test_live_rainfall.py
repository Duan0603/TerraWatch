import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from app.pipeline.live_rainfall import normalize_weather, location_key, LiveRainfallService, utc_now


class LiveRainfallTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 5, 8, 25, tzinfo=timezone.utc)
        self.end = self.now.replace(minute=0)
        self.raw = {'utc_offset_seconds': 0, 'hourly_units': {'precipitation': 'mm'}, 'hourly': {
            'time': [(self.end+timedelta(hours=h)).isoformat() for h in range(-167, 25)],
            'precipitation': [1.0]*192}}

    def test_exact_hour_boundaries_and_model_provenance(self):
        data = normalize_weather(self.raw, self.now)
        self.assertEqual(data['history']['168']['mm'], 168)
        self.assertEqual(data['history']['24']['mm'], 24)
        self.assertEqual(data['forecast_24h']['mm'], 24)
        self.assertEqual(data['source_kind'], 'WEATHER_MODEL_ESTIMATE')
        self.assertFalse(data['gru_inference']['ready'])
        self.assertIsNone(data['provider_run_issued_at'])

    def test_missing_timestamp_does_not_become_zero_or_partial_sum(self):
        self.raw['hourly']['time'].pop(166)
        self.raw['hourly']['precipitation'].pop(166)
        data = normalize_weather(self.raw, self.now)
        self.assertIsNone(data['history']['24']['mm'])
        self.assertEqual(data['history']['24']['valid_hours'], 23)
        self.assertEqual(data['quality'], 'partial')

    def test_short_forecast_is_not_reported_as_24h(self):
        self.raw['hourly']['precipitation'][-1] = None
        data = normalize_weather(self.raw, self.now)
        self.assertIsNone(data['forecast_24h']['mm'])
        self.assertEqual(data['forecast_24h']['valid_hours'], 23)

    def test_invalid_values_and_units_are_rejected_or_missing(self):
        self.raw['hourly']['precipitation'][167] = float('nan')
        self.assertIsNone(normalize_weather(self.raw, self.now)['history']['1']['mm'])
        self.raw['hourly_units']['precipitation'] = 'inch'
        with self.assertRaises(ValueError): normalize_weather(self.raw, self.now)

    def test_duplicate_hour_rejected(self):
        self.raw['hourly']['time'][-1] = self.raw['hourly']['time'][-2]
        with self.assertRaises(ValueError): normalize_weather(self.raw, self.now)

    def test_coordinate_key_precision_and_validation(self):
        self.assertEqual(location_key(21.845, 104.085), '21.8450,104.0850')
        with self.assertRaises(ValueError): location_key(float('nan'), 104)

    def service(self):
        service = LiveRainfallService()
        service.repo = MagicMock()
        service.repo.connect.return_value.cursor.return_value.__enter__.return_value.fetchone.return_value = (True,)
        service.locations = MagicMock(return_value=[{'key': 'test', 'name': 'test', 'latitude': 21., 'longitude': 104.}])
        service.fetch = MagicMock(return_value={'provider': 'test'})
        return service

    def test_recent_fetch_skipped_to_protect_provider_quota(self):
        service = self.service()
        service.repo.get.return_value = {'last_attempt_at': utc_now()}
        service.run_once()
        service.fetch.assert_not_called()
        service.repo.connect.return_value.close.assert_called_once()

    def test_nonleader_worker_does_not_fetch(self):
        service = self.service()
        service.repo.connect.return_value.cursor.return_value.__enter__.return_value.fetchone.return_value = (False,)
        service.run_once()
        service.fetch.assert_not_called()
        service.repo.connect.return_value.close.assert_called_once()

    def test_provider_error_is_sanitized_and_not_saved_as_new_data(self):
        service = self.service()
        service.repo.get.return_value = None
        service.fetch.side_effect = RuntimeError('secret-api-key-in-upstream-url')
        service.run_once()
        self.assertEqual(service.repo.save.call_args.kwargs, {'error': 'RuntimeError'})
        self.assertFalse(service.state['running'])

    def test_unnamed_or_invalid_db_units_do_not_block_valid_locations(self):
        service = LiveRainfallService()
        with patch('app.pipeline.live_rainfall.RainfallRepository') as repo:
            repo.return_value.get_assessment_units.return_value = [
                {'unit_id': 'UNNAMED', 'unit_name': None, 'latitude': 20., 'longitude': 105.},
                {'unit_id': 'MISSING', 'unit_name': 'missing', 'latitude': None, 'longitude': None}]
            locations = service.locations()
        self.assertTrue(any(p['name'] == 'UNNAMED' for p in locations))
        self.assertTrue(any(p['key'] == '21.8450,104.0850' for p in locations))
        self.assertFalse(any(p['name'] == 'missing' for p in locations))

    def test_inference_is_held_for_stale_or_incomplete_weather(self):
        service = LiveRainfallService()
        location = {'key': '21.8450,104.0850'}
        payload = normalize_weather(self.raw, self.now)
        self.assertEqual(service.predict(location, payload)['reason'], 'WEATHER_STALE')
        now = utc_now().replace(minute=0, second=0, microsecond=0)
        payload['as_of'] = now.isoformat()
        payload['hourly'] = []
        self.assertEqual(service.predict(location, payload)['reason'], 'INCOMPLETE_WEATHER')

    def test_cached_prediction_update_does_not_re_fetch_weather(self):
        service = self.service()
        service.repo.get.return_value = {'last_attempt_at': utc_now(),
            'payload': {'as_of': utc_now().isoformat(), 'gru_inference': {'ready': False}}}
        service.predict = MagicMock(return_value={'ready': True})
        service.run_once()
        service.fetch.assert_not_called()
        service.repo.save_prediction.assert_called_once()
        service.repo.save.assert_not_called()


if __name__ == '__main__': unittest.main()
