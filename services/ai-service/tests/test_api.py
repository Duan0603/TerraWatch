"""Every HTTP route through TestClient. Not used as a context manager, so the Redis startup hook never runs."""
import copy

import pytest
from fastapi.testclient import TestClient

from app import main
from app.services.live_gru import LiveGRU

client = TestClient(main.app, raise_server_exceptions=False)

GRU = {
    "unit_id": "u1", "history": [1.0] * 168, "forecast_24h_mm": 10.0,
    "static": {"slope_deg": 30, "elevation_m": 500, "clay_pct": 20, "sand_pct": 40, "bulk_density_g_cm3": 1.3},
    "issue_time": "2026-11-07T08:00:00Z", "weather_source": "OPEN_METEO",
}
FC = {"schema_version": "rainfall-terrain-24h.v1", "snapshot_id": "s1", "assessment_unit_id": "U1",
      "issued_at": "2026-11-07T08:00:00Z", "horizon_hours": 24}
SCENE = {"ref_tif": "ref.tif", "post_tif": "post.tif", "pre_tif": "pre.tif"}


def gru(**kw):
    b = copy.deepcopy(GRU)
    for k, v in kw.items():
        if k.startswith("static_"):
            b["static"][k[7:]] = v
        else:
            b[k] = v
    return b


@pytest.fixture
def pred(scene_env, monkeypatch):
    monkeypatch.setattr(main, "predictor", scene_env)
    return scene_env


@pytest.fixture
def no_model(monkeypatch):
    monkeypatch.setattr(main, "predictor", main.LandslidePredictor("nope.onnx", "nope.json", "nodir"))


# ---------- startup / CORS / docs ----------
def test_startup_starts_listener(monkeypatch):
    calls = []
    monkeypatch.setattr(main, "start_redis_listener", lambda: calls.append(1))
    main.startup_event()
    assert calls == [1]


def test_cors_allows_any_origin():
    r = client.get("/health", headers={"Origin": "http://x.example"})
    assert r.headers["access-control-allow-origin"] in ("*", "http://x.example")


def test_unknown_route_404_and_wrong_method_405():
    assert client.get("/nope").status_code == 404
    assert client.get("/api/v1/forecasts").status_code == 405


# ---------- /health ----------
def test_health_model_missing(no_model):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "service": "ai-service", "version": "1.0.0", "model_ready": False}


def test_health_model_ready(pred):
    assert client.get("/health").json()["model_ready"] is True


# ---------- /api/v1/models/info ----------
def test_model_info_missing_says_not_ready_without_inventing_identity(no_model):
    j = client.get("/api/v1/models/info").json()
    assert j["ready"] is False and "missing" in j["detail"]
    for k in ("name", "metrics", "version", "sha256_ok"):
        assert k not in j


def test_model_info_ready(pred):
    j = client.get("/api/v1/models/info").json()
    assert j["ready"] is True and j["name"] == "fake_model" and j["version"] == "vT"
    assert j["sha256_ok"] is True and j["modes"]["balanced"] == 0.5 and len(j["input_channels"]) == 8
    assert j["default_mode"] == "balanced" and j["schema_version"] == "2.0"


def test_model_info_detects_tampered_model(pred):
    pred.model_path and open(pred.model_path, "ab").write(b"x")
    assert client.get("/api/v1/models/info").json()["sha256_ok"] is False


@pytest.mark.xfail(strict=True, reason="BUG: model+card files present but card is corrupt JSON; expected 200 {ready:false} or 503, "
                   "actual: unhandled exception -> 500")
def test_model_info_corrupt_card_does_not_500(pred):
    open(pred.card_path, "w").write("{broken")
    assert client.get("/api/v1/models/info").status_code != 500


@pytest.mark.xfail(strict=True, reason="BUG: card lacks std_floor_multiplier; expected 200 {ready:false} or 503, actual: AssertionError -> 500")
def test_model_info_incomplete_card_does_not_500(pred):
    import json
    c = pred.card; del c["input"]["preprocessing"]
    open(pred.card_path, "w").write(json.dumps(c))
    assert client.get("/api/v1/models/info").status_code != 500


# ---------- /api/v1/models/gru/info ----------
def test_gru_info_ready():
    j = client.get("/api/v1/models/gru/info").json()
    assert j["ready"] is True and j["experimental_only"] is True and j["calibrated_probability"] is False
    assert len(j["checkpoint_sha256"]) == 64 and j["model_id"]


@pytest.mark.parametrize("exc", [OSError("x"), ValueError("x"), KeyError("x")])
def test_gru_info_unavailable(monkeypatch, exc):
    def boom(): raise exc
    monkeypatch.setattr(main, "live_gru_model", boom)
    r = client.get("/api/v1/models/gru/info")
    assert r.status_code == 200 and r.json() == {"ready": False, "reason": "GRU_ARTIFACT_UNAVAILABLE_OR_INVALID"}


# ---------- /api/v1/inference/gru/live ----------
def test_gru_live_ok_contract():
    r = client.post("/api/v1/inference/gru/live", json=GRU)
    assert r.status_code == 200
    j = r.json()
    for k in ("temporal_score", "spatial_score", "hazard_score"):
        assert 0 <= j[k] <= 1
    assert j["hazard_score"] == pytest.approx(j["temporal_score"] * j["spatial_score"])
    assert j["calibrated_probability"] is False and j["operational_alert"] is False
    assert j["unit_id"] == "u1" and j["weather_source"] == "OPEN_METEO"
    assert j["experimental_source_shift"] is True and j["experimental_rolling_clock"] is True
    assert j["issue_time"] == "2026-11-07T08:00:00+00:00" and j["valid_until"] == "2026-11-08T08:00:00+00:00"
    assert j["notice"]
    for bad_key in ("probability", "hazard_level"):
        assert bad_key not in j


def test_gru_live_naive_issue_time_422():
    r = client.post("/api/v1/inference/gru/live", json=gru(issue_time="2026-11-07T08:00:00"))
    assert r.status_code == 422 and "timezone" in r.json()["detail"]


@pytest.mark.parametrize("body", [
    {k: v for k, v in GRU.items() if k != "unit_id"},
    {k: v for k, v in GRU.items() if k != "history"},
    {k: v for k, v in GRU.items() if k != "static"},
    {k: v for k, v in GRU.items() if k != "issue_time"},
    {k: v for k, v in GRU.items() if k != "forecast_24h_mm"},
    {k: v for k, v in GRU.items() if k != "weather_source"},
    gru(unit_id=""), gru(unit_id="x" * 101), gru(unit_id=5),
    gru(history=[1.0] * 167), gru(history=[1.0] * 169), gru(history=[]), gru(history="abc"), gru(history=["a"] * 168),
    gru(forecast_24h_mm=-0.1), gru(forecast_24h_mm="x"),
    gru(weather_source="GFS"), gru(weather_source=""),
    gru(issue_time="not-a-date"),
    gru(static_slope_deg=-0.1), gru(static_slope_deg=90.1),
    gru(static_clay_pct=-1), gru(static_clay_pct=100.1), gru(static_sand_pct=-1), gru(static_sand_pct=100.1),
    gru(static_bulk_density_g_cm3=0), gru(static_bulk_density_g_cm3=3.01), gru(static_bulk_density_g_cm3=-1),
    gru(static_slope_deg="steep"),
])
def test_gru_live_validation_422(body):
    r = client.post("/api/v1/inference/gru/live", json=body)
    assert r.status_code == 422, r.text
    assert isinstance(r.json()["detail"], list)


def test_gru_live_non_json_and_empty_body_422():
    assert client.post("/api/v1/inference/gru/live", content="nope", headers={"content-type": "application/json"}).status_code == 422
    assert client.post("/api/v1/inference/gru/live").status_code == 422


@pytest.mark.parametrize("kw", [
    dict(unit_id="x"), dict(unit_id="x" * 100), dict(forecast_24h_mm=0), dict(static_slope_deg=0), dict(static_slope_deg=90),
    dict(static_clay_pct=0), dict(static_clay_pct=100), dict(static_sand_pct=0), dict(static_sand_pct=100),
    dict(static_bulk_density_g_cm3=3), dict(static_bulk_density_g_cm3=0.01), dict(history=[0.0] * 168),
    dict(issue_time="2026-11-07T15:00:00+07:00"),
])
def test_gru_live_boundaries_accepted(kw):
    r = client.post("/api/v1/inference/gru/live", json=gru(**kw))
    assert r.status_code == 200, r.text


def test_gru_live_offset_issue_time_echoed():
    j = client.post("/api/v1/inference/gru/live", json=gru(issue_time="2026-11-07T15:00:00+07:00")).json()
    assert j["issue_time"] == "2026-11-07T15:00:00+07:00" and j["valid_until"] == "2026-11-08T15:00:00+07:00"


def test_gru_live_elevation_optional_in_schema_but_model_needs_it():
    r = client.post("/api/v1/inference/gru/live", json=gru(static_elevation_m=None))
    assert r.status_code == 422 and "Missing/nonfinite" in r.json()["detail"]
    assert "hazard_score" not in r.json()


@pytest.mark.parametrize("val", ["NaN", "Infinity", "-Infinity"])
def test_gru_live_nonfinite_numbers_never_produce_a_score(val):
    raw = '{"unit_id":"u","history":[%s%s],"forecast_24h_mm":1,"static":{"slope_deg":1,"elevation_m":1,"clay_pct":1,"sand_pct":1,' \
          '"bulk_density_g_cm3":1},"issue_time":"2026-11-07T08:00:00Z","weather_source":"OPEN_METEO"}' % (val, ",1" * 167)
    r = client.post("/api/v1/inference/gru/live", content=raw, headers={"content-type": "application/json"})
    assert r.status_code == 422 and "hazard_score" not in r.json()


def test_gru_live_negative_rain_422_from_model():
    r = client.post("/api/v1/inference/gru/live", json=gru(history=[-1.0] * 168))
    assert r.status_code == 422 and "nonnegative" in r.json()["detail"]


@pytest.mark.parametrize("exc", [OSError("/secret/path"), KeyError("k")])
def test_gru_live_artifact_missing_503_no_leak(monkeypatch, exc):
    def boom(): raise exc
    monkeypatch.setattr(main, "live_gru_model", boom)
    r = client.post("/api/v1/inference/gru/live", json=GRU)
    assert r.status_code == 503 and r.json() == {"detail": "GRU artifact unavailable"}


@pytest.mark.xfail(strict=True, reason="BUG: GRU weight integrity failure (server-side artifact problem, ValueError from LiveGRU()) "
                   "is reported as 422 client error with raw message; expected 503, actual 422 'GRU weight integrity check failed'")
def test_gru_live_corrupt_weights_is_503(monkeypatch):
    def boom(): raise ValueError("GRU weight integrity check failed")
    monkeypatch.setattr(main, "live_gru_model", boom)
    r = client.post("/api/v1/inference/gru/live", json=GRU)
    assert r.status_code == 503


def test_gru_live_unexpected_error_is_500_without_fabricated_score(monkeypatch):
    class M:
        def predict(self, *a): raise RuntimeError("kaput")
    monkeypatch.setattr(main, "live_gru_model", lambda: M())
    r = client.post("/api/v1/inference/gru/live", json=GRU)
    assert r.status_code == 500 and "hazard_score" not in r.text


def test_live_gru_model_is_cached():
    main.live_gru_model.cache_clear()
    a = main.live_gru_model()
    assert isinstance(a, LiveGRU) and main.live_gru_model() is a


# ---------- /api/v1/forecasts ----------
def test_forecast_unavailable_contract_never_fabricates():
    r = client.post("/api/v1/forecasts", json={**FC, "assessment_unit_version": "v1", "model_version": "x"})
    assert r.status_code == 200
    j = r.json()
    assert j["availability"] == "unavailable" and j["reason_codes"] == ["MODEL_NOT_RELEASED"]
    assert j["probability"] is None and j["experimental_score"] is None and j["hazard_level"] is None
    assert j["model_version"] is None and j["threshold_version"] is None and j["factors"] == []
    assert j["input_quality"] == {"status": "not_evaluated"}
    assert j["assessment_unit_id"] == "U1" and j["assessment_unit_version"] == "v1" and j["horizon_hours"] == 24
    assert j["issued_at"] == j["valid_from"] == "2026-11-07T08:00:00+00:00"
    assert j["valid_until"] == "2026-11-08T08:00:00+00:00"


@pytest.mark.parametrize("snap,codes", [("", ["SNAPSHOT_MISSING", "MODEL_NOT_RELEASED"]),
                                        ("   ", ["SNAPSHOT_MISSING", "MODEL_NOT_RELEASED"]),
                                        ("abc", ["MODEL_NOT_RELEASED"])])
def test_forecast_reason_codes(snap, codes):
    j = client.post("/api/v1/forecasts", json={**FC, "snapshot_id": snap}).json()
    assert j["reason_codes"] == codes and j["unavailability_reason"] == ", ".join(codes)
    assert j["probability"] is None and j["hazard_level"] is None


def test_forecast_snapshot_optional():
    body = {k: v for k, v in FC.items() if k != "snapshot_id"}
    assert client.post("/api/v1/forecasts", json=body).json()["reason_codes"] == ["SNAPSHOT_MISSING", "MODEL_NOT_RELEASED"]


def test_forecast_naive_time_422():
    r = client.post("/api/v1/forecasts", json={**FC, "issued_at": "2026-11-07T08:00:00"})
    assert r.status_code == 422 and "timezone" in r.json()["detail"]


@pytest.mark.parametrize("bad", [
    {"schema_version": "v0"}, {"schema_version": None}, {"horizon_hours": 48}, {"horizon_hours": 0}, {"horizon_hours": "x"},
    {"assessment_unit_id": ""}, {"assessment_unit_id": "x" * 101}, {"assessment_unit_id": 3}, {"issued_at": "garbage"},
    {"issued_at": None}, {"snapshot_id": 5},
])
def test_forecast_validation_422(bad):
    assert client.post("/api/v1/forecasts", json={**FC, **bad}).status_code == 422


@pytest.mark.parametrize("missing", ["schema_version", "assessment_unit_id", "issued_at", "horizon_hours"])
def test_forecast_missing_required_422(missing):
    assert client.post("/api/v1/forecasts", json={k: v for k, v in FC.items() if k != missing}).status_code == 422


def test_forecast_unit_id_max_length_ok():
    assert client.post("/api/v1/forecasts", json={**FC, "assessment_unit_id": "x" * 100}).status_code == 200


# ---------- /api/v1/inference (legacy bbox) ----------
BBOX = [104.08, 21.84, 104.09, 21.85]


def test_inference_bbox_returns_no_imagery_and_invents_nothing(no_model):
    r = client.post("/api/v1/inference", json={"satellite_scene_id": "S1", "bbox": BBOX, "slope_avg": 40, "ndvi_drop": -0.5})
    assert r.status_code == 200
    j = r.json()
    assert j["success"] is True and j["satellite_scene_id"] == "S1"
    d = j["detection"]
    assert d["status"] == "no_imagery" and d["candidates"] == [] and d["bbox"] == BBOX
    for k in ("geometry", "risk_level", "confidence_score", "probability"):
        assert k not in d


@pytest.mark.parametrize("bbox", [[], [1], [1, 2, 3], [1, 2, 3, 4, 5]])
def test_inference_bad_bbox_length_400(bbox):
    r = client.post("/api/v1/inference", json={"satellite_scene_id": "S", "bbox": bbox})
    assert r.status_code == 400 and "exactly 4" in r.json()["detail"]


@pytest.mark.parametrize("body", [{}, {"bbox": BBOX}, {"satellite_scene_id": "S"}, {"satellite_scene_id": "S", "bbox": "x"},
                                  {"satellite_scene_id": "S", "bbox": ["a", "b", "c", "d"]}, {"satellite_scene_id": 1, "bbox": BBOX},
                                  {"satellite_scene_id": "S", "bbox": BBOX, "slope_avg": "steep"}])
def test_inference_validation_422(body):
    assert client.post("/api/v1/inference", json=body).status_code == 422


@pytest.mark.xfail(strict=True, reason="BUG: bbox coordinates are not range/order checked; expected 4xx for lon=500 / min>max, "
                   "actual 200 echoing the invalid bbox")
@pytest.mark.parametrize("bbox", [[500, 21, 501, 22], [104.1, 21, 104.0, 22], [104, 95, 105, 96]])
def test_inference_out_of_range_bbox_rejected(bbox):
    assert client.post("/api/v1/inference", json={"satellite_scene_id": "S", "bbox": bbox}).status_code in (400, 422)


@pytest.mark.xfail(strict=True, reason="BUG: bbox containing NaN (JSON 'NaN') is accepted and echoed as null; "
                   "expected 4xx, actual 200 with bbox [null,1,2,3]")
def test_inference_nan_bbox_is_client_error():
    r = client.post("/api/v1/inference", content='{"satellite_scene_id":"S","bbox":[NaN,1,2,3]}', headers={"content-type": "application/json"})
    assert 400 <= r.status_code < 500


# ---------- /api/v1/inference/scene ----------
def test_scene_ok_end_to_end_with_fake_session(pred):
    r = client.post("/api/v1/inference/scene", json={**SCENE, "mode": "sensitive", "image_source": "S2", "image_period": "2026-10"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["type"] == "FeatureCollection" and len(j["features"]) == 1
    p = j["features"][0]["properties"]
    assert p["review_status"] == "ai_suggested" and p["reviewed_by"] is None and p["severity"] is None
    assert p["temporal_check"] == "change_detected" and p["image_source"] == "S2" and p["image_period"] == "2026-10"
    assert j["metadata"]["mode"] == "sensitive" and j["summary"]["n_regions"] == 1
    assert "probability" not in p and "hazard_level" not in p


def test_scene_default_mode_balanced(pred):
    assert client.post("/api/v1/inference/scene", json=SCENE).json()["metadata"]["mode"] == "balanced"


@pytest.mark.parametrize("mode", ["", "SENSITIVE", "extreme"])
def test_scene_bad_mode_400(pred, mode):
    r = client.post("/api/v1/inference/scene", json={**SCENE, "mode": mode})
    assert r.status_code == 400 and "mode must be one of" in r.json()["detail"]


@pytest.mark.parametrize("name", ["../x.tif", "a/b.tif", "x.txt", "/etc/passwd", "a\\b.tif", "", "noext"])
def test_scene_bad_file_names_400(pred, name):
    for field in ("ref_tif", "post_tif", "pre_tif"):
        r = client.post("/api/v1/inference/scene", json={**SCENE, field: name})
        assert r.status_code == 400 and "invalid scene file name" in r.json()["detail"]


@pytest.mark.parametrize("body", [{}, {"ref_tif": "a.tif"}, {**SCENE, "mode": 3}, {**SCENE, "image_source": 3}, {"ref_tif": 1, "post_tif": 2, "pre_tif": 3}])
def test_scene_validation_422(pred, body):
    assert client.post("/api/v1/inference/scene", json=body).status_code == 422


def test_scene_model_not_installed_503_and_no_detections(no_model):
    r = client.post("/api/v1/inference/scene", json=SCENE)
    assert r.status_code == 503 and r.json() == {"detail": "model files are not installed"}


def test_scene_file_missing_404(pred):
    r = client.post("/api/v1/inference/scene", json={**SCENE, "post_tif": "missing.tif"})
    assert r.status_code == 404 and "scene file not found" in r.json()["detail"] and "features" not in r.json()


@pytest.mark.xfail(strict=True, reason="BUG: 404 detail embeds the absolute server filesystem path (str(FileNotFoundError(path))); "
                   "expected only the client-supplied name, actual leaks e.g. /tmp/.../scenes/missing.tif")
def test_scene_file_missing_does_not_leak_server_path(pred):
    r = client.post("/api/v1/inference/scene", json={**SCENE, "post_tif": "missing.tif"})
    assert str(pred.scene_dir) not in r.json()["detail"]


def test_scene_misaligned_grid_422(pred):
    from tests.conftest import write_tif
    write_tif(f"{pred.scene_dir}/post.tif", pred.post, x0=500000.0 + 3)
    r = client.post("/api/v1/inference/scene", json=SCENE)
    assert r.status_code == 422 and "not aligned" in r.json()["detail"]


def test_scene_image_inside_reference_422(pred):
    from tests.conftest import write_tif
    write_tif(f"{pred.scene_dir}/pre.tif", pred.pre, x0=500000.0 + 20)
    r = client.post("/api/v1/inference/scene", json=SCENE)
    assert r.status_code == 422 and "starts inside" in r.json()["detail"]


def test_scene_inference_session_error_is_not_a_fabricated_result(pred):
    from tests.conftest import FakeSession
    pred._session = FakeSession(exc=RuntimeError("onnx boom"))
    r = client.post("/api/v1/inference/scene", json=SCENE)
    assert r.status_code >= 500 and "features" not in r.json()


@pytest.mark.xfail(strict=True, reason="BUG: inference-engine failure (non-RuntimeError, e.g. ONNX InvalidArgument/ValueError-free exception) "
                   "gives unhandled 500; expected 503 'unavailable' like the model-missing case, actual 500")
def test_scene_engine_failure_is_503(pred):
    from tests.conftest import FakeSession
    pred._session = FakeSession(exc=Exception("onnx boom"))
    assert client.post("/api/v1/inference/scene", json=SCENE).status_code == 503


@pytest.mark.xfail(strict=True, reason="BUG: corrupt/non-GeoTIFF file named *.tif raises rasterio error (OSError) -> unhandled 500; "
                   "expected 4xx (422) for bad client scene, actual 500")
def test_scene_corrupt_tif_is_client_error(pred):
    open(f"{pred.scene_dir}/post.tif", "wb").write(b"not a tif")
    r = client.post("/api/v1/inference/scene", json=SCENE)
    assert 400 <= r.status_code < 500


@pytest.mark.xfail(strict=True, reason="BUG: RuntimeError text from any source is returned verbatim in a 503 detail "
                   "(engine internals leak); expected generic message, actual raw exception text")
def test_scene_runtime_error_text_not_leaked(pred, monkeypatch):
    monkeypatch.setattr(pred, "predict_scene", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("/srv/secret/model.onnx failed")))
    assert "/srv/secret" not in client.post("/api/v1/inference/scene", json=SCENE).json()["detail"]
