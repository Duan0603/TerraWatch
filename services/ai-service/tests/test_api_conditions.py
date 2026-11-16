"""HTTP conditions for the AI service from docs/test-cases/test-conditions.csv that no older test asserts.

Condition IDs (PY-AI-*) are in test names, parametrize ids or comments. No Redis, network or real model file is used.
"""
import copy
import json
import os

import pytest
from fastapi.testclient import TestClient

from app import main

client = TestClient(main.app, raise_server_exceptions=False)

GRU = {
    "unit_id": "u1", "history": [1.0] * 168, "forecast_24h_mm": 10.0,
    "static": {"slope_deg": 30, "elevation_m": 500, "clay_pct": 20, "sand_pct": 40, "bulk_density_g_cm3": 1.3},
    "issue_time": "2026-11-07T08:00:00Z", "weather_source": "OPEN_METEO",
}
FC = {"schema_version": "rainfall-terrain-24h.v1", "snapshot_id": "s1", "assessment_unit_id": "U1",
      "issued_at": "2026-11-07T08:00:00Z", "horizon_hours": 24}
SCENE = {"ref_tif": "ref.tif", "post_tif": "post.tif", "pre_tif": "pre.tif"}
BBOX = [104.08, 21.84, 104.09, 21.85]
JSON_CT = {"content-type": "application/json"}
STATIC_FIELDS = ["slope_deg", "clay_pct", "sand_pct", "bulk_density_g_cm3"]  # required; elevation_m is Optional[float]


def gru(**kw):
    b = copy.deepcopy(GRU)
    for k, v in kw.items():
        if k.startswith("static_"):
            b["static"][k[7:]] = v
        else:
            b[k] = v
    return b


def raw_gru(old, new):
    return json.dumps(GRU).replace(old, new)


@pytest.fixture
def pred(scene_env, monkeypatch):
    monkeypatch.setattr(main, "predictor", scene_env)
    return scene_env


@pytest.fixture
def no_model(monkeypatch):
    monkeypatch.setattr(main, "predictor", main.LandslidePredictor("nope.onnx", "nope.json", "nodir"))


def boom(*_a, **_k):
    raise RuntimeError("/srv/secret/path password=hunter2")


# ---------------------------------------------------------------- wrong methods (PY-AI-001/003/007/011/013/015/019)
@pytest.mark.parametrize("method,path", [
    ("post", "/health"), ("post", "/api/v1/models/info"), ("post", "/api/v1/models/gru/info"),
    ("get", "/api/v1/inference/gru/live"), ("get", "/api/v1/inference"), ("get", "/api/v1/inference/scene"),
    ("put", "/api/v1/forecasts"), ("delete", "/health"),
], ids=lambda v: v.strip("/").replace("/", "-") if v.startswith("/") else v)
def test_wrong_method_is_405_not_a_silent_success(method, path):
    r = getattr(client, method)(path)
    assert r.status_code == 405 and "allow" in r.headers


# ---------------------------------------------------------------- PY-AI-001/002: GRU info
def test_py_ai_001_gru_info_exact_contract():
    j = client.get("/api/v1/models/gru/info").json()
    assert set(j) == {"ready", "model_id", "checkpoint_sha256", "experimental_only", "runtime", "trained_history_provider",
                      "trained_forecast_provider", "calibrated_probability"}
    assert j["ready"] is True and j["experimental_only"] is True and j["calibrated_probability"] is False
    assert (j["trained_history_provider"], j["trained_forecast_provider"]) == ("IMERG", "GFS")


def test_py_ai_002_gru_info_unexpected_failure_is_500_and_does_not_claim_ready(monkeypatch):
    monkeypatch.setattr(main, "live_gru_model", boom)
    r = client.get("/api/v1/models/gru/info")
    assert r.status_code == 500
    assert "ready" not in r.text and "hunter2" not in r.text and "/srv/secret" not in r.text


# ---------------------------------------------------------------- PY-AI-012/008: health and forecast do not depend on model artifacts
def test_py_ai_012_health_does_not_touch_gru_artifacts(no_model, monkeypatch):
    monkeypatch.setattr(main, "live_gru_model", boom)
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["model_ready"] is False


def test_py_ai_012_health_when_readiness_check_itself_fails_is_500_without_internals(monkeypatch):
    monkeypatch.setattr(main.predictor, "is_ready", boom)
    r = client.get("/health")
    assert r.status_code == 500 and "hunter2" not in r.text and "/srv/secret" not in r.text


def test_py_ai_008_forecast_needs_no_model_or_artifact(no_model, monkeypatch):
    """The 24h contract answers 'unavailable' without loading the GRU or the ONNX model, so nothing can fail under it."""
    monkeypatch.setattr(main, "live_gru_model", boom)
    monkeypatch.setattr(main.predictor, "predict_scene", boom)
    r = client.post("/api/v1/forecasts", json=FC)
    assert r.status_code == 200 and r.json()["availability"] == "unavailable"


# ---------------------------------------------------------------- PY-AI-014: model info failures
@pytest.mark.parametrize("breaker", ["corrupt_json", "no_floor", "no_modes"])
def test_py_ai_014_model_info_unreadable_card_is_200_not_ready_without_parser_text(pred, breaker):
    card = copy.deepcopy(pred.card)
    if breaker == "no_floor":
        del card["input"]["preprocessing"]
    if breaker == "no_modes":
        del card["modes"]
    open(pred.card_path, "w").write("{broken" if breaker == "corrupt_json" else json.dumps(card))
    r = client.get("/api/v1/models/info")
    j = r.json()
    assert r.status_code == 200
    assert j["ready"] is False and j["detail"] == "model card unreadable or invalid"
    assert str(pred.card_path) not in r.text and "Expecting" not in r.text
    for k in ("name", "version", "metrics", "sha256_ok", "modes"):
        assert k not in j  # no identity is invented from a card that could not be read


@pytest.mark.parametrize("remove", ["model_path", "card_path"])
def test_py_ai_014_model_info_each_missing_file_means_not_ready(pred, remove):
    os.remove(getattr(pred, remove))
    j = client.get("/api/v1/models/info").json()
    assert j["ready"] is False and j["detail"].startswith("missing ")
    assert "name" not in j and "metrics" not in j


# ---------------------------------------------------------------- PY-AI-004/005/006/023-052: GRU live
@pytest.mark.parametrize("field", STATIC_FIELDS)
def test_py_ai_023_static_field_missing_or_null_is_422_naming_the_field(field):
    """Covers PY-AI-023, 026, 029, 032 (one per field, in STATIC_FIELDS order)."""
    missing = copy.deepcopy(GRU)
    del missing["static"][field]
    for body in (missing, gru(**{f"static_{field}": None})):
        r = client.post("/api/v1/inference/gru/live", json=body)
        assert r.status_code == 422
        assert any(e["loc"] == ["body", "static", field] for e in r.json()["detail"])


@pytest.mark.parametrize("static", [None, [1], "x", 5, {}], ids=["PY-AI-044-null", "PY-AI-045-list", "PY-AI-045-string",
                                                                 "PY-AI-045-number", "PY-AI-044-empty-object"])
def test_py_ai_044_static_must_be_a_complete_object(static):
    r = client.post("/api/v1/inference/gru/live", json=gru(static=static))
    assert r.status_code == 422 and isinstance(r.json()["detail"], list)


def test_py_ai_044_empty_static_reports_every_missing_required_field():
    locs = {tuple(e["loc"]) for e in client.post("/api/v1/inference/gru/live", json=gru(static={})).json()["detail"]}
    assert locs == {("body", "static", f) for f in STATIC_FIELDS}


def test_py_ai_024_numeric_strings_are_coerced_and_unknown_static_keys_ignored():
    """Pydantic lax mode: '20' behaves exactly like 20; extra static keys do not change the score."""
    base = client.post("/api/v1/inference/gru/live", json=GRU).json()
    as_str = client.post("/api/v1/inference/gru/live", json=gru(static_clay_pct="20", static_sand_pct="40")).json()
    extra = client.post("/api/v1/inference/gru/live", json=gru(static_color="red")).json()
    assert as_str["hazard_score"] == base["hazard_score"] == extra["hazard_score"]


@pytest.mark.parametrize("field", STATIC_FIELDS)
@pytest.mark.parametrize("value", ["steep", [1], {"v": 1}], ids=["word", "list", "object"])
def test_py_ai_024_static_field_wrong_type_is_422_naming_the_field(field, value):
    """Covers PY-AI-024, 027, 030, 033."""
    r = client.post("/api/v1/inference/gru/live", json=gru(**{f"static_{field}": value}))
    assert r.status_code == 422 and any(e["loc"] == ["body", "static", field] for e in r.json()["detail"])


def test_py_ai_025_range_error_on_a_string_number_is_still_422():
    r = client.post("/api/v1/inference/gru/live", json=gru(static_bulk_density_g_cm3="12"))
    assert r.status_code == 422


@pytest.mark.parametrize("unit_id", ["Ô-1", "VN_LC_BATXAT_0001", "a b", "1", "<b>x</b>", "x" * 100],
                         ids=["unicode", "typical", "space", "digit", "markup", "max-length"])
def test_py_ai_037_unit_id_is_echoed_verbatim(unit_id):
    r = client.post("/api/v1/inference/gru/live", json=gru(unit_id=unit_id))
    assert r.status_code == 200 and r.json()["unit_id"] == unit_id


@pytest.mark.parametrize("history", [None, [None] * 168, [[1.0]] * 168, [{"a": 1}] * 168, "1,2,3"],
                         ids=["PY-AI-038-null", "PY-AI-039-null-items", "PY-AI-039-nested-lists", "PY-AI-039-objects", "PY-AI-039-string"])
def test_py_ai_038_history_wrong_shape_is_422(history):
    assert client.post("/api/v1/inference/gru/live", json=gru(history=history)).status_code == 422


def test_py_ai_039_history_numeric_strings_equal_numbers():
    a = client.post("/api/v1/inference/gru/live", json=gru(history=["1.0"] * 168)).json()
    b = client.post("/api/v1/inference/gru/live", json=GRU).json()
    assert a["temporal_score"] == b["temporal_score"]


def test_py_ai_040_history_order_matters_oldest_first():
    """The 168 values are a time series, not a set: reversing a ramp changes the score."""
    ramp = [float(i) / 10 for i in range(168)]
    up = client.post("/api/v1/inference/gru/live", json=gru(history=ramp)).json()["temporal_score"]
    down = client.post("/api/v1/inference/gru/live", json=gru(history=ramp[::-1])).json()["temporal_score"]
    assert up != down


@pytest.mark.parametrize("value", [None, "heavy", [1], {"mm": 1}], ids=["null", "word", "list", "object"])
def test_py_ai_042_forecast_24h_mm_wrong_type_is_422(value):
    r = client.post("/api/v1/inference/gru/live", json=gru(forecast_24h_mm=value))
    assert r.status_code == 422 and any(e["loc"] == ["body", "forecast_24h_mm"] for e in r.json()["detail"])


@pytest.mark.parametrize("value", [None, 5, [1], "2026-11-07"], ids=["PY-AI-047-null", "PY-AI-048-number-is-epoch", "PY-AI-048-list",
                                                                    "PY-AI-048-date-only"])
def test_py_ai_048_issue_time_unusable_values_never_yield_a_score(value):
    r = client.post("/api/v1/inference/gru/live", json=gru(issue_time=value))
    assert r.status_code in (200, 422)
    if r.status_code == 200:  # a bare number is an epoch in UTC, so it carries a zone and is answered
        assert r.json()["issue_time"] == "1970-01-01T00:00:05+00:00"
    else:
        assert "hazard_score" not in r.text


@pytest.mark.parametrize("value", ["open_meteo", "OPEN-METEO", "OPEN_METEO ", None, 1, ["OPEN_METEO"]],
                         ids=["lowercase", "hyphen", "trailing-space", "null", "number", "list"])
def test_py_ai_051_weather_source_must_be_exactly_open_meteo(value):
    r = client.post("/api/v1/inference/gru/live", json=gru(weather_source=value))
    assert r.status_code == 422
    assert any(e["loc"] == ["body", "weather_source"] for e in r.json()["detail"])


def test_py_ai_004_gru_live_does_not_call_model_when_validation_fails(monkeypatch):
    calls = []
    monkeypatch.setattr(main, "live_gru_model", lambda: calls.append(1))
    assert client.post("/api/v1/inference/gru/live", json=gru(history=[1.0] * 10)).status_code == 422
    assert calls == []


def test_py_ai_004_gru_live_passes_request_values_to_model_unchanged(monkeypatch):
    seen = []

    class M:
        def predict(self, history, forecast, static):
            seen.append((history, forecast, static))
            return {"temporal_score": 0.1, "spatial_score": 0.2, "hazard_score": 0.02}

    monkeypatch.setattr(main, "live_gru_model", lambda: M())
    body = gru(forecast_24h_mm="12.5", static_clay_pct="30")
    j = client.post("/api/v1/inference/gru/live", json=body).json()
    assert seen == [([1.0] * 168, 12.5, {"slope_deg": 30.0, "elevation_m": 500.0, "clay_pct": 30.0, "sand_pct": 40.0,
                                          "bulk_density_g_cm3": 1.3})]
    assert j["hazard_score"] == 0.02 and j["unit_id"] == "u1"  # model result merged, request identity added


def test_py_ai_004_model_value_error_text_is_returned_as_422_detail_only(monkeypatch):
    class M:
        def predict(self, *a):
            raise ValueError("history must be finite")

    monkeypatch.setattr(main, "live_gru_model", lambda: M())
    r = client.post("/api/v1/inference/gru/live", json=GRU)
    assert r.status_code == 422 and r.json() == {"detail": "history must be finite"}


# ---- known bugs found while probing these conditions
@pytest.mark.xfail(strict=True, reason="BUG: expected 422 for a non-finite number in forecast_24h_mm/elevation_m/slope_deg "
                                       "(allow_inf_nan=False); actual: 500 Internal Server Error, because the validation "
                                       "error echoes the input inf/nan and the JSON encoder cannot serialise it.")
@pytest.mark.parametrize("literal", ["NaN", "Infinity", "-Infinity", "1e999"])
@pytest.mark.parametrize("old,field", [('"forecast_24h_mm": 10.0', "forecast_24h_mm"), ('"elevation_m": 500', "elevation_m"),
                                       ('"slope_deg": 30', "slope_deg")])
def test_py_ai_043_nonfinite_scalar_is_422_not_500(old, field, literal):
    r = client.post("/api/v1/inference/gru/live", content=raw_gru(old, f'"{field}": {literal}'), headers=JSON_CT)
    assert r.status_code == 422


@pytest.mark.xfail(strict=True, reason="BUG: expected 422 for history values so large that the 7-day sum overflows to inf; "
                                       "actual: 500 Internal Server Error (response contains a non-JSON float).")
def test_py_ai_040_history_overflowing_sum_is_422_not_500():
    assert client.post("/api/v1/inference/gru/live", json=gru(history=[1e308] * 168)).status_code == 422


@pytest.mark.xfail(strict=True, reason="BUG: expected 422 for an issue_time/issued_at at year 9999 (valid_until = +24h is "
                                       "out of range); actual: 500 Internal Server Error (OverflowError).")
@pytest.mark.parametrize("path,body,field", [("/api/v1/inference/gru/live", GRU, "issue_time"), ("/api/v1/forecasts", FC, "issued_at")],
                         ids=["PY-AI-049-gru-live", "PY-AI-067-forecasts"])
def test_py_ai_049_timestamp_at_datetime_max_is_422_not_500(path, body, field):
    assert client.post(path, json={**body, field: "9999-12-31T23:59:59Z"}).status_code == 422


# ---------------------------------------------------------------- PY-AI-007/009/010/053-073: forecasts
def test_py_ai_007_forecast_response_has_exactly_the_contract_keys():
    j = client.post("/api/v1/forecasts", json=FC).json()
    assert set(j) == {"assessment_unit_id", "assessment_unit_version", "issued_at", "valid_from", "valid_until", "horizon_hours",
                      "availability", "reason_codes", "unavailability_reason", "probability", "experimental_score",
                      "hazard_level", "model_version", "threshold_version", "input_quality", "factors"}
    assert j["assessment_unit_version"] is None  # absent request field is echoed as null, never invented


def test_py_ai_065_forecast_offset_time_keeps_its_zone_and_window():
    j = client.post("/api/v1/forecasts", json={**FC, "issued_at": "2026-11-07T15:00:00+07:00"}).json()
    assert j["issued_at"] == j["valid_from"] == "2026-11-07T15:00:00+07:00" and j["valid_until"] == "2026-11-08T15:00:00+07:00"


@pytest.mark.parametrize("body,expect", [
    ({"assessment_unit_version": None}, None), ({"assessment_unit_version": ""}, ""), ({"assessment_unit_version": "v2"}, "v2"),
], ids=["PY-AI-062-null", "PY-AI-064-empty", "PY-AI-062-value"])
def test_py_ai_062_unit_version_is_echoed_as_sent(body, expect):
    assert client.post("/api/v1/forecasts", json={**FC, **body}).json()["assessment_unit_version"] == expect


@pytest.mark.parametrize("bad", [
    {"snapshot_id": None}, {"snapshot_id": [1]}, {"assessment_unit_version": 5}, {"assessment_unit_version": [1]},
    {"model_version": 2}, {"model_version": ["x"]}, {"horizon_hours": None}, {"horizon_hours": "24"}, {"horizon_hours": True},
    {"horizon_hours": [24]}, {"schema_version": "RAINFALL-TERRAIN-24H.V1"}, {"schema_version": ""}, {"schema_version": 1},
    {"assessment_unit_id": None}, {"assessment_unit_id": ["U1"]}, {"issued_at": "2026-13-07T08:00:00Z"}, {"issued_at": [1]},
], ids=["PY-AI-057-snapshot-null", "PY-AI-057-snapshot-list", "PY-AI-063-version-number", "PY-AI-063-version-list",
        "PY-AI-072-model-number", "PY-AI-072-model-list", "PY-AI-069-horizon-null", "PY-AI-069-horizon-string",
        "PY-AI-069-horizon-bool", "PY-AI-069-horizon-list", "PY-AI-054-schema-case", "PY-AI-055-schema-empty",
        "PY-AI-054-schema-number", "PY-AI-060-unit-null", "PY-AI-060-unit-list", "PY-AI-066-month-13", "PY-AI-066-list"])
def test_forecast_field_errors_422_name_the_field_and_return_no_forecast(bad):
    r = client.post("/api/v1/forecasts", json={**FC, **bad})
    assert r.status_code == 422
    assert any(e["loc"] == ["body", next(iter(bad))] for e in r.json()["detail"])
    assert "availability" not in r.text


def test_py_ai_068_horizon_24_as_float_is_accepted_and_echoed_as_int():
    j = client.post("/api/v1/forecasts", json={**FC, "horizon_hours": 24.0}).json()
    assert j["horizon_hours"] == 24 and isinstance(j["horizon_hours"], int)


def test_py_ai_009_forecast_all_required_fields_missing_lists_each_one():
    r = client.post("/api/v1/forecasts", json={})
    assert r.status_code == 422
    assert {e["loc"][-1] for e in r.json()["detail"]} == {"schema_version", "assessment_unit_id", "issued_at", "horizon_hours"}


@pytest.mark.parametrize("content,headers", [(None, {}), ("null", JSON_CT), ("[]", JSON_CT), ('{"a":', JSON_CT)],
                         ids=["no-body", "json-null", "json-array", "truncated-json"])
def test_py_ai_009_forecast_body_must_be_a_json_object(content, headers):
    assert client.post("/api/v1/forecasts", content=content, headers=headers).status_code == 422


def test_py_ai_010_forecast_extra_fields_are_ignored_not_echoed():
    r = client.post("/api/v1/forecasts", json={**FC, "debug": True, "probability": 0.99})
    assert r.status_code == 200 and r.json()["probability"] is None and "debug" not in r.json()


# ---------------------------------------------------------------- PY-AI-015..018, 074-085: legacy bbox inference
def test_py_ai_016_legacy_inference_failure_is_500_without_fabricated_detection(monkeypatch):
    monkeypatch.setattr(main.predictor, "predict_patch", boom)
    r = client.post("/api/v1/inference", json={"satellite_scene_id": "S", "bbox": BBOX})
    assert r.status_code == 500 and "detection" not in r.text and "hunter2" not in r.text


@pytest.mark.parametrize("extra", [{}, {"slope_avg": 40, "ndvi_drop": -0.5}, {"slope_avg": "12", "ndvi_drop": 1e9},
                                   {"slope_avg": None, "ndvi_drop": None}, {"slope_avg": -999, "ndvi_drop": 999}],
                         ids=["PY-AI-080-083-absent", "typical", "PY-AI-081-numeric-strings", "PY-AI-080-null", "PY-AI-082-085-out-of-domain"])
def test_py_ai_080_deprecated_fields_never_reach_the_predictor(monkeypatch, extra):
    calls = []

    def spy(**kw):
        calls.append(kw)
        return {"status": "no_imagery", "candidates": []}

    monkeypatch.setattr(main.predictor, "predict_patch", spy)
    r = client.post("/api/v1/inference", json={"satellite_scene_id": "S", "bbox": BBOX, **extra})
    assert r.status_code == 200 and calls == [{"bbox": BBOX}]


@pytest.mark.parametrize("sid", ["", "Ô-1", "x" * 5000, " S "], ids=["empty", "unicode", "long", "padded"])
def test_py_ai_076_scene_id_is_an_opaque_string_echoed_back(sid):
    r = client.post("/api/v1/inference", json={"satellite_scene_id": sid, "bbox": BBOX})
    assert r.status_code == 200 and r.json()["satellite_scene_id"] == sid


@pytest.mark.parametrize("bad", [
    {"satellite_scene_id": None}, {"satellite_scene_id": ["S"]}, {"bbox": None}, {"bbox": {"a": 1}}, {"bbox": [None, 2, 3, 4]},
    {"bbox": [[1], 2, 3, 4]}, {"slope_avg": [1]}, {"slope_avg": {"v": 1}}, {"ndvi_drop": "x"}, {"ndvi_drop": [1]},
], ids=["PY-AI-075-sid-null", "PY-AI-075-sid-list", "PY-AI-078-bbox-null", "PY-AI-078-bbox-object", "PY-AI-078-bbox-null-item",
        "PY-AI-078-bbox-nested", "PY-AI-081-slope-list", "PY-AI-081-slope-object", "PY-AI-084-ndvi-word", "PY-AI-084-ndvi-list"])
def test_inference_field_type_errors_422_and_no_detection(bad):
    r = client.post("/api/v1/inference", json={"satellite_scene_id": "S", "bbox": BBOX, **bad})
    assert r.status_code == 422 and "detection" not in r.text


def test_py_ai_077_bbox_numeric_strings_are_coerced_to_floats():
    r = client.post("/api/v1/inference", json={"satellite_scene_id": "S", "bbox": ["104.08", "21.84", "104.09", "21.85"]})
    assert r.status_code == 200 and r.json()["detection"]["bbox"] == BBOX


@pytest.mark.parametrize("content,headers", [(None, {}), ("null", JSON_CT), ("[]", JSON_CT)], ids=["no-body", "json-null", "json-array"])
def test_py_ai_017_inference_body_must_be_a_json_object(content, headers):
    assert client.post("/api/v1/inference", content=content, headers=headers).status_code == 422


def test_py_ai_018_wrong_bbox_length_is_checked_after_types_and_never_reaches_predictor(monkeypatch):
    calls = []
    monkeypatch.setattr(main.predictor, "predict_patch", lambda **kw: calls.append(kw))
    assert client.post("/api/v1/inference", json={"satellite_scene_id": "S", "bbox": [1, 2, 3]}).status_code == 400
    assert client.post("/api/v1/inference", json={"satellite_scene_id": "S", "bbox": [1, 2, "x", 4]}).status_code == 422
    assert calls == []


# ---------------------------------------------------------------- PY-AI-019..022, 086-103: scene inference
@pytest.mark.parametrize("field", ["ref_tif", "post_tif", "pre_tif", "mode", "image_source", "image_period"])
@pytest.mark.parametrize("value", [None, ["a.tif"], {"n": "a.tif"}, 1.5], ids=["null", "list", "object", "float"])
def test_py_ai_086_scene_string_fields_reject_non_strings_before_any_file_work(pred, field, value):
    """Covers PY-AI-087, 090, 093, 096, 099, 102 (wrong type of ref_tif, post_tif, pre_tif, mode, image_source, image_period)."""
    r = client.post("/api/v1/inference/scene", json={**SCENE, field: value})
    assert r.status_code == 422
    assert any(e["loc"] == ["body", field] for e in r.json()["detail"])
    assert pred._session.feeds == []


@pytest.mark.parametrize("missing", ["ref_tif", "post_tif", "pre_tif"])
def test_py_ai_089_each_required_file_name_is_reported_when_missing(pred, missing):
    """Covers PY-AI-086, 089, 092."""
    r = client.post("/api/v1/inference/scene", json={k: v for k, v in SCENE.items() if k != missing})
    assert r.status_code == 422
    assert [e["loc"] for e in r.json()["detail"]] == [["body", missing]]


def test_py_ai_098_scene_source_and_period_default_to_empty_strings(pred):
    """Covers PY-AI-098, 101."""
    j = client.post("/api/v1/inference/scene", json=SCENE).json()
    assert j["metadata"]["image_source"] == "" and j["metadata"]["image_period"] == ""
    assert j["features"][0]["properties"]["image_source"] == "" == j["features"][0]["properties"]["image_period"]


@pytest.mark.parametrize("mode,thr", [("sensitive", 0.3), ("balanced", 0.5), ("conservative", 0.7)])
def test_py_ai_095_each_mode_uses_its_model_card_threshold(pred, mode, thr):
    j = client.post("/api/v1/inference/scene", json={**SCENE, "mode": mode}).json()
    assert j["metadata"]["mode"] == mode and j["metadata"]["threshold"] == thr and j["metadata"]["std_floor"] == 2.0


@pytest.mark.parametrize("mode", [" balanced", "balanced ", "Balanced", "balanced\n", "bal"], ids=["lead-space", "trail-space", "capital",
                                                                                           "newline", "prefix"])
def test_py_ai_097_mode_must_match_exactly(pred, mode):
    r = client.post("/api/v1/inference/scene", json={**SCENE, "mode": mode})
    assert r.status_code == 400 and "mode must be one of" in r.json()["detail"]
    assert pred._session.feeds == []


@pytest.mark.parametrize("body,status", [
    ({**SCENE, "mode": "extreme"}, 400), ({**SCENE, "post_tif": "../x.tif"}, 400), (SCENE, 503),
], ids=["PY-AI-097-bad-mode", "PY-AI-091-bad-name", "PY-AI-020-valid-but-no-model"])
def test_py_ai_020_scene_validation_comes_before_the_model_check(no_model, body, status):
    """Bad input is the caller's fault (400) even when the model is not installed; only valid input reaches 503."""
    assert client.post("/api/v1/inference/scene", json=body).status_code == status


def test_py_ai_020_engine_failure_detail_is_generic(pred):
    from tests.conftest import FakeSession
    pred._session = FakeSession(exc=Exception("/srv/models/secret.onnx: CUDA error"))
    r = client.post("/api/v1/inference/scene", json=SCENE)
    assert r.status_code == 503 and r.json() == {"detail": "inference engine unavailable"}


def test_py_ai_020_unreadable_geotiff_is_400_with_fixed_detail(pred):
    open(f"{pred.scene_dir}/post.tif", "wb").write(b"not a tif")
    r = client.post("/api/v1/inference/scene", json=SCENE)
    assert r.status_code == 400 and r.json() == {"detail": "scene file is not a readable GeoTIFF"}
    assert str(pred.scene_dir) not in r.text


def test_py_ai_020_zero_byte_geotiff_is_400(pred):
    open(f"{pred.scene_dir}/pre.tif", "wb").close()
    r = client.post("/api/v1/inference/scene", json=SCENE)
    assert r.status_code == 400 and "features" not in r.json()


def test_py_ai_020_directory_named_like_a_tif_is_not_found(pred):
    os.mkdir(f"{pred.scene_dir}/dir.tif")
    r = client.post("/api/v1/inference/scene", json={**SCENE, "ref_tif": "dir.tif"})
    assert r.status_code == 404 and r.json() == {"detail": "scene file not found: dir.tif"}


@pytest.mark.parametrize("field", ["ref_tif", "post_tif", "pre_tif"])
def test_py_ai_020_missing_file_names_only_the_requested_file(pred, field):
    r = client.post("/api/v1/inference/scene", json={**SCENE, field: "gone.tif"})
    assert r.status_code == 404 and r.json() == {"detail": "scene file not found: gone.tif"}
    assert pred._session.feeds == []


@pytest.mark.parametrize("name", ["R.TIF", "r.TiFf", "scene 1.tif", "Ô.tif"], ids=["upper-tif", "mixed-tiff", "space", "unicode"])
def test_py_ai_088_file_name_extension_is_case_insensitive_and_odd_names_resolve(pred, name):
    import shutil
    shutil.copy(f"{pred.scene_dir}/ref.tif", f"{pred.scene_dir}/{name}")
    assert client.post("/api/v1/inference/scene", json={**SCENE, "ref_tif": name}).status_code == 200


# ---- known bugs: a damaged server-side model card is reported as a client error or an unhandled 500
@pytest.mark.xfail(strict=True, reason="BUG: expected 503 with a fixed message when the server's model_card.json is corrupt or "
                                       "incomplete; actual: 400 carrying the JSON parser text, or an unhandled 500 when 'modes' "
                                       "is missing, or 400 'could not convert string to float' for a non-numeric threshold.")
@pytest.mark.parametrize("breaker", ["corrupt_json", "no_modes", "non_numeric_threshold"])
def test_py_ai_020_damaged_model_card_is_503_not_400_or_500(pred, breaker):
    card = copy.deepcopy(pred.card)
    if breaker == "no_modes":
        del card["modes"]
    if breaker == "non_numeric_threshold":
        card["modes"]["balanced"] = "x"
    open(pred.card_path, "w").write("{broken" if breaker == "corrupt_json" else json.dumps(card))
    r = client.post("/api/v1/inference/scene", json=SCENE)
    assert r.status_code == 503 and "Expecting" not in r.text and "convert" not in r.text


# ---------------------------------------------------------------- PY-AI-073 / 100 / 103: free-text fields have no boundary
@pytest.mark.parametrize("value", ["", "x" * 5000, "Ô-v1"], ids=["empty", "long", "unicode"])
def test_py_ai_073_model_version_is_accepted_but_never_echoed_as_a_released_model(value):
    j = client.post("/api/v1/forecasts", json={**FC, "model_version": value}).json()
    assert j["model_version"] is None and j["availability"] == "unavailable"  # a requested version is not a loaded model


@pytest.mark.parametrize("field,key", [("image_source", "PY-AI-100"), ("image_period", "PY-AI-103")])
@pytest.mark.parametrize("value", ["", "Sentinel-2 Ô", "x" * 5000], ids=["empty", "unicode", "long"])
def test_py_ai_100_103_scene_free_text_is_copied_to_metadata_and_every_feature(pred, field, key, value):
    j = client.post("/api/v1/inference/scene", json={**SCENE, field: value}).json()
    assert j["metadata"][field] == value
    assert {f["properties"][field] for f in j["features"]} == {value}
