from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
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
