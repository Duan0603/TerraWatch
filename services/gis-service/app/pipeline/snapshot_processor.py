import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("SnapshotProcessor")


class SnapshotProcessor:
    """
    Feature snapshot alignment processor.
    Unifies dynamic rainfall observations, weather forecast accumulation, and static DEM terrain metrics
    into a versioned, immutable feature vector at a precise prediction issue time t (as_of_time).
    Enforces strict temporal invariants (available_at <= as_of_time) to prevent lookahead bias.
    """

    DEFAULT_SCHEMA_VERSION = "rainfall-terrain-24h.v1"
    DEFAULT_UNIT_VERSION = "v1"

    @staticmethod
    def parse_iso_utc(time_val: Any) -> datetime:
        """Parses an ISO string or datetime object into a timezone-aware UTC datetime."""
        if isinstance(time_val, datetime):
            dt = time_val
        elif isinstance(time_val, str):
            dt = datetime.fromisoformat(time_val)
        else:
            raise ValueError(f"Cannot parse timestamp: {time_val}")

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    @classmethod
    def build_snapshot(
        cls,
        unit_id: str,
        as_of_time: Optional[datetime] = None,
        unit_version: str = DEFAULT_UNIT_VERSION,
        schema_version: str = DEFAULT_SCHEMA_VERSION,
        observations: Optional[List[Dict[str, Any]]] = None,
        forecast: Optional[Dict[str, Any]] = None,
        terrain: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Builds an immutable feature snapshot dictionary.
        """
        if as_of_time is None:
            now = datetime.now(timezone.utc)
            as_of_time = now.replace(minute=0, second=0, microsecond=0)
        else:
            as_of_time = cls.parse_iso_utc(as_of_time)

        if observations is None:
            observations = []
        if terrain is None:
            terrain = {}

        # 1. Enforce Temporal Invariant AC1: available_at <= as_of_time & interval_end <= as_of_time
        valid_obs: List[Tuple[datetime, float]] = []
        for obs in observations:
            try:
                avail = cls.parse_iso_utc(obs.get("available_at", obs.get("interval_end")))
                end_time = cls.parse_iso_utc(obs["interval_end"])
                val = obs.get("rainfall_mm")

                if avail <= as_of_time and end_time <= as_of_time and val is not None:
                    valid_obs.append((end_time, float(val)))
            except Exception as ex:
                logger.debug("Skipping unparseable observation: %s (%s)", obs, ex)

        # Sort valid observations chronologically
        valid_obs.sort(key=lambda x: x[0])

        # 2. Window Accumulations
        def sum_window(hours_back: int, min_count: int) -> Tuple[Optional[float], bool]:
            start_window = as_of_time - timedelta(hours=hours_back)
            matched = [val for t, val in valid_obs if start_window < t <= as_of_time]
            if len(matched) < min_count:
                return None, False
            return round(sum(matched), 2), True

        rain_1h, ok_1h = sum_window(1, min_count=1)
        rain_24h, ok_24h = sum_window(24, min_count=20)
        rain_72h, ok_72h = sum_window(72, min_count=60)
        rain_7d, ok_7d = sum_window(24 * 7, min_count=140)

        # 3. Forecast Accumulation
        forecast_24h_mm: Optional[float] = None
        forecast_run_id: Optional[str] = None
        ok_forecast = False

        if forecast:
            try:
                avail_fcst = cls.parse_iso_utc(forecast.get("available_at", forecast.get("issued_at")))
                if avail_fcst <= as_of_time:
                    raw_fcst = forecast.get("predicted_rain_24h_mm")
                    if raw_fcst is not None:
                        forecast_24h_mm = round(float(raw_fcst), 2)
                        forecast_run_id = forecast.get("provider_run_id")
                        ok_forecast = True
            except Exception as ex:
                logger.warning("Error evaluating forecast record: %s", ex)

        # 4. Static Terrain Properties
        slope_avg = round(float(terrain["slope_avg"]), 2) if terrain.get("slope_avg") is not None else None
        slope_max = round(float(terrain["slope_max"]), 2) if terrain.get("slope_max") is not None else None
        elevation_avg = round(float(terrain["elevation_avg"]), 2) if terrain.get("elevation_avg") is not None else None
        relief_m = round(float(terrain["relief_m"]), 2) if terrain.get("relief_m") is not None else None

        # 5. Quality Flagging (AC3)
        if ok_24h and ok_forecast and slope_avg is not None:
            coverage_quality = "good"
        elif ok_24h or ok_forecast:
            coverage_quality = "stale"
        else:
            coverage_quality = "missing"

        # 6. Feature vector payload
        features_vector = {
            "rain_1h_mm": rain_1h,
            "rain_24h_acc_mm": rain_24h,
            "rain_72h_acc_mm": rain_72h,
            "rain_7d_acc_mm": rain_7d,
            "forecast_next_24h_mm": forecast_24h_mm,
            "slope_avg": slope_avg,
            "slope_max": slope_max,
            "elevation_avg": elevation_avg,
            "relief_m": relief_m
        }

        source_refs = {
            "rainfall_observations_count": len(valid_obs),
            "rainfall_provider": observations[0].get("source_provider", "OPEN_METEO") if observations else None,
            "forecast_run_id": forecast_run_id,
            "dem_source": terrain.get("dem_source", "COPERNICUS_GLO_30"),
            "effective_resolution_m": terrain.get("effective_resolution_m", 1000.0)
        }

        return {
            "unit_id": unit_id,
            "unit_version": unit_version,
            "schema_version": schema_version,
            "as_of_time": as_of_time.isoformat(),
            "features": features_vector,
            "coverage_quality": coverage_quality,
            "source_references": source_refs
        }
