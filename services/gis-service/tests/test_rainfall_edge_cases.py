import unittest
from datetime import datetime, timezone, timedelta
from app.pipeline.rainfall_processor import RainfallProcessor


class TestRainfallProcessorEdgeCases(unittest.TestCase):
    """Additional edge-case verification for RainfallProcessor normalization and quality flags."""

    def test_empty_and_mismatched_series_return_missing(self):
        as_of = datetime(2026, 11, 12, 4, 0, 0, tzinfo=timezone.utc)

        empty_res = RainfallProcessor.process_series(
            unit_id="VN_EMPTY",
            open_meteo_data={"hourly": {"time": [], "precipitation": []}},
            as_of=as_of,
        )
        self.assertEqual(empty_res["quality_flag"], "missing")
        self.assertEqual(empty_res["observations"], [])
        self.assertIsNone(empty_res["forecast"])
        self.assertIsNone(empty_res["summary"])

        mismatch_res = RainfallProcessor.process_series(
            unit_id="VN_MISMATCH",
            open_meteo_data={"hourly": {"time": ["2026-11-12T04:00"], "precipitation": [1.0, 2.0]}},
            as_of=as_of,
        )
        self.assertEqual(mismatch_res["quality_flag"], "missing")
        self.assertIsNone(mismatch_res["summary"])

    def test_unsorted_timestamps_and_naive_as_of_normalization(self):
        naive_as_of = datetime(2026, 11, 12, 4, 0, 0)
        utc_as_of = naive_as_of.replace(tzinfo=timezone.utc)

        # Build unsorted past 24h + future 24h series
        entries = []
        for h in range(-23, 25):
            ts = (utc_as_of + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M")
            val = 3.0 if h == 0 else 1.0
            entries.append((ts, val))
        entries.reverse()

        result = RainfallProcessor.process_series(
            unit_id="VN_SORTED",
            open_meteo_data={
                "hourly": {
                    "time": [t for t, _ in entries],
                    "precipitation": [v for _, v in entries],
                }
            },
            as_of=naive_as_of,
        )

        self.assertEqual(result["quality_flag"], "good")
        self.assertEqual(result["summary"]["rain_1h_mm"], 3.0)
        self.assertEqual(result["summary"]["rain_24h_acc_mm"], 26.0)
        self.assertEqual(result["summary"]["forecast_next_24h_mm"], 24.0)

    def test_short_forecast_below_20_hours_rejected(self):
        as_of = datetime(2026, 11, 12, 4, 0, 0, tzinfo=timezone.utc)
        times = []
        precip = []
        for h in range(-23, 20):  # only 19 forecast steps (> as_of)
            times.append((as_of + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M"))
            precip.append(1.5)

        result = RainfallProcessor.process_series(
            unit_id="VN_SHORT_FCST",
            open_meteo_data={"hourly": {"time": times, "precipitation": precip}},
            as_of=as_of,
        )
        self.assertIsNone(result["forecast"])
        self.assertIsNone(result["summary"]["forecast_next_24h_mm"])
        self.assertEqual(result["quality_flag"], "missing")


if __name__ == "__main__":
    unittest.main()
