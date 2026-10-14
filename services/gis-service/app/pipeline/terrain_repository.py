import json
import logging
import os
from contextlib import contextmanager
from typing import Any, Dict, List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from app.pipeline.terrain_processor import TerrainMetrics

logger = logging.getLogger("TerrainRepository")


class TerrainRepository:
    """
    Database repository for spatial assessment units and terrain feature updates in PostGIS.
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

    def get_assessment_units(
        self,
        area_id: Optional[int] = None,
        unit_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves active assessment units with their centroid coordinates.
        """
        query = """
            SELECT 
                unit_id,
                unit_name,
                admin_province,
                admin_district,
                admin_commune,
                ST_Y(centroid) as centroid_lat,
                ST_X(centroid) as centroid_lon,
                slope_avg,
                slope_max,
                elevation_avg,
                relief_m,
                dem_source
            FROM gis_schema.spatial_assessment_units
            WHERE is_active = true
        """
        params: List[Any] = []
        if area_id is not None:
            query += " AND area_id = %s"
            params.append(area_id)
        if unit_ids:
            query += " AND unit_id = ANY(%s)"
            params.append(unit_ids)

        query += " ORDER BY unit_id ASC;"

        with self._get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, params)
                return [dict(row) for row in cur.fetchall()]

    def update_terrain_metrics(self, unit_id: str, metrics: TerrainMetrics) -> bool:
        """
        Updates terrain derivatives in gis_schema.spatial_assessment_units.
        """
        query = """
            UPDATE gis_schema.spatial_assessment_units
            SET 
                slope_avg = %s,
                slope_max = %s,
                elevation_avg = %s,
                relief_m = %s,
                dem_source = %s,
                dem_resolution_m = %s,
                effective_resolution_m = %s,
                updated_at = NOW()
            WHERE unit_id = %s;
        """
        params = (
            metrics.slope_avg,
            metrics.slope_max,
            metrics.elevation_avg,
            metrics.relief_m,
            metrics.dem_source,
            metrics.dem_resolution_m,
            metrics.effective_resolution_m,
            unit_id
        )

        with self._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                affected = cur.rowcount
            conn.commit()
            return affected > 0

    def get_terrain_summary(self, unit_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves detailed terrain feature summary for a given assessment unit.
        """
        query = """
            SELECT 
                unit_id,
                unit_name,
                admin_province,
                admin_district,
                admin_commune,
                slope_avg,
                slope_max,
                elevation_avg,
                relief_m,
                dem_source,
                dem_resolution_m,
                effective_resolution_m,
                ST_Y(centroid) as centroid_lat,
                ST_X(centroid) as centroid_lon,
                updated_at
            FROM gis_schema.spatial_assessment_units
            WHERE unit_id = %s;
        """
        with self._get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, (unit_id,))
                row = cur.fetchone()
                if not row:
                    return None
                data = dict(row)
                if data.get("updated_at"):
                    data["updated_at"] = data["updated_at"].isoformat()
                return data
