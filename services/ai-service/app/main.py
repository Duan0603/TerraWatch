from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from typing import Literal
from datetime import datetime, timedelta
from functools import lru_cache
from app.services.live_gru import LiveGRU
from app.services.inference import LandslidePredictor
from app.services.event_listener import start_redis_listener

app = FastAPI(
    title="GeoSentry AI Inference Service",
    description="Deep Learning Landslide Detection Service (U-Net / DeepLabV3+ ONNX)",
    version="1.0.0"
)

@app.on_event("startup")
def startup_event():
    start_redis_listener()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

predictor = LandslidePredictor()


@lru_cache(maxsize=1)
def live_gru_model():
    return LiveGRU()


class LiveStaticFeatures(BaseModel):
    slope_deg: float = Field(..., ge=0, le=90, allow_inf_nan=False)
    clay_pct: float = Field(..., ge=0, le=100, allow_inf_nan=False)
    sand_pct: float = Field(..., ge=0, le=100, allow_inf_nan=False)
    bulk_density_g_cm3: float = Field(..., gt=0, le=3, allow_inf_nan=False)


class LiveGRURequest(BaseModel):
    unit_id: str = Field(..., min_length=1, max_length=100)
    history: List[float] = Field(..., min_length=168, max_length=168)
    forecast_24h_mm: float = Field(..., ge=0, allow_inf_nan=False)
    static: LiveStaticFeatures
    issue_time: datetime
    weather_source: Literal['OPEN_METEO']


@app.get('/api/v1/models/gru/info')
def gru_model_info():
    try:
        model = live_gru_model()
        return {'ready': True, 'model_id': model.card['model_id'],
                'checkpoint_sha256': model.card['source_checkpoint_sha256'],
                'experimental_only': True}
    except (OSError, ValueError, KeyError):
        return {'ready': False, 'reason': 'GRU_ARTIFACT_UNAVAILABLE_OR_INVALID'}


@app.post('/api/v1/inference/gru/live')
def run_live_gru(req: LiveGRURequest):
    if req.issue_time.tzinfo is None:
        raise HTTPException(status_code=422, detail='issue_time requires a timezone')
    try:
        result = live_gru_model().predict(req.history, req.forecast_24h_mm, req.static.model_dump())
    except (OSError, KeyError):
        raise HTTPException(status_code=503, detail='GRU artifact unavailable')
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {**result, 'unit_id': req.unit_id, 'issue_time': req.issue_time.isoformat(),
            'valid_until': (req.issue_time+timedelta(hours=24)).isoformat(),
            'weather_source': req.weather_source, 'experimental_source_shift': True,
            'experimental_rolling_clock': True,
            'notice': 'Dự báo thử nghiệm bằng Open-Meteo; khác nguồn và mốc giờ dữ liệu train IMERG + GFS.'}

class InferenceRequest(BaseModel):
    satellite_scene_id: str = Field(..., example="S2A_MSIL2A_20261001T033531")
    bbox: List[float] = Field(..., example=[104.08, 21.84, 104.09, 21.85], description="[min_lon, min_lat, max_lon, max_lat]")
    # Deprecated: kept so existing callers keep working; ignored (a bbox carries no imagery).
    slope_avg: Optional[float] = Field(None, description="Ignored")
    ndvi_drop: Optional[float] = Field(None, description="Ignored")

class InferenceResponse(BaseModel):
    success: bool
    satellite_scene_id: str
    detection: Dict[str, Any]

class SceneRequest(BaseModel):
    ref_tif: str = Field(..., example="VN013_BacHa_post_8band_v2.tif", description="8-band reference image; file name inside SCENE_DIR")
    post_tif: str = Field(..., example="VN013_post_v4.tif", description="Post-event composite; file name inside SCENE_DIR")
    pre_tif: str = Field(..., example="VN013_pre_v4.tif", description="Pre-event composite of the SAME season; file name inside SCENE_DIR")
    mode: str = Field("balanced", description="sensitive | balanced | conservative")
    image_source: str = ""
    image_period: str = ""

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-service", "version": "1.0.0", "model_ready": predictor.is_ready()}

@app.get("/api/v1/models/info")
def get_model_info():
    return predictor.model_info()

@app.post("/api/v1/inference", response_model=InferenceResponse)
def run_inference(req: InferenceRequest):
    if len(req.bbox) != 4:
        raise HTTPException(status_code=400, detail="bbox must contain exactly 4 coordinates [min_lon, min_lat, max_lon, max_lat]")
    return {
        "success": True,
        "satellite_scene_id": req.satellite_scene_id,
        "detection": predictor.predict_patch(bbox=req.bbox)
    }

@app.post("/api/v1/inference/scene")
def run_scene_inference(req: SceneRequest):
    """Landslide candidates (GeoJSON, schema 2.0) for one scene. Candidates need human verification."""
    try:
        return predictor.predict_scene(req.ref_tif, req.post_tif, req.pre_tif, req.mode,
                                       meta={"image_source": req.image_source, "image_period": req.image_period})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=f"scene file not found: {e}")
    except AssertionError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
