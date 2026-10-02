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
    slope_avg: Optional[float] = Field(32.5, description="Average terrain slope in degrees")
    ndvi_drop: Optional[float] = Field(-0.40, description="Vegetation index drop between temporal scenes")

class InferenceResponse(BaseModel):
    success: bool
    satellite_scene_id: str
    detection: Dict[str, Any]

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-service", "version": "1.0.0"}

@app.get("/api/v1/models/info")
def get_model_info():
    return {
        "model_architecture": "DeepLabV3+ / U-Net",
        "benchmark_dataset": "Landslide4Sense",
        "input_channels": ["B02", "B03", "B04", "B08", "B11", "B12", "NDVI", "SLOPE"],
        "target_f1_score": 0.768,
        "runtime": "ONNX Runtime with GPU/CPU fallback"
    }

@app.post("/api/v1/inference", response_model=InferenceResponse)
def run_inference(req: InferenceRequest):
    if len(req.bbox) != 4:
        raise HTTPException(status_code=400, detail="bbox must contain exactly 4 coordinates [min_lon, min_lat, max_lon, max_lat]")
    
    detection = predictor.predict_patch(
        bbox=req.bbox,
        slope_avg=req.slope_avg,
        ndvi_drop=req.ndvi_drop
    )
    return {
        "success": True,
        "satellite_scene_id": req.satellite_scene_id,
        "detection": detection
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
