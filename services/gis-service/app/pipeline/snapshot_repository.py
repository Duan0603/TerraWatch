import json
import logging
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor, Json

logger = logging.getLogger("SnapshotRepository")


class SnapshotRepository:
    """
    PostGIS repository for managing immutable feature snapshots in gis_schema.feature_snapshots.
    """

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
    def _get_connection(self):
        conn = psycopg2.connect(self.db_url)
        try:
            yield conn
        finally:
            conn.close()

    def get_unit_terrain(self, unit_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves static terrain derivatives for a unit."""
        query = """
            SELECT 
                unit_id,
                slope_avg,
                slope_max,
                elevation_avg,
                relief_m,
                dem_source,
                effective_resolution_m
            FROM gis_schema.spatial_assessment_units
            WHERE unit_id = %s;
        """
        with self._get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, (unit_id,))
                row = cur.fetchone()
                return dict(row) if row else None

    def get_observations_as_of(self, unit_id: str, as_of_time: datetime, days_back: int = 7) -> List[Dict[str, Any]]:
        """Retrieves historical observations available at or before as_of_time."""
        query = """
            SELECT
                unit_id,
                interval_start,
                interval_end,
                available_at,
                rainfall_mm,
                source_provider,
                source_revision,
                quality_flag
            FROM gis_schema.rainfall_observations
            WHERE unit_id = %s
              AND available_at <= %s
              AND interval_end >= %s - (%s * INTERVAL '1 day')
            ORDER BY interval_end ASC;
        """
        with self._get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, (unit_id, as_of_time, as_of_time, days_back))
                rows = cur.fetchall()
                results = []
                for r in rows:
                    item = dict(r)
                    if item.get("interval_start"):
                        item["interval_start"] = item["interval_start"].isoformat()
                    if item.get("interval_end"):
                        item["interval_end"] = item["interval_end"].isoformat()
                    if item.get("available_at"):
                        item["available_at"] = item["available_at"].isoformat()
                    results.append(item)
                return results

    def get_latest_forecast_as_of(self, unit_id: str, as_of_time: datetime) -> Optional[Dict[str, Any]]:
        """Retrieves the latest weather forecast issued and available by as_of_time."""
        query = """
            SELECT 
                unit_id,
                provider_run_id,
                provider_name,
                issued_at,
                valid_from,
                valid_until,
                available_at,
                predicted_rain_24h_mm,
                quality_flag
            FROM gis_schema.rainfall_forecasts
            WHERE unit_id = %s
              AND available_at <= %s
            ORDER BY issued_at DESC
            LIMIT 1;
        """
        with self._get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, (unit_id, as_of_time))
                row = cur.fetchone()
                if not row:
                    return None
                item = dict(row)
                for k in ["issued_at", "valid_from", "valid_until", "available_at"]:
                    if item.get(k):
                        item[k] = item[k].isoformat()
                return item

    def save_snapshot(self, snapshot_dict: Dict[str, Any]) -> str:
        """
        Idempotent persistence of immutable feature snapshot.
        Returns snapshot_id UUID string.
        """
        insert_sql = """
            INSERT INTO gis_schema.feature_snapshots (
                schema_version,
                unit_id,
                unit_version,
                as_of_time,
                features,
                coverage_quality,
                source_references
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (unit_id, unit_version, as_of_time, schema_version)
            DO UPDATE SET
                features = EXCLUDED.features,
                coverage_quality = EXCLUDED.coverage_quality,
                source_references = EXCLUDED.source_references
            RETURNING snapshot_id;
        """
        params = (
            snapshot_dict.get("schema_version", "rainfall-terrain-24h.v1"),
            snapshot_dict["unit_id"],
            snapshot_dict.get("unit_version", "v1"),
            snapshot_dict["as_of_time"],
            Json(snapshot_dict["features"]),
            snapshot_dict.get("coverage_quality", "good"),
            Json(snapshot_dict.get("source_references", {}))
        )

        with self._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(insert_sql, params)
                snapshot_id = str(cur.fetchone()[0])
            conn.commit()
            return snapshot_id

    def get_latest_snapshot(self, unit_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves the latest snapshot for a unit."""
        query = """
            SELECT 
                snapshot_id,
                schema_version,
                unit_id,
                unit_version,
                as_of_time,
                features,
                coverage_quality,
                source_references,
                created_at
            FROM gis_schema.feature_snapshots
            WHERE unit_id = %s
            ORDER BY as_of_time DESC
            LIMIT 1;
        """
        with self._get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, (unit_id,))
                row = cur.fetchone()
                if not row:
                    return None
                data = dict(row)
                data["snapshot_id"] = str(data["snapshot_id"])
                data["as_of_time"] = data["as_of_time"].isoformat()
                data["created_at"] = data["created_at"].isoformat()
                return data

    def get_snapshot_by_id(self, snapshot_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a snapshot by its UUID."""
        query = """
            SELECT 
                snapshot_id,
                schema_version,
                unit_id,
                unit_version,
                as_of_time,
                features,
                coverage_quality,
                source_references,
                created_at
            FROM gis_schema.feature_snapshots
            WHERE snapshot_id = %s;
        """
        with self._get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, (snapshot_id,))
                row = cur.fetchone()
                if not row:
                    return None
                data = dict(row)
                data["snapshot_id"] = str(data["snapshot_id"])
                data["as_of_time"] = data["as_of_time"].isoformat()
                data["created_at"] = data["created_at"].isoformat()
                return data
