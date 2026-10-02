import os
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.pipeline.processor import GISProcessor

app = FastAPI(
    title="GeoSentry GIS Data Service",
    description="GIS Processing Pipeline: GEE/Sentinel Ingestion, Preprocessing (NDVI/Slope), Tiling & PostGIS MVT",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

processor = GISProcessor()

class TilingRequest(BaseModel):
    area_id: int = Field(..., example=1)
    bbox: List[float] = Field(..., example=[104.05, 21.80, 104.20, 21.90], description="[min_lon, min_lat, max_lon, max_lat]")
    patch_size_km: float = Field(2.0, example=2.0)

class SatelliteQueryRequest(BaseModel):
    bbox: List[float] = Field(..., example=[104.05, 21.80, 104.20, 21.90])
    max_cloud_coverage: float = Field(20.0, description="Max allowed cloud percentage")
    date_from: str = Field(..., example="2026-09-01")
    date_to: str = Field(..., example="2026-10-01")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "gis-service", "version": "1.0.0"}

@app.post("/api/v1/gis/query-satellite")
def query_satellite(req: SatelliteQueryRequest):
    """
    Query available Sentinel-2 and Landsat-8 scenes over AOI
    """
    return {
        "success": True,
        "query_bbox": req.bbox,
        "scenes_found": [
            {
                "scene_id": "S2A_MSIL2A_20261001T033531_N0500_R104",
                "satellite": "Sentinel-2A",
                "acquisition_date": "2026-10-01T03:35:31Z",
                "cloud_percentage": 4.2,
                "resolution_meters": 10
            },
            {
                "scene_id": "LC08_L2SP_127045_20260925_02_T1",
                "satellite": "Landsat-8",
                "acquisition_date": "2026-09-25T03:40:12Z",
                "cloud_percentage": 11.5,
                "resolution_meters": 30
            }
        ]
    }

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
    """
    Serve Mapbox Vector Tile (MVT) PBF format
    In production, this executes:
    SELECT ST_AsMVT(tile) FROM (...)
    """
    # Return placeholder 204 or empty pbf
    return Response(content=b"", media_type="application/vnd.mapbox-vector-tile")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=True)
