import json
import unittest
from pathlib import Path
from unittest.mock import patch, Mock

import numpy as np

from app.services.live_gru import LiveGRU


class LiveGRUTests(unittest.TestCase):
    def setUp(self):
        self.model = LiveGRU()
        self.cases = json.loads((Path(__file__).parent/'fixtures/live_gru_cases.json').read_text())

    def test_matches_canonical_pytorch_checkpoint(self):
        for case in self.cases:
            actual = self.model.predict(case['history'], case['forecast'], case['static'])
            for key, expected in case['expected'].items():
                self.assertAlmostEqual(actual[key], expected, delta=1e-5)
            self.assertFalse(actual['calibrated_probability'])
            self.assertFalse(actual['operational_alert'])

    def test_incomplete_or_invalid_rain_is_rejected(self):
        case = self.cases[0]
        for history in [case['history'][:-1], [float('nan')]*168, [-1]*168]:
            with self.assertRaises(ValueError): self.model.predict(history, case['forecast'], case['static'])

    def test_invalid_soil_is_not_imputed(self):
        case = self.cases[0]
        with self.assertRaises((KeyError, ValueError)):
            self.model.predict(case['history'], case['forecast'], {})

    def test_weight_digest_is_enforced(self):
        with patch('app.services.live_gru.hashlib.sha256', return_value=Mock(hexdigest=lambda: 'invalid')):
            with self.assertRaisesRegex(ValueError, 'integrity'): LiveGRU()

    def test_info_endpoint_states_what_the_gru_is_not(self):  # Story 4.29
        from app.main import gru_model_info
        info = gru_model_info()
        self.assertTrue(info['ready'])
        self.assertIs(info['calibrated_probability'], False)
        self.assertEqual(info['trained_history_provider'], 'IMERG')
        self.assertEqual(info['trained_forecast_provider'], 'GFS')

    def test_chronological_blocks_summary_and_normalization(self):
        # Unequal hours distinguish contiguous 7h blocks from day/hour transpose.
        history = np.arange(168, dtype=float)
        arrays = []
        original = np.log1p
        def capture(value):
            result = original(value)
            arrays.append(result)
            return result
        with patch('app.services.live_gru.np.log1p', side_effect=capture):
            self.model.predict(history, 17, self.cases[0]['static'])
        expected = [original(history).reshape(1, 24, 7),
                    original([[history[-24:].sum(), history[-72:].sum(),
                               history.sum(), history.max(), 17]])]
        for actual, raw, name in zip(arrays, expected, ('seq_norm_b', 'sum_norm_b')):
            norm = self.model.card[name]
            np.testing.assert_allclose(actual.reshape(raw.shape),
                                       (raw - norm['mean']) / norm['std'])

    def test_uniform_week_rain_sweep_is_monotonic(self):
        # This one controlled family passes; burst rainfall is NOT monotonic.
        scores = [self.model.predict([mm/24]*168, 30, self.cases[0]['static'])['temporal_score']
                  for mm in (0, 10, 30, 60, 100, 150)]
        self.assertTrue(all(a <= b for a, b in zip(scores, scores[1:])))

    def test_elevation_is_required_by_elevation_checkpoint(self):
        self.assertIn('elevation_m', self.model.card['spatial_12dist_slope_soil']['features'])
        case = self.cases[0]
        for elevation in (None, float('nan')):
            with self.assertRaises(ValueError):
                self.model.predict(case['history'], case['forecast'], {**case['static'], 'elevation_m': elevation})

    def test_burst_rain_sweep_is_monotonic(self):
        scores = [self.model.predict([0]*162+[mm/6]*6, 0, self.cases[0]['static'])['temporal_score']
                  for mm in (0, 10, 30, 60, 100, 150)]
        self.assertTrue(all(a <= b for a, b in zip(scores, scores[1:])))


if __name__ == '__main__': unittest.main()
