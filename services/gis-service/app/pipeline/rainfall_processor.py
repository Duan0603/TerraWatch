"""
Rainfall Data Normalizer & Quality Control Processor
Story 2.1: AC2, AC3 - Metric normalization (mm), safe accumulation, and explicit quality flagging.
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple

class RainfallProcessor:
    @staticmethod
    def parse_iso_utc(time_str: str) -> datetime:
        """Parses Open-Meteo time string (e.g., '2026-10-14T15:00') into a timezone-aware UTC datetime."""
        dt = datetime.fromisoformat(time_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    @classmethod
    def process_series(
        cls,
        unit_id: str,
        open_meteo_data: Dict[str, Any],
        as_of: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Processes Open-Meteo hourly precipitation time series.
        Separates past observations from future 24h forecast.
        Computes windowed accumulations with strict quality checks.
        """
        if as_of is None:
            # Truncate to the top of current UTC hour
            now = datetime.now(timezone.utc)
            as_of = now.replace(minute=0, second=0, microsecond=0)
        elif as_of.tzinfo is None:
            as_of = as_of.replace(tzinfo=timezone.utc)

        times_raw = open_meteo_data.get("hourly", {}).get("time", [])
        precip_raw = open_meteo_data.get("hourly", {}).get("precipitation", [])

        if len(times_raw) != len(precip_raw) or not times_raw:
            return {
                "unit_id": unit_id,
                "as_of": as_of.isoformat(),
                "quality_flag": "missing",
                "observations": [],
                "forecast": None,
                "summary": None
            }

        parsed_series: List[Tuple[datetime, Optional[float]]] = []
        for t_str, val in zip(times_raw, precip_raw):
            parsed_series.append((cls.parse_iso_utc(t_str), float(val) if val is not None else None))

        # Sort by timestamp to ensure chronological order
        parsed_series.sort(key=lambda x: x[0])

        # 1. Segment into Observations (t <= as_of) and Forecast (as_of < t <= as_of + 24h)
        obs_series = [(t, v) for t, v in parsed_series if t <= as_of]
        forecast_end = as_of + timedelta(hours=24)
        fcst_series = [(t, v) for t, v in parsed_series if as_of < t <= forecast_end]

        # 2. Accumulation Windows for Historical Observations
        t_1h_ago = as_of - timedelta(hours=1)
        t_24h_ago = as_of - timedelta(hours=24)
        t_72h_ago = as_of - timedelta(hours=72)
        t_7d_ago = as_of - timedelta(days=7)

        def calc_accumulation(series: List[Tuple[datetime, Optional[float]]], start_time: datetime, end_time: datetime) -> Tuple[Optional[float], bool]:
            """Sums precipitation within [start_time, end_time]. Returns (sum_mm, is_complete)."""
            items = [v for t, v in series if start_time < t <= end_time]
            if not items or any(v is None for v in items):
                # Data missing or incomplete - do NOT assume zero!
                return None, False
            return round(sum(items), 2), True

        rain_1h, ok_1h = calc_accumulation(obs_series, t_1h_ago, as_of)
        rain_24h, ok_24h = calc_accumulation(obs_series, t_24h_ago, as_of)
        rain_72h, ok_72h = calc_accumulation(obs_series, t_72h_ago, as_of)
        rain_7d, ok_7d = calc_accumulation(obs_series, t_7d_ago, as_of)

        # 3. Forecast 24h Accumulation
        fcst_items = [v for t, v in fcst_series]
        forecast_24h_mm = None
        ok_fcst = False
        if fcst_items and not any(v is None for v in fcst_items) and len(fcst_items) >= 20: # Allow slight boundary variance
            forecast_24h_mm = round(sum(fcst_items), 2)
            ok_fcst = True

        overall_quality = "good" if (ok_24h and ok_fcst) else "missing"

        # 4. Format database records for observations
        obs_records = []
        for t, v in obs_series[-48:]: # Retain last 48 hourly intervals for database storage
            if v is not None:
                obs_records.append({
                    "unit_id": unit_id,
                    "interval_start": (t - timedelta(hours=1)).isoformat(),
                    "interval_end": t.isoformat(),
                    "available_at": as_of.isoformat(),
                    "rainfall_mm": round(v, 2),
                    "source_provider": "OPEN_METEO",
                    "source_revision": "v1",
                    "quality_flag": "good"
                })

        # 5. Format database record for forecast
        provider_run_id = f"OPEN_METEO_RUN_{as_of.strftime('%Y%m%d_%H')}Z"
        forecast_record = None
        if forecast_24h_mm is not None:
            forecast_record = {
                "unit_id": unit_id,
                "provider_run_id": provider_run_id,
                "provider_name": "OPEN_METEO",
                "issued_at": as_of.isoformat(),
                "valid_from": as_of.isoformat(),
                "valid_until": forecast_end.isoformat(),
                "available_at": as_of.isoformat(),
                "predicted_rain_24h_mm": forecast_24h_mm,
                "quality_flag": "good"
            }

        summary = {
            "unit_id": unit_id,
            "as_of": as_of.isoformat(),
            "rain_1h_mm": rain_1h,  # None when data is missing — never substitute 0.0
            "rain_24h_acc_mm": rain_24h,
            "rain_72h_acc_mm": rain_72h,
            "rain_7d_acc_mm": rain_7d,
            "forecast_next_24h_mm": forecast_24h_mm,
            "quality_flag": overall_quality
        }

        return {
            "unit_id": unit_id,
            "as_of": as_of.isoformat(),
            "quality_flag": overall_quality,
            "observations": obs_records,
            "forecast": forecast_record,
            "summary": summary
        }
