import csv
import unittest
from pathlib import Path

import numpy as np

from inference_demo import predict

HERE = Path(__file__).resolve().parent


class PublishedModelTests(unittest.TestCase):
    def setUp(self):
        with (HERE / 'demo_input_8.csv').open(encoding='utf-8-sig', newline='') as f:
            self.rows = list(csv.DictReader(f))

    def test_both_branches_match_published_scores(self):
        with (HERE / 'demo_expected_8.csv').open(encoding='utf-8-sig', newline='') as f:
            expected = list(csv.DictReader(f))
        actual = predict(self.rows, HERE / 'outputs/two_branch_gru_1km.pt')
        for values, field in zip(actual, ['p_temporal_gru', 'p_spatial_12dist_slope_soil', 'p_hazard_slope_soil']):
            np.testing.assert_allclose(values, [float(r[field]) for r in expected], atol=1e-4, rtol=0)
        self.assertTrue(np.all((actual[2] >= 0) & (actual[2] <= 1)))

    def test_missing_and_nonfinite_input_is_rejected(self):
        row = dict(self.rows[0])
        row.pop('rain_h001')
        with self.assertRaisesRegex(ValueError, 'Missing columns'):
            predict([row], HERE / 'outputs/two_branch_gru_1km.pt')
        row = dict(self.rows[0], rain_h001='nan')
        with self.assertRaisesRegex(ValueError, 'nonfinite'):
            predict([row], HERE / 'outputs/two_branch_gru_1km.pt')


if __name__ == '__main__':
    unittest.main()
