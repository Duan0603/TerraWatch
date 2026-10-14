"""
PostGIS Database Repository for Spatial Units and Rainfall Time-Series
Story 2.1: AC4 - Idempotent PostGIS Persistence into gis_schema.
"""
import os
import logging
from contextlib import contextmanager
from typing import List, Dict, Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

logger = logging.getLogger(__name__)

class RainfallRepository:
    def __init__(self, db_url: Optional[str] = None):
        if not db_url:
            db_url = os.getenv("DATABASE_URL")
            if not db_url:
                host = os.getenv("POSTGRES_HOST", "localhost")
                port = os.getenv("POSTGRES_PORT", "5432")
                user = os.getenv("POSTGRES_USER", "postgres")
                pwd = os.getenv("POSTGRES_PASSWORD", "postgrespassword")
                db = os.getenv("POSTGRES_DB", "terrawatch")
                db_url = f"postgresql://{user}:{pwd}@{host}:{port}/{db}"
        self.db_url = db_url

    @contextmanager
    def get_connection(self):
        conn = psycopg2.connect(self.db_url)
        try:
            yield conn
        finally:
            conn.close()

    def get_assessment_units(
        self, 
        area_id: Optional[int] = None, 
        unit_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves monitored assessment units along with their WGS84 centroid coordinates.
        """
        query = """
            SELECT 
                unit_id, 
                unit_name, 
                admin_province, 
                admin_district, 
                ST_Y(centroid) AS latitude, 
                ST_X(centroid) AS longitude,
                slope_avg,
                elevation_avg
            FROM gis_schema.spatial_assessment_units
            WHERE is_active = TRUE
        """
        params = []
        if area_id is not None:
            query += " AND area_id = %s"
            params.append(area_id)
        if unit_id is not None:
            query += " AND unit_id = %s"
            params.append(unit_id)

        query += " ORDER BY unit_id ASC;"

        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, tuple(params))
                return [dict(row) for row in cur.fetchall()]

    def save_rainfall_observations(self, observations: List[Dict[str, Any]]) -> int:
        """
        Idempotent bulk upsert into gis_schema.rainfall_observations.
        """
        if not observations:
            return 0

        insert_sql = """
            INSERT INTO gis_schema.rainfall_observations (
                unit_id, interval_start, interval_end, available_at, 
                rainfall_mm, source_provider, source_revision, quality_flag
            ) VALUES %s
            ON CONFLICT (unit_id, interval_start, interval_end, source_provider, source_revision)
            DO UPDATE SET 
                rainfall_mm = EXCLUDED.rainfall_mm,
                quality_flag = EXCLUDED.quality_flag,
                ingested_at = CURRENT_TIMESTAMP;
        """

        tuples = [
            (
                obs["unit_id"],
                obs["interval_start"],
                obs["interval_end"],
                obs["available_at"],
                obs["rainfall_mm"],
                obs.get("source_provider", "OPEN_METEO"),
                obs.get("source_revision", "v1"),
                obs.get("quality_flag", "good")
            )
            for obs in observations
        ]

        with self.get_connection() as conn:
            with conn.cursor() as cur:
                execute_values(cur, insert_sql, tuples)
            conn.commit()

        return len(tuples)

    def save_rainfall_forecast(self, forecast: Dict[str, Any]) -> bool:
        """
        Idempotent upsert into gis_schema.rainfall_forecasts.
        """
        if not forecast:
            return False

        sql = """
            INSERT INTO gis_schema.rainfall_forecasts (
                unit_id, provider_run_id, provider_name, issued_at, 
                valid_from, valid_until, available_at, predicted_rain_24h_mm, quality_flag
            ) VALUES (
                %(unit_id)s, %(provider_run_id)s, %(provider_name)s, %(issued_at)s, 
                %(valid_from)s, %(valid_until)s, %(available_at)s, %(predicted_rain_24h_mm)s, %(quality_flag)s
            )
            ON CONFLICT (unit_id, provider_run_id, valid_from, valid_until)
            DO UPDATE SET 
                predicted_rain_24h_mm = EXCLUDED.predicted_rain_24h_mm,
                quality_flag = EXCLUDED.quality_flag,
                ingested_at = CURRENT_TIMESTAMP;
        """

        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, forecast)
            conn.commit()

        return True

    def get_latest_rainfall_summary(self, unit_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves the most recent rainfall accumulation and 24h weather forecast for a unit.
        """
        obs_query = """
            SELECT
                SUM(rainfall_mm) FILTER (WHERE interval_end >= NOW() - INTERVAL '1 hour')  AS rain_1h_mm,
                SUM(rainfall_mm) FILTER (WHERE interval_end >= NOW() - INTERVAL '24 hours') AS rain_24h_acc_mm,
                SUM(rainfall_mm) FILTER (WHERE interval_end >= NOW() - INTERVAL '72 hours') AS rain_72h_acc_mm,
                SUM(rainfall_mm) FILTER (WHERE interval_end >= NOW() - INTERVAL '7 days')   AS rain_7d_acc_mm,
                MAX(quality_flag) AS quality_flag,
                MAX(interval_end) AS latest_observation_time,
                COUNT(*) FILTER (WHERE interval_end >= NOW() - INTERVAL '24 hours') AS obs_count_24h
            FROM gis_schema.rainfall_observations
            WHERE unit_id = %s AND interval_end >= NOW() - INTERVAL '7 days'
              AND quality_flag != 'missing';
        """

        fcst_query = """
            SELECT 
                predicted_rain_24h_mm, 
                issued_at, 
                valid_from, 
                valid_until, 
                provider_run_id
            FROM gis_schema.rainfall_forecasts
            WHERE unit_id = %s
            ORDER BY issued_at DESC
            LIMIT 1;
        """

        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(obs_query, (unit_id,))
                obs_row = cur.fetchone()
                
                cur.execute(fcst_query, (unit_id,))
                fcst_row = cur.fetchone()

        if not obs_row or obs_row.get("obs_count_24h", 0) == 0:
            return None

        def _round_or_none(val):
            return round(float(val), 2) if val is not None else None

        return {
            "unit_id": unit_id,
            "rain_1h_mm": _round_or_none(obs_row["rain_1h_mm"]),
            "rain_24h_acc_mm": _round_or_none(obs_row["rain_24h_acc_mm"]),
            "rain_72h_acc_mm": _round_or_none(obs_row["rain_72h_acc_mm"]),
            "rain_7d_acc_mm": _round_or_none(obs_row["rain_7d_acc_mm"]),
            "forecast_next_24h_mm": round(float(fcst_row["predicted_rain_24h_mm"]), 2) if fcst_row else None,
            "forecast_valid_until": fcst_row["valid_until"].isoformat() if fcst_row else None,
            "quality_flag": obs_row.get("quality_flag", "good"),
            "latest_observation_time": obs_row["latest_observation_time"].isoformat() if obs_row.get("latest_observation_time") else None
        }
