import os
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.pipeline.processor import GISProcessor
from app.pipeline.rainfall_client import OpenMeteoRainfallClient, RainfallClientError
from app.pipeline.rainfall_processor import RainfallProcessor
from app.pipeline.rainfall_repository import RainfallRepository
from app.pipeline.terrain_processor import TerrainProcessor, TerrainMetrics
from app.pipeline.terrain_client import OpenMeteoElevationClient
from app.pipeline.terrain_repository import TerrainRepository
from app.pipeline.snapshot_processor import SnapshotProcessor
from app.pipeline.snapshot_repository import SnapshotRepository

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gis-service")

app = FastAPI(
    title="GeoSentry / TerraWatch GIS Data Service",
    description="GIS & Rainfall Ingestion Pipeline: DEM Terrain, Open-Meteo Ingestion, and Spatial Assessment Units",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

processor = GISProcessor()
rainfall_client = OpenMeteoRainfallClient()
rainfall_repo = RainfallRepository()
terrain_processor = TerrainProcessor()
terrain_client = OpenMeteoElevationClient()
terrain_repo = TerrainRepository()
snapshot_processor = SnapshotProcessor()
snapshot_repo = SnapshotRepository()

# --- Request / Response Models ---
class IngestRainfallRequest(BaseModel):
    area_id: Optional[int] = Field(None, example=1, description="Lọc theo mã khu vực giám sát (nếu có)")
    unit_id: Optional[str] = Field(None, example="VN_LC_BATXAT_0001", description="Lọc theo mã ô lưới cụ thể")
    past_days: int = Field(7, ge=1, le=14, description="Số ngày quan trắc lịch sử cần kéo")
    forecast_days: int = Field(2, ge=1, le=3, description="Số ngày dự báo thời tiết cần kéo")

class TerrainExtractRequest(BaseModel):
    area_id: Optional[int] = Field(None, example=1, description="Lọc theo mã khu vực giám sát (nếu có)")
    unit_ids: Optional[List[str]] = Field(None, example=["VN_LC_BATXAT_0001"], description="Danh sách các ô cần trích xuất")
    grid_size: int = Field(5, ge=3, le=11, description="Kích thước lưới lấy mẫu (mặc định 5x5)")
    step_deg: float = Field(0.0003, description="Bước lưới độ vĩ/kinh (khoảng ~30m)")
    dem_source: str = Field("COPERNICUS_GLO_30", description="Nguồn DEM")

class CreateSnapshotRequest(BaseModel):
    unit_ids: Optional[List[str]] = Field(None, example=["VN_LC_BATXAT_0001"], description="Danh sách unit_id cần tạo snapshot")
    area_id: Optional[int] = Field(None, example=1, description="Lọc theo area_id")
    as_of_time: Optional[str] = Field(None, example="2026-10-14T12:00:00Z", description="Thời điểm dự báo t (mặc định: đầu giờ hiện tại UTC)")
    schema_version: str = Field("rainfall-terrain-24h.v1", description="Phiên bản cấu trúc vector đặc trưng")

class TilingRequest(BaseModel):
    area_id: int = Field(..., example=1)
    bbox: List[float] = Field(..., example=[104.05, 21.80, 104.20, 21.90], description="[min_lon, min_lat, max_lon, max_lat]")
    patch_size_km: float = Field(2.0, example=2.0)

# --- Endpoints ---

@app.get("/health")
def health_check():
    return {
        "status": "ok", 
        "service": "gis-service", 
        "version": "2.0.0",
        "supported_providers": ["OPEN_METEO", "SRTM_30M"]
    }

# --- Story 2.1: Rainfall Ingestion & Observations Endpoints ---

@app.post("/api/v1/gis/rainfall/ingest")
def trigger_rainfall_ingestion(req: IngestRainfallRequest):
    """
    Kích hoạt pipeline thu thập lượng mưa lịch sử và dự báo thời tiết 24h
    từ Open-Meteo cho các ô lưới không gian (Spatial Assessment Units).
    """
    try:
        units = rainfall_repo.get_assessment_units(area_id=req.area_id, unit_id=req.unit_id)
    except Exception as e:
        logger.error(f"Database error while querying assessment units: {e}")
        raise HTTPException(status_code=500, detail=f"Database connection error: {str(e)}")

    if not units:
        raise HTTPException(status_code=404, detail="No active assessment units found for the specified filter.")

    total_obs_saved = 0
    total_fcst_saved = 0
    unit_results = []

    for unit in units:
        u_id = unit["unit_id"]
        lat = unit.get("latitude")
        lon = unit.get("longitude")

        if lat is None or lon is None:
            logger.warning(f"Unit {u_id} has no centroid coordinates, skipping.")
            continue

        try:
            # 1. Fetch raw data from Open-Meteo
            raw_data = rainfall_client.fetch_rainfall_series(
                latitude=lat, 
                longitude=lon, 
                past_days=req.past_days, 
                forecast_days=req.forecast_days
            )

            # 2. Process accumulations & quality flags
            processed = RainfallProcessor.process_series(unit_id=u_id, open_meteo_data=raw_data)

            # 3. Persist observations (Idempotent)
            obs_count = rainfall_repo.save_rainfall_observations(processed["observations"])
            total_obs_saved += obs_count

            # 4. Persist forecast (Idempotent)
            if processed.get("forecast"):
                rainfall_repo.save_rainfall_forecast(processed["forecast"])
                total_fcst_saved += 1

            unit_results.append({
                "unit_id": u_id,
                "unit_name": unit.get("unit_name"),
                "status": "success",
                "observations_stored": obs_count,
                "summary": processed.get("summary")
            })
        except RainfallClientError as e:
            logger.error(f"Rainfall API error for unit {u_id}: {e}")
            unit_results.append({"unit_id": u_id, "status": "failed", "error": str(e)})
        except Exception as e:
            logger.error(f"Unexpected error processing unit {u_id}: {e}")
            unit_results.append({"unit_id": u_id, "status": "failed", "error": str(e)})

    return {
        "success": True,
        "total_units_evaluated": len(units),
        "total_observations_saved": total_obs_saved,
        "total_forecasts_saved": total_fcst_saved,
        "results": unit_results
    }

@app.get("/api/v1/gis/rainfall/summary/{unit_id}")
def get_rainfall_summary(unit_id: str):
    """
    Truy vấn tóm tắt lượng mưa mới nhất (mưa 1h, 24h, 72h, 7d và dự báo 24h tới)
    của một ô lưới phục vụ Feature Snapshot và WebGIS Dashboard.
    """
    try:
        summary = rainfall_repo.get_latest_rainfall_summary(unit_id)
        if not summary:
            # Nếu chưa có trong DB, thử lấy trực tiếp từ bảng assessment_units rồi tự động ingest
            units = rainfall_repo.get_assessment_units(unit_id=unit_id)
            if not units:
                raise HTTPException(status_code=404, detail=f"Assessment unit '{unit_id}' not found.")
            
            unit = units[0]
            lat = unit.get("latitude")
            lon = unit.get("longitude")
            if lat is None or lon is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Assessment unit '{unit_id}' has missing centroid coordinates."
                )

            raw_data = rainfall_client.fetch_rainfall_series(lat, lon)
            processed = RainfallProcessor.process_series(unit_id=unit_id, open_meteo_data=raw_data)
            
            rainfall_repo.save_rainfall_observations(processed["observations"])
            if processed.get("forecast"):
                rainfall_repo.save_rainfall_forecast(processed["forecast"])
            
            summary = processed.get("summary")

        return {"success": True, "data": summary}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching rainfall summary for {unit_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/gis/rainfall/live-sample")
def get_live_rainfall_sample(
    lat: float = Query(22.525, description="Vĩ độ (Mặc định: Bát Xát, Lào Cai)"),
    lon: float = Query(103.855, description="Kinh độ (Mặc định: Bát Xát, Lào Cai)")
):
    """
    Endpoint chẩn đoán: Gọi trực tiếp Open-Meteo và tính toán mẫu cho một tọa độ GPS bất kỳ.
    """
    try:
        raw_data = rainfall_client.fetch_rainfall_series(latitude=lat, longitude=lon, past_days=2, forecast_days=2)
        processed = RainfallProcessor.process_series(unit_id="SAMPLE_PROBE", open_meteo_data=raw_data)
        return {
            "success": True,
            "coordinates": {"lat": lat, "lon": lon},
            "summary": processed["summary"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Terrain Endpoints (Story 2.2) ---

@app.post("/api/v1/gis/terrain/extract")
def extract_terrain(req: TerrainExtractRequest):
    """
    Trích xuất và tính toán các chỉ số địa hình (độ cao, độ dốc, độ chênh cao) từ DEM
    cho các ô spatial_assessment_units và cập nhật vào PostGIS.
    """
    try:
        units = terrain_repo.get_assessment_units(area_id=req.area_id, unit_ids=req.unit_ids)
        if not units:
            raise HTTPException(status_code=404, detail="No active assessment units found matching criteria.")

        results = []
        for u in units:
            unit_id = u["unit_id"]
            lat = u["centroid_lat"]
            lon = u["centroid_lon"]

            if lat is None or lon is None:
                logger.warning("Assessment unit %s has no centroid coordinates. Skipping.", unit_id)
                continue

            # Fetch elevation grid around centroid
            elev_grid, actual_step, detected_source = terrain_client.fetch_grid_around_point(
                center_lat=lat,
                center_lon=lon,
                grid_size=req.grid_size,
                step_deg=req.step_deg
            )

            # Preserve provenance: use requested dem_source if live fetch succeeded, else record fallback
            source_label = req.dem_source if detected_source == "COPERNICUS_GLO_30" else detected_source

            # Compute terrain metrics
            metrics = terrain_processor.compute_metrics_from_grid(
                elevation_grid=elev_grid,
                center_lat=lat,
                step_deg=actual_step,
                dem_source=source_label
            )

            # Persist to PostGIS
            success = terrain_repo.update_terrain_metrics(unit_id, metrics)
            results.append({
                "unit_id": unit_id,
                "unit_name": u.get("unit_name"),
                "success": success,
                "elevation_avg": metrics.elevation_avg,
                "slope_avg": metrics.slope_avg,
                "slope_max": metrics.slope_max,
                "relief_m": metrics.relief_m,
                "dem_source": metrics.dem_source
            })

        return {
            "success": True,
            "message": f"Successfully extracted terrain features for {len(results)} assessment units.",
            "total_processed": len(results),
            "units": results
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Terrain extraction failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/gis/terrain/{unit_id}")
def get_terrain_summary(unit_id: str):
    """
    Truy vấn thông số đặc trưng địa hình của một ô đánh giá nguy cơ (slope, elevation, relief).
    """
    try:
        summary = terrain_repo.get_terrain_summary(unit_id)
        if not summary:
            raise HTTPException(status_code=404, detail=f"Assessment unit '{unit_id}' not found.")

        return {
            "success": True,
            "data": summary
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error retrieving terrain summary for %s: %s", unit_id, e)
        raise HTTPException(status_code=500, detail=str(e))

# --- Feature Snapshot Endpoints (Story 2.3) ---

@app.post("/api/v1/gis/snapshots/create")
def create_feature_snapshots(req: CreateSnapshotRequest):
    """
    Tạo bản chụp đặc trưng (Feature Snapshot) bất biến cho các ô đánh giá nguy cơ.
    Hợp nhất chuỗi mưa quan trắc, dự báo thời tiết 24h và đặc trưng độ dốc/độ cao DEM
    tại thời điểm dự báo t (as_of_time).
    """
    try:
        units = terrain_repo.get_assessment_units(area_id=req.area_id, unit_ids=req.unit_ids)
        if not units:
            raise HTTPException(status_code=404, detail="No active assessment units found.")

        as_of_dt = SnapshotProcessor.parse_iso_utc(req.as_of_time) if req.as_of_time else None

        created_snapshots = []
        for u in units:
            unit_id = u["unit_id"]

            terrain = snapshot_repo.get_unit_terrain(unit_id) or {}

            ref_time = as_of_dt or SnapshotProcessor.parse_iso_utc(
                datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
            )
            observations = snapshot_repo.get_observations_as_of(unit_id, as_of_time=ref_time, days_back=7)
            forecast = snapshot_repo.get_latest_forecast_as_of(unit_id, as_of_time=ref_time)

            snapshot_dict = SnapshotProcessor.build_snapshot(
                unit_id=unit_id,
                as_of_time=ref_time,
                schema_version=req.schema_version,
                observations=observations,
                forecast=forecast,
                terrain=terrain
            )

            snapshot_id = snapshot_repo.save_snapshot(snapshot_dict)
            created_snapshots.append({
                "snapshot_id": snapshot_id,
                "unit_id": unit_id,
                "as_of_time": snapshot_dict["as_of_time"],
                "coverage_quality": snapshot_dict["coverage_quality"],
                "features": snapshot_dict["features"]
            })

        return {
            "success": True,
            "message": f"Successfully created {len(created_snapshots)} feature snapshots.",
            "total_created": len(created_snapshots),
            "snapshots": created_snapshots
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating feature snapshots: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/gis/snapshots/latest/{unit_id}")
def get_latest_feature_snapshot(unit_id: str):
    """
    Truy vấn snapshot mới nhất của một ô đánh giá nguy cơ để AI Service hoặc Core API sử dụng.
    """
    try:
        snapshot = snapshot_repo.get_latest_snapshot(unit_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail=f"No feature snapshot found for unit '{unit_id}'.")

        return {
            "success": True,
            "data": snapshot
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error retrieving latest snapshot for %s: %s", unit_id, e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/gis/snapshots/{snapshot_id}")
def get_feature_snapshot_by_id(snapshot_id: str):
    """
    Truy vấn bản ghi feature snapshot theo UUID định danh duy nhất.
    """
    try:
        snapshot = snapshot_repo.get_snapshot_by_id(snapshot_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail=f"Feature snapshot '{snapshot_id}' not found.")

        return {
            "success": True,
            "data": snapshot
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error retrieving snapshot %s: %s", snapshot_id, e)
        raise HTTPException(status_code=500, detail=str(e))

# --- Legacy & Tiling Endpoints (Retained for Compatibility) ---

@app.post("/api/v1/gis/tiling")
def generate_tiling(req: TilingRequest):
    """
    Slice AOI into small patches for deep learning batch inference
    """
    if len(req.bbox) != 4:
        raise HTTPException(status_code=400, detail="bbox must have 4 coordinates")
    
    tiles = processor.generate_tiles(req.bbox, req.patch_size_km)
    return {
        "success": True,
        "area_id": req.area_id,
        "total_tiles": len(tiles),
        "tiles": tiles
    }

@app.get("/api/v1/gis/mvt/{z}/{x}/{y}.pbf")
def get_vector_tile(z: int, x: int, y: int):
    """Serve Mapbox Vector Tile (MVT) PBF format"""
    return Response(content=b"", media_type="application/vnd.mapbox-vector-tile")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=True)
