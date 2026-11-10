import json
import unittest
from pathlib import Path
from unittest.mock import patch, Mock

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


if __name__ == '__main__': unittest.main()
