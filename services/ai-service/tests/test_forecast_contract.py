import unittest
from datetime import datetime, timezone

from fastapi import HTTPException
from pydantic import ValidationError

from app.main import ForecastRequest, evaluate_forecast


def request(**overrides):
    body = {
        'schema_version': 'rainfall-terrain-24h.v1',
        'snapshot_id': 'snap-1',
        'assessment_unit_id': 'VN_LC_BATXAT_0003',
        'assessment_unit_version': 'v1',
        'issued_at': '2026-11-07T08:00:00Z',
        'horizon_hours': 24,
        'model_version': 'xgb-baseline-v1',
    }
    body.update(overrides)
    return ForecastRequest(**body)


class ForecastContractTest(unittest.TestCase):
    def test_never_fabricates_a_score_and_explains_why(self):
        result = evaluate_forecast(request())
        self.assertEqual(result['availability'], 'unavailable')
        self.assertIsNone(result['probability'])
        self.assertIsNone(result['experimental_score'])
        self.assertIsNone(result['hazard_level'])
        self.assertEqual(result['reason_codes'], ['MODEL_NOT_RELEASED'])
        self.assertEqual(result['unavailability_reason'], 'MODEL_NOT_RELEASED')
        self.assertEqual(result['valid_until'], '2026-11-08T08:00:00+00:00')

    def test_a_missing_snapshot_is_reported(self):
        result = evaluate_forecast(request(snapshot_id='  '))
        self.assertEqual(result['reason_codes'], ['SNAPSHOT_MISSING', 'MODEL_NOT_RELEASED'])

    def test_wrong_schema_horizon_or_unit_is_rejected(self):
        for bad in ({'schema_version': 'v0'}, {'horizon_hours': 48}, {'assessment_unit_id': ''}):
            with self.assertRaises(ValidationError):
                request(**bad)

    def test_issue_time_needs_a_timezone(self):
        req = request(issued_at=datetime(2026, 11, 7, 8, 0))
        with self.assertRaises(HTTPException) as ctx:
            evaluate_forecast(req)
        self.assertEqual(ctx.exception.status_code, 422)
        self.assertEqual(evaluate_forecast(request(issued_at=datetime(2026, 11, 7, 8, tzinfo=timezone.utc)))['horizon_hours'], 24)


if __name__ == '__main__':
    unittest.main()
