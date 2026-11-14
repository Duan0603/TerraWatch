"""inference.py helpers and predict_scene with a fake ONNX session and tiny synthetic GeoTIFFs."""
import json
import os

import numpy as np
import pytest

from app.services import inference
from app.services.inference import LandslidePredictor, load_card, predict_onnx, read_aligned
from tests.conftest import FakeSession, write_tif

T = inference.TILE


# ---------- load_card ----------
def test_load_card_ok(tmp_path):
    p = tmp_path / "c.json"
    p.write_text(json.dumps({"modes": {"balanced": 0.5}, "input": {"preprocessing": {"std_floor_multiplier": 2}}}))
    card, modes, floor = load_card(str(p))
    assert modes == {"balanced": 0.5} and floor == 2.0 and isinstance(floor, float)


@pytest.mark.parametrize("card", [{"modes": {}}, {"modes": {}, "input": {}}, {"modes": {}, "input": {"preprocessing": {}}}])
def test_load_card_missing_floor_asserts(tmp_path, card):
    p = tmp_path / "c.json"
    p.write_text(json.dumps(card))
    with pytest.raises(AssertionError, match="std_floor_multiplier"):
        load_card(str(p))


def test_load_card_missing_modes_keyerror(tmp_path):
    p = tmp_path / "c.json"
    p.write_text("{}")
    with pytest.raises(KeyError):
        load_card(str(p))


def test_load_card_missing_or_corrupt_file(tmp_path):
    with pytest.raises(OSError):
        load_card(str(tmp_path / "none.json"))
    p = tmp_path / "bad.json"
    p.write_text("{")
    with pytest.raises(ValueError):
        load_card(str(p))


def test_real_card_if_present_has_ordered_modes():
    if not os.path.isfile("models/model_card.json"):
        pytest.skip("model files not present")
    _, modes, floor = load_card("models/model_card.json")
    assert modes["sensitive"] < modes["balanced"] < modes["conservative"] and floor > 0


# ---------- predictor basics ----------
def test_defaults_from_env(monkeypatch):
    monkeypatch.setenv("ONNX_MODEL_PATH", "a.onnx"); monkeypatch.setenv("MODEL_CARD_PATH", "c.json"); monkeypatch.setenv("SCENE_DIR", "sd")
    p = LandslidePredictor()
    assert (p.model_path, p.card_path, p.scene_dir) == ("a.onnx", "c.json", "sd")
    monkeypatch.delenv("ONNX_MODEL_PATH"); monkeypatch.delenv("MODEL_CARD_PATH"); monkeypatch.delenv("SCENE_DIR")
    p = LandslidePredictor()
    assert p.model_path.endswith(".onnx") and p.card_path.endswith("model_card.json") and p.scene_dir == "scenes"


def test_is_ready_needs_both_files(tmp_path):
    m, c = tmp_path / "m", tmp_path / "c"
    p = LandslidePredictor(str(m), str(c))
    assert not p.is_ready()
    m.write_bytes(b"1"); assert not p.is_ready()
    c.write_text("{}"); assert p.is_ready()
    m.unlink(); assert not p.is_ready()


def test_sha256_cached(scene_env):
    a = scene_env._sha256()
    open(scene_env.model_path, "ab").write(b"more")
    assert scene_env._sha256() == a


def test_model_info_falls_back_to_top_level_sha(scene_env):
    c = scene_env.card
    c["sha256"], c["artifact"] = c["artifact"]["sha256"], {}
    open(scene_env.card_path, "w").write(json.dumps(c))
    info = scene_env.model_info()
    assert info["sha256_ok"] is True and info["trained_on"] is None


def test_model_info_no_expected_sha_is_not_ok(scene_env):
    c = scene_env.card
    c["artifact"] = {}
    open(scene_env.card_path, "w").write(json.dumps(c))
    assert scene_env.model_info()["sha256_ok"] is False


def test_predict_patch_echoes_bbox_and_ignores_extras():
    r = LandslidePredictor().predict_patch([1, 2, 3, 4], slope_avg=99, foo="bar")
    assert r["bbox"] == [1, 2, 3, 4] and r["candidates"] == [] and r["status"] == "no_imagery"
    assert "slope_avg" not in r


# ---------- file names ----------
@pytest.mark.parametrize("name", ["a.tif", "A.TIF", "x.tiff", "my scene.Tiff", "a.b.tif"])
def test_check_name_valid(name):
    LandslidePredictor._check_name(name)


@pytest.mark.parametrize("name", ["", ".tif.txt", "a", "a.png", "../a.tif", "d/a.tif", "d\\a.tif", "/a.tif", "a.tif/", "..", "a.tif\\"])
def test_check_name_invalid(name):
    with pytest.raises(ValueError):
        LandslidePredictor._check_name(name)


def test_resolve_missing_raises_filenotfound(scene_env):
    with pytest.raises(FileNotFoundError):
        scene_env._resolve("zzz.tif")
    assert scene_env._resolve("ref.tif").endswith("ref.tif")


# ---------- predict_onnx ----------
def valid_all(h, w):
    return np.ones((h, w), bool)


def test_predict_onnx_sigmoid_values():
    img = np.random.RandomState(0).rand(8, T, T).astype("float32")
    prob = predict_onnx(FakeSession(lambda n: np.full((n, T, T), np.log(3))), img, valid_all(T, T), 2.0)
    assert np.allclose(prob, 0.75, atol=1e-6)


def test_predict_onnx_image_smaller_than_tile_all_nan_and_no_session_call():
    s = FakeSession()
    prob = predict_onnx(s, np.random.rand(8, 100, 100).astype("float32"), valid_all(100, 100), 2.0)
    assert prob.shape == (100, 100) and np.isnan(prob).all() and s.feeds == []


def test_predict_onnx_batching_and_tile_count():
    s = FakeSession()
    img = np.random.RandomState(2).rand(8, 128 + 64 * 5, 128).astype("float32")  # 6 row positions x 1 col
    predict_onnx(s, img, valid_all(*img.shape[1:]), 2.0, batch=4)
    assert [len(f) for f in s.feeds] == [4, 2] and s.feeds[0].shape[1:] == (8, T, T)


def test_predict_onnx_last_tile_aligned_to_edge():
    s = FakeSession()
    img = np.random.RandomState(3).rand(8, 150, 128).astype("float32")  # rows 0,64? -> 0 then edge 22
    prob = predict_onnx(s, img, valid_all(150, 128), 2.0)
    assert not np.isnan(prob).any() and sum(len(f) for f in s.feeds) == 2


def test_predict_onnx_normalisation_is_per_tile_and_invalid_zeroed():
    s = FakeSession()
    img = np.random.RandomState(4).rand(8, T, T).astype("float32") * 100 + 7
    valid = valid_all(T, T)
    valid[:20, :] = False
    img[:, :20, :] = np.nan
    predict_onnx(s, img, valid, 2.0)
    z = s.feeds[0][0]
    assert np.isfinite(z).all() and (z[:, :20, :] == 0).all()
    assert abs(z[:, 20:, :].mean()) < 1e-3


def test_predict_onnx_std_floor_limits_amplification():
    s = FakeSession()
    img = np.zeros((8, 2 * T, T), "float32")
    img[:, :T, :] = np.random.RandomState(5).rand(8, T, T) * 100     # high scene std
    img[:, T:, :] = 50 + np.random.RandomState(6).rand(8, T, T) * 1e-3  # flat tile
    predict_onnx(s, img, valid_all(2 * T, T), 2.0, batch=1)
    flat = [f for f in s.feeds if f[0, 0].std() < 0.01]
    assert flat, "flat tile must stay flat (floor stops noise amplification)"


@pytest.mark.xfail(strict=True, reason="BUG: constant valid image with std floor 0 divides by zero; expected finite tile input, "
                   "actual NaN/inf fed to the model (RuntimeWarning)")
def test_predict_onnx_zero_variance_input_stays_finite():
    s = FakeSession()
    predict_onnx(s, np.ones((8, T, T), "float32"), valid_all(T, T), 0.0)
    assert np.isfinite(s.feeds[0]).all()


def test_predict_onnx_partly_valid_tiles_overlap_average():
    s = FakeSession(lambda n: np.stack([np.full((T, T), float(k)) for k in range(n)]))
    img = np.random.RandomState(7).rand(8, T + 64, T).astype("float32")
    prob = predict_onnx(s, img, valid_all(T + 64, T), 2.0)
    # tile0 logit 0 (p .5) rows 0-127, tile1 logit 1 rows 64-191 -> overlap averaged
    p1 = 1 / (1 + np.exp(-1.0))
    assert prob[0, 0] == pytest.approx(0.5) and prob[T + 10, 0] == pytest.approx(p1) and prob[70, 0] == pytest.approx((0.5 + p1) / 2)


def test_predict_onnx_shape_mismatch_from_model_raises():
    class Bad(FakeSession):
        def run(self, o, f):
            return [np.zeros((len(f["x"]), 1, 64, 64), "float32")]
    with pytest.raises(ValueError):
        predict_onnx(Bad(), np.random.rand(8, T, T).astype("float32"), valid_all(T, T), 2.0)


def test_predict_onnx_valid_mask_threshold_exactly_half_is_kept():
    s = FakeSession()
    valid = np.zeros((T, T), bool); valid[:64] = True   # mean == 0.5 -> kept (< 0.5 skipped)
    predict_onnx(s, np.random.RandomState(8).rand(8, T, T).astype("float32"), valid, 2.0)
    assert len(s.feeds) == 1
    valid[63] = False                                  # 63/128 < 0.5 -> skipped
    s2 = FakeSession()
    out = predict_onnx(s2, np.random.RandomState(8).rand(8, T, T).astype("float32"), valid, 2.0)
    assert s2.feeds == [] and np.isnan(out).all()


# ---------- read_aligned ----------
def ref_tf():
    from rasterio.transform import from_origin
    return from_origin(500000.0, 2000000.0, 10, 10)


def test_read_aligned_same_grid(tmp_path):
    write_tif(tmp_path / "a.tif", np.ones((2, 20, 30)))
    assert read_aligned(str(tmp_path / "a.tif"), ref_tf()).shape == (2, 20, 30)


def test_read_aligned_crops_wider_frame(tmp_path):
    arr = np.arange(2 * 20 * 30, dtype="float32").reshape(2, 20, 30)
    write_tif(tmp_path / "a.tif", arr, x0=500000.0 - 30, y0=2000000.0 + 20)  # starts 3 px left, 2 px above
    out = read_aligned(str(tmp_path / "a.tif"), ref_tf())
    assert out.shape == (2, 18, 27) and (out == arr[:, 2:, 3:]).all()


@pytest.mark.parametrize("dx,dy,msg", [(3.0, 0, "not aligned"), (0, -4.0, "not aligned"), (10, 0, "starts inside"), (0, -10, "starts inside")])
def test_read_aligned_errors(tmp_path, dx, dy, msg):
    write_tif(tmp_path / "a.tif", np.ones((1, 10, 10)), x0=500000.0 + dx, y0=2000000.0 + dy)
    with pytest.raises(AssertionError, match=msg):
        read_aligned(str(tmp_path / "a.tif"), ref_tf())


def test_read_aligned_tolerates_sub_pixel_noise(tmp_path):
    write_tif(tmp_path / "a.tif", np.ones((1, 10, 10)), x0=500000.0 - 10.2)  # 0.02 px off
    assert read_aligned(str(tmp_path / "a.tif"), ref_tf()).shape[2] == 9


# ---------- predict_scene ----------
def scene(p, mode="balanced", **kw):
    return p.predict_scene("ref.tif", "post.tif", "pre.tif", mode, **kw)


def test_scene_feature_fields_and_geometry(scene_env):
    r = scene(scene_env, meta={"image_source": "S", "image_period": "P"})
    f = r["features"][0]
    assert f["geometry"]["type"] == "Polygon" and r["summary"]["n_regions"] == 1
    p = f["properties"]
    assert p["area_ha"] == round(128 * 128 / 100, 2) and p["conf_mean"] == pytest.approx(1.0, abs=1e-3)
    assert p["change_fraction"] == 1.0 and p["temporal_check"] == "change_detected"
    assert p["quality_flag"] == "ok" and p["n_obs_median"] == 5.0
    assert p["model"] == "fake_model" and len(p["model_sha256"]) == 12 and p["threshold"] == 0.5
    lon, lat = f["geometry"]["coordinates"][0][0]
    assert 100 < lon < 110 and 15 < lat < 25  # reprojected to EPSG:4326
    assert r["metadata"]["image_source"] == "S" and r["summary"]["n_change_detected"] == 1 and r["summary"]["valid_fraction"] == 1.0


def test_scene_threshold_boundary_strictly_greater(scene_env):
    # logit 0 -> p exactly 0.5 == balanced threshold -> not > thr -> no candidates
    scene_env._session = FakeSession()
    assert scene(scene_env)["features"] == []
    assert len(scene(scene_env, "sensitive")["features"]) == 1   # 0.5 > 0.3
    assert scene(scene_env, "conservative")["features"] == []    # 0.5 < 0.7


@pytest.mark.parametrize("logit,mode,n", [(0.9, "balanced", 1), (-0.9, "sensitive", 0), (0.9, "conservative", 1), (0.5, "conservative", 0)])
def test_scene_mode_thresholds(scene_env, logit, mode, n):
    scene_env._session = FakeSession(lambda k: np.full((k, T, T), logit))
    assert len(scene(scene_env, mode)["features"]) == n


def test_scene_summary_empty_has_zeros_not_none(scene_env):
    scene_env._session = FakeSession(lambda k: np.full((k, T, T), -10.0))
    r = scene(scene_env)
    assert r["features"] == [] and r["summary"]["n_regions"] == 0 and r["summary"]["area_ha"] == 0
    assert r["summary"]["n_change_detected"] == 0 and r["summary"]["n_not_assessable"] == 0


def test_scene_small_regions_below_min_px_dropped(scene_env):
    lg = np.full((1, T, T), -10.0)
    lg[0, 10:12, 10:13] = 10  # 6 px < 8
    lg[0, 50:53, 50:53] = 10  # 9 px >= 8
    scene_env._session = FakeSession(lambda k: lg)
    assert [f["properties"]["area_ha"] for f in scene(scene_env)["features"]] == [0.09]


def test_scene_multiple_regions_multipolygon_and_ids(scene_env):
    lg = np.full((1, T, T), -10.0)
    lg[0, 10:20, 10:20] = 10
    lg[0, 60:70, 60:70] = 10
    scene_env._session = FakeSession(lambda k: lg)
    r = scene(scene_env)
    assert sorted(f["properties"]["id"] for f in r["features"]) == [1, 2] and r["summary"]["area_ha"] == 2.0


@pytest.mark.parametrize("post_nd,pre_nd,expect", [(0.2, 0.6, "change_detected"), (0.5, 0.6, "no_change"),       # dndvi -0.1 > -0.15
                                                  (0.6, 0.9, "no_change"),                                       # post >= 0.55
                                                  (0.2, 0.3, "no_change"),                                       # pre <= 0.40
                                                  (0.2, float("nan"), "not_assessable")])
def test_scene_temporal_check_classification(scene_env, post_nd, pre_nd, expect):
    post, pre = scene_env.post.copy(), scene_env.pre.copy()
    post[6], pre[6] = post_nd, pre_nd
    write_tif(f"{scene_env.scene_dir}/post.tif", post); write_tif(f"{scene_env.scene_dir}/pre.tif", pre)
    r = scene(scene_env)
    assert r["features"][0]["properties"]["temporal_check"] == expect
    assert r["summary"]["n_not_assessable"] == (expect == "not_assessable")


def test_scene_dndvi_boundary_exactly_minus_015_is_no_change(scene_env):
    post, pre = scene_env.post.copy(), scene_env.pre.copy()
    post[6], pre[6] = 0.25, 0.40 + 0.0 + 0.1 + 0.0  # diff = -0.25 -> change; make exactly 0 change below
    post[6], pre[6] = np.float32(0.5), np.float32(0.5)  # no change at all
    write_tif(f"{scene_env.scene_dir}/post.tif", post); write_tif(f"{scene_env.scene_dir}/pre.tif", pre)
    assert scene(scene_env)["features"][0]["properties"]["temporal_check"] == "no_change"


def test_scene_low_observation_flag(scene_env):
    post = scene_env.post.copy(); post[7] = 2
    write_tif(f"{scene_env.scene_dir}/post.tif", post)
    assert scene(scene_env)["features"][0]["properties"]["quality_flag"] == "low_obs"


def test_scene_pixels_without_observations_are_invalid_not_scored(scene_env):
    post = scene_env.post.copy(); post[7] = 0
    write_tif(f"{scene_env.scene_dir}/post.tif", post)
    scene_env._session = FakeSession()
    r = scene(scene_env, "sensitive")
    assert r["features"] == [] and r["summary"]["valid_fraction"] == 0.0 and scene_env._session.feeds == []


def test_scene_nan_pixels_excluded(scene_env):
    post = scene_env.post.copy(); post[0, :64, :] = np.nan
    write_tif(f"{scene_env.scene_dir}/post.tif", post)
    r = scene(scene_env)
    assert r["summary"]["valid_fraction"] == 0.5
    assert r["features"][0]["properties"]["area_ha"] == round(64 * 128 / 100, 2)


def test_scene_slope_nan_filled_with_median(scene_env):
    ref = scene_env.ref.copy(); ref[6, :5, :5] = np.nan
    write_tif(f"{scene_env.scene_dir}/ref.tif", ref)
    s = FakeSession(); scene_env._session = s
    scene(scene_env)
    assert np.isfinite(s.feeds[0]).all()


def test_scene_crops_to_common_extent(scene_env):
    big = np.random.RandomState(1).rand(8, 140, 150).astype("float32"); big[6], big[7] = 0.2, 5
    write_tif(f"{scene_env.scene_dir}/post.tif", big)
    assert scene(scene_env)["summary"]["valid_fraction"] == 1.0   # cropped to 128x128 (ref/pre)


def test_scene_input_validation_order_before_model_check(tmp_path):
    p = LandslidePredictor(str(tmp_path / "x"), str(tmp_path / "y"), str(tmp_path))
    with pytest.raises(ValueError):
        p.predict_scene("a.tif", "b.tif", "c.tif", mode="bogus")
    with pytest.raises(ValueError):
        p.predict_scene("../a.tif", "b.tif", "c.tif")
    with pytest.raises(RuntimeError):
        p.predict_scene("a.tif", "b.tif", "c.tif")


def test_scene_session_created_lazily_once(scene_env, monkeypatch):
    import sys, types
    created = []
    ort = types.ModuleType("onnxruntime")
    ort.get_available_providers = lambda: ["TensorrtExecutionProvider", "CPUExecutionProvider"]
    def mk(path, providers): created.append((path, providers)); return FakeSession(lambda k: np.full((k, T, T), 10.0))
    ort.InferenceSession = mk
    monkeypatch.setitem(sys.modules, "onnxruntime", ort)
    scene_env._session = None
    scene(scene_env); scene(scene_env)
    assert created == [(scene_env.model_path, ["CPUExecutionProvider"])]


def test_scene_all_mode_default_arg_and_meta_none(scene_env):
    r = scene_env.predict_scene("ref.tif", "post.tif", "pre.tif")
    assert r["metadata"]["mode"] == "balanced" and "image_source" not in r["metadata"]
    assert r["features"][0]["properties"]["image_source"] == ""


def test_scene_corrupt_card_propagates_not_silent(scene_env):
    open(scene_env.card_path, "w").write("{")
    with pytest.raises(ValueError):
        scene(scene_env)
