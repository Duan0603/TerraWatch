import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from app.pipeline.live_rainfall import normalize_weather, location_key, LiveRainfallService, utc_now, map_feature


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

    def add_weather(self):
        n = len(self.raw['hourly']['time'])
        self.raw['hourly_units'].update({'temperature_2m': '°C', 'relative_humidity_2m': '%',
                                         'precipitation_probability': '%', 'wind_speed_10m': 'km/h',
                                         'weather_code': 'wmo code'})
        self.raw['hourly'].update({'temperature_2m': [float(i) for i in range(n)], 'relative_humidity_2m': [80]*n,
                                   'precipitation_probability': [30]*n, 'wind_speed_10m': [10.0]*n,
                                   'weather_code': [61]*n})

    def test_weather_days_follow_vietnam_calendar(self):
        self.add_weather()
        weather = normalize_weather(self.raw, self.now)['weather']
        # as_of 08:00 UTC = 15:00 Nov 5 in Vietnam; data ends 15:00 Nov 6 Vietnam time.
        self.assertEqual([d['date'] for d in weather['daily']], ['2026-11-05', '2026-11-06'])
        today, tomorrow = weather['daily']
        self.assertEqual((today['rain_mm'], today['rain_valid_hours']), (24, 24))
        self.assertEqual((today['temp_min_c'], today['temp_max_c']), (152, 175))  # local 00:00..23:00
        self.assertIsNone(tomorrow['rain_mm'])  # partial day is not reported as a daily total
        self.assertEqual(tomorrow['rain_valid_hours'], 15)
        self.assertEqual(weather['current']['temperature_2m'], 167)
        self.assertEqual(weather['current']['at'], self.end.isoformat())

    def test_bad_weather_variables_do_not_block_rainfall(self):
        self.assertIsNone(normalize_weather(self.raw, self.now)['weather'])  # older payload shape
        self.add_weather()
        self.raw['hourly_units']['temperature_2m'] = '°F'
        data = normalize_weather(self.raw, self.now)
        self.assertIsNone(data['weather'])
        self.assertEqual(data['forecast_24h']['mm'], 24)

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


class LiveMapFeatureTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 12, 13, 30, tzinfo=timezone.utc)
        self.gru = {'ready': True, 'hazard_score': 0.59, 'temporal_score': 1.0, 'spatial_score': 0.59,
                    'issue_time': '2026-11-12T13:00:00+00:00', 'valid_until': '2026-11-13T13:00:00+00:00',
                    'unit_id': 'UTM48N_1km_408000_2494000'}
        self.row = {'location_key': '22.5250,103.8650', 'location_name': 'Ô 002', 'latitude': 22.525, 'longitude': 103.865,
                    'last_success_at': self.now - timedelta(minutes=20), 'last_error': None, 'gru': self.gru,
                    'rain_24h_mm': 24.8, 'forecast_24h_mm': 14.2,
                    'geom': '{"type":"Polygon","coordinates":[[[103.86,22.52],[103.87,22.52],[103.87,22.53],[103.86,22.52]]]}'}

    def test_unit_centre_uses_unit_polygon_and_is_current(self):
        f = map_feature(self.row, 3600, self.now)
        self.assertEqual(f['geometry']['type'], 'Polygon')
        self.assertTrue(f['properties']['current'])
        self.assertEqual(f['properties']['hazard_score'], 0.59)

    def test_location_without_unit_falls_back_to_point(self):
        self.row['geom'] = None
        self.assertEqual(map_feature(self.row, 3600, self.now)['geometry'], {'type': 'Point', 'coordinates': [103.865, 22.525]})

    def test_stale_weather_expired_or_missing_result_is_not_current(self):
        stale = dict(self.row, last_success_at=self.now - timedelta(hours=2))
        self.assertFalse(map_feature(stale, 3600, self.now)['properties']['current'])
        failed = dict(self.row, last_error='HTTPError HTTP 503')
        self.assertFalse(map_feature(failed, 3600, self.now)['properties']['current'])
        expired = dict(self.row, gru=dict(self.gru, valid_until='2026-11-12T13:00:00+00:00'))
        props = map_feature(expired, 3600, self.now)['properties']
        self.assertTrue(props['expired'])
        self.assertFalse(props['current'])
        held = dict(self.row, gru={'ready': False, 'reason': 'STATIC_FEATURES_UNAVAILABLE'})
        props = map_feature(held, 3600, self.now)['properties']
        self.assertFalse(props['current'])
        self.assertEqual(props['reason'], 'STATIC_FEATURES_UNAVAILABLE')
