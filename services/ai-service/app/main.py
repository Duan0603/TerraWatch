from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from typing import Literal
from datetime import datetime, timedelta
from functools import lru_cache
import os
import json
import numpy as np
import psycopg2
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

# ─── Rainfall Simulation ───────────────────────────────────────────────────

TERRAIN_PRESETS = {
    "batxat":      {"slope_deg": 28.4, "clay_pct": 32.0, "sand_pct": 30.5, "bulk_density_g_cm3": 1.11, "name": "Bát Xát, Lào Cai"},
    "sapa":        {"slope_deg": 22.0, "clay_pct": 29.0, "sand_pct": 33.0, "bulk_density_g_cm3": 1.14, "name": "Sa Pa, Lào Cai"},
    "thuongxuan":  {"slope_deg": 20.5, "clay_pct": 27.0, "sand_pct": 38.0, "bulk_density_g_cm3": 1.18, "name": "Thường Xuân, Thanh Hóa"},
    "thoai":       {"slope_deg":  7.0, "clay_pct": 22.0, "sand_pct": 48.0, "bulk_density_g_cm3": 1.28, "name": "Địa hình thoải (tham chiếu)"},
}

SCENARIO_DAILY_MM = {
    "dry":      [0.5, 0.0, 1.0, 0.5, 0.0, 1.5, 0.5],
    "moderate": [5.0, 10.0, 25.0, 30.0, 20.0, 15.0, 8.0],
    "heavy":    [15.0, 30.0, 55.0, 80.0, 90.0, 110.0, 70.0],
    "extreme":  [35.0, 60.0, 90.0, 130.0, 160.0, 200.0, 185.0],
}
SCENARIO_FORECAST = {"dry": 2.0, "moderate": 18.0, "heavy": 55.0, "extreme": 95.0}


def _daily_to_hourly(daily_totals: list, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    hourly = np.zeros(168, dtype=np.float64)
    for day, total in enumerate(daily_totals):
        if total <= 0:
            continue
        # Realistic afternoon-peak gamma distribution
        weights = np.zeros(24)
        weights[6:14]  = rng.gamma(2.0, 1.0, 8)   # morning build
        weights[14:20] = rng.gamma(2.5, 1.5, 6)   # afternoon peak
        weights[20:24] = rng.gamma(1.2, 0.8, 4)   # evening tapering
        weights[:6]    = rng.gamma(0.8, 0.5, 6)   # pre-dawn drizzle
        weights = np.maximum(weights, 0)
        if weights.sum() > 0:
            hourly[day * 24:(day + 1) * 24] = weights / weights.sum() * total
    return hourly


def _alert_level(hazard: float) -> str:
    # Thresholds calibrated to the GRU model's actual output range.
    # hazard = temporal × spatial; spatial caps at ~0.52 for the steepest preset
    # (Bát Xát 28°), so max achievable hazard ≈ 0.52.
    # Ranges: dry → 0.0, moderate → ≤0.05, heavy → 0.35–0.48, extreme → 0.49–0.53
    if hazard < 0.08: return "SAFE"
    if hazard < 0.22: return "LOW"
    if hazard < 0.38: return "MEDIUM"
    if hazard < 0.50: return "HIGH"
    return "EXTREME"


class SimulateRequest(BaseModel):
    scenario: Literal["dry", "moderate", "heavy", "extreme"] = "heavy"
    terrain: Literal["batxat", "sapa", "thuongxuan", "thoai"] = "batxat"
    seed: Optional[int] = None


@app.post("/api/v1/simulate/rainfall")
def simulate_rainfall(req: SimulateRequest):
    seed = req.seed if req.seed is not None else int(datetime.utcnow().timestamp()) % 100000
    daily = [d * (0.9 + np.random.default_rng(seed + i).uniform(0, 0.2))
             for i, d in enumerate(SCENARIO_DAILY_MM[req.scenario])]
    hourly = _daily_to_hourly(daily, seed).tolist()
    forecast = SCENARIO_FORECAST[req.scenario]
    terrain = TERRAIN_PRESETS[req.terrain]
    static = {k: terrain[k] for k in ("slope_deg", "clay_pct", "sand_pct", "bulk_density_g_cm3")}
    try:
        result = live_gru_model().predict(hourly, forecast, static)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"GRU model error: {exc}")
    h = np.array(hourly)
    return {
        "scenario": req.scenario,
        "terrain_key": req.terrain,
        "terrain_name": terrain["name"],
        "terrain": static,
        "daily_totals_mm": [round(d, 1) for d in daily],
        "hourly_history_mm": [round(v, 3) for v in hourly],
        "forecast_24h_mm": round(forecast, 1),
        "rain_24h_mm": round(float(h[-24:].sum()), 1),
        "rain_72h_mm": round(float(h[-72:].sum()), 1),
        "rain_7d_mm": round(float(h.sum()), 1),
        "temporal_score": round(result["temporal_score"], 4),
        "spatial_score": round(result["spatial_score"], 4),
        "hazard_score": round(result["hazard_score"], 4),
        "alert_level": _alert_level(result["hazard_score"]),
        "experimental_flag": result["hazard_score"] >= 0.50,
        "model_id": result["model_id"],
        "seed": seed,
    }


# ─── Rainfall Injection (ghi forecast_run thật vào DB) ────────────────────────

class InjectRequest(BaseModel):
    unit_id: Optional[str] = None      # spatial_assessment_units.unit_id; nếu null thì tìm gần nhất
    lat: Optional[float] = None
    lng: Optional[float] = None
    scenario: Literal["dry", "moderate", "heavy", "extreme"] = "heavy"
    slope_deg: float = Field(..., ge=0, le=90)
    clay_pct: float = Field(..., ge=0, le=100)
    sand_pct: float = Field(..., ge=0, le=100)
    bulk_density_g_cm3: float = Field(..., gt=0, le=3)
    seed: Optional[int] = None


RISK_LEVEL_MAP = {"SAFE": "low", "LOW": "low", "MEDIUM": "medium", "HIGH": "high", "EXTREME": "extreme"}


def _get_pg_conn():
    return psycopg2.connect(
        host=os.environ.get("POSTGRES_HOST", "postgres"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        dbname=os.environ.get("POSTGRES_DB", "terrawatch"),
        user=os.environ.get("POSTGRES_USER", "postgres"),
        password=os.environ.get("POSTGRES_PASSWORD", "postgrespassword"),
    )


@app.post("/api/v1/simulate/inject")
def simulate_inject(req: InjectRequest):
    if not req.unit_id and (req.lat is None or req.lng is None):
        raise HTTPException(status_code=422, detail="Cần unit_id hoặc lat+lng")

    seed = req.seed if req.seed is not None else int(datetime.utcnow().timestamp()) % 100000
    daily = [d * (0.9 + np.random.default_rng(seed + i).uniform(0, 0.2))
             for i, d in enumerate(SCENARIO_DAILY_MM[req.scenario])]
    hourly = _daily_to_hourly(daily, seed).tolist()
    forecast = SCENARIO_FORECAST[req.scenario]
    static = {
        "slope_deg": req.slope_deg, "clay_pct": req.clay_pct,
        "sand_pct": req.sand_pct, "bulk_density_g_cm3": req.bulk_density_g_cm3,
    }
    try:
        result = live_gru_model().predict(hourly, forecast, static)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"GRU model error: {exc}")

    h = np.array(hourly)
    hazard = result["hazard_score"]
    alert_level = _alert_level(hazard)
    db_risk_level = RISK_LEVEL_MAP[alert_level]

    run_id = None
    db_error = None
    resolved_unit_id = req.unit_id
    unit_polygon = None
    unit_name = None
    try:
        conn = _get_pg_conn()
        with conn.cursor() as cur:
            if not resolved_unit_id:
                cur.execute(
                    "SELECT unit_id FROM gis_schema.spatial_assessment_units "
                    "ORDER BY ST_Distance(centroid, ST_SetSRID(ST_MakePoint(%s, %s), 4326)) LIMIT 1",
                    (req.lng, req.lat)
                )
                row = cur.fetchone()
                resolved_unit_id = row[0] if row else None

            if resolved_unit_id:
                cur.execute(
                    "SELECT unit_name, ST_AsGeoJSON(geom)::json as geom FROM gis_schema.spatial_assessment_units WHERE unit_id = %s",
                    (resolved_unit_id,)
                )
                unit_row = cur.fetchone()
                if unit_row:
                    unit_name = unit_row[0]
                    geom_json = unit_row[1]
                    if geom_json and geom_json.get("type") == "Polygon":
                        unit_polygon = geom_json["coordinates"][0]  # exterior ring [[lng,lat],...]

            if resolved_unit_id:
                cur.execute("""
                    INSERT INTO core_schema.forecast_runs
                    (unit_id, unit_version, issued_at, valid_from, valid_until, horizon_hours,
                     availability, probability, experimental_score, hazard_level,
                     model_version, threshold_version, review_status, job_status, is_active,
                     contributing_factors, input_quality)
                    VALUES (%s, 'v1', NOW(), NOW(), NOW() + INTERVAL '24 hours', 24,
                            'available', %s, %s, %s::core_schema.risk_level,
                            'sim-terrawatch-gru-v1', 'sim-v1', 'pending', 'completed', true,
                            %s::jsonb, %s::jsonb)
                    RETURNING run_id
                """, (
                    resolved_unit_id,
                    round(min(hazard, 0.99), 4),
                    round(hazard, 4),
                    db_risk_level,
                    json.dumps({
                        "rainfall_7d_mm": round(float(h.sum()), 1),
                        "forecast_24h_mm": round(forecast, 1),
                        "temporal_score": round(result["temporal_score"], 4),
                        "spatial_score": round(result["spatial_score"], 4),
                        "simulation_scenario": req.scenario,
                        "injected_via": "rainfall-inject-tool",
                    }),
                    json.dumps({"simulation_mode": True, "rainfall_valid_hours": 168}),
                ))
                run_id = str(cur.fetchone()[0])
        conn.commit()
        conn.close()
    except Exception as db_err:
        db_error = str(db_err)
        print(f"[inject] DB error: {db_err}")

    return {
        "unit_id": resolved_unit_id,
        "unit_name": unit_name,
        "unit_polygon": unit_polygon,
        "scenario": req.scenario,
        "run_id": run_id,
        "hazard_score": round(hazard, 4),
        "temporal_score": round(result["temporal_score"], 4),
        "spatial_score": round(result["spatial_score"], 4),
        "alert_level": alert_level,
        "risk_level": db_risk_level,
        "rain_7d_mm": round(float(h.sum()), 1),
        "rain_24h_mm": round(float(h[-24:].sum()), 1),
        "rain_72h_mm": round(float(h[-72:].sum()), 1),
        "forecast_24h_mm": round(forecast, 1),
        "forecast_in_queue": run_id is not None,
        "db_error": db_error,
        "seed": seed,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
