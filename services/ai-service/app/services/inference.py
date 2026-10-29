"""
AI inference for landslide candidates (TerraWatch model v1.0, frozen).

Pipeline: post-event image (+ pre-event image of the SAME season) -> per-tile normalisation
-> ONNX DeepLabV3+ -> mode threshold -> NDVI change check -> GeoJSON candidates.

The output is a list of candidates for human review. `conf_*` is a ranking score, not a landslide
probability, and `temporal_check` is not a confirmation. Ported from TerraWatch_AI/releases/v1.0/infer.py;
the std floor, thresholds and model identity come from model_card.json (do not change them here, a new
version needs re-measurement).
"""
import hashlib
import json
import logging
import os
import threading
from datetime import date
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

SCHEMA = "2.0"
TILE, STRIDE, MIN_PX = 128, 64, 8
CHANGE = dict(dndvi=-0.15, post_max=0.55, pre_min=0.40, min_fraction=0.10, min_pre_valid=0.5, rule="ndvi-v1")
MODES = ("sensitive", "balanced", "conservative")
NOTE = "candidates need human verification; conf is not a landslide probability; temporal_check is not confirmation"


class Busy(Exception):
    """All scene slots are in use (MAX_CONCURRENT_SCENES)."""


def season_warnings(pre_period: Optional[str], post_period: Optional[str], max_gap_days: float = 90) -> List[str]:
    """Periods are 'YYYY-MM-DD/YYYY-MM-DD'. The NDVI check needs a pre image of the same season as the post image."""
    if not pre_period or not post_period:
        return ["pre_period/post_period not given: same-season requirement not verified"]
    try:
        (pa, pb), (qa, qb) = [tuple(date.fromisoformat(x) for x in p.split("/")) for p in (pre_period, post_period)]
    except ValueError:
        return ["periods must be 'YYYY-MM-DD/YYYY-MM-DD': same-season requirement not verified"]
    out = []
    if pb >= qa:
        out.append("pre period must end before the post period starts")
    gap = ((pa.toordinal() + pb.toordinal()) / 2 - (qa.toordinal() + qb.toordinal()) / 2) % 365.25
    gap = min(gap, 365.25 - gap)
    if gap > max_gap_days:
        out.append(f"pre and post are {gap:.0f} days apart in the seasonal cycle (> {max_gap_days:.0f}): temporal_check may be unreliable")
    return out


def load_card(path: str):
    with open(path, encoding="utf-8") as f:
        card = json.load(f)
    modes = card["modes"]
    floor = card.get("input", {}).get("preprocessing", {}).get("std_floor_multiplier")
    assert floor is not None, "model card is missing input.preprocessing.std_floor_multiplier"
    return card, modes, float(floor)


def read_aligned(path: str, ref_transform):
    """Read a GeoTIFF and crop it onto the 10 m grid of the reference image (whole-pixel offsets only)."""
    import rasterio
    with rasterio.open(path) as r:
        X = r.read().astype("float32")
        t = r.transform
    fx, fy = (t.c - ref_transform.c) / 10, (ref_transform.f - t.f) / 10
    dx, dy = int(round(fx)), int(round(fy))
    assert abs(fx - dx) < 0.05 and abs(fy - dy) < 0.05, "grid is not aligned with the reference image"
    assert dx <= 0 and dy <= 0, "image starts inside the reference image; export a wider frame"
    return X[:, -dy:, -dx:]


def predict_onnx(sess, img, valid, floor_mult, batch=16):
    """img (8,H,W) -> score (H,W); NaN where no tile covers the pixel."""
    C, H, W = img.shape
    floor = np.array([img[c][valid].std() for c in range(C)], dtype="float32") * floor_mult
    acc = np.zeros((H, W), "float32")
    cnt = np.zeros((H, W), "float32")
    rs = list(range(0, H - TILE + 1, STRIDE))
    rs += [H - TILE] if rs[-1] != H - TILE else []
    cs = list(range(0, W - TILE + 1, STRIDE))
    cs += [W - TILE] if cs[-1] != W - TILE else []
    tiles, pos = [], []
    for i in rs:
        for j in cs:
            vv = valid[i:i + TILE, j:j + TILE]
            if vv.mean() < 0.5:
                continue
            x = np.nan_to_num(img[:, i:i + TILE, j:j + TILE])
            mu = np.array([x[c][vv].mean() for c in range(C)], "float32")[:, None, None]
            sd = np.maximum(np.array([x[c][vv].std() for c in range(C)], "float32"), floor)[:, None, None]
            z = (x - mu) / sd
            z[:, ~vv] = 0
            tiles.append(z.astype("float32"))
            pos.append((i, j))
    name = sess.get_inputs()[0].name
    for b in range(0, len(tiles), batch):
        lg = sess.run(None, {name: np.stack(tiles[b:b + batch])})[0][:, 0]
        p = 1 / (1 + np.exp(-lg))
        for (i, j), pp in zip(pos[b:b + batch], p):
            acc[i:i + TILE, j:j + TILE] += pp
            cnt[i:i + TILE, j:j + TILE] += 1
    out = acc / np.maximum(cnt, 1)
    out[cnt == 0] = np.nan
    return out


def _polygon(sub, transform, crs):
    from rasterio.features import shapes
    from rasterio.warp import transform_geom
    from shapely.geometry import MultiPolygon, mapping, shape
    gs = [shape(g) for g, _ in shapes(sub.astype("uint8"), mask=sub, transform=transform, connectivity=8)]
    geom = gs[0] if len(gs) == 1 else MultiPolygon(gs)
    return transform_geom(crs, "EPSG:4326", mapping(geom))


class LandslidePredictor:
    def __init__(self, model_path: Optional[str] = None, card_path: Optional[str] = None, scene_dir: Optional[str] = None):
        self.model_path = model_path or os.getenv("ONNX_MODEL_PATH", "models/deeplabv3plus_r50_l4s_tilenorm.onnx")
        self.card_path = card_path or os.getenv("MODEL_CARD_PATH", "models/model_card.json")
        self.scene_dir = scene_dir or os.getenv("SCENE_DIR", "scenes")
        self.max_pixels = int(os.getenv("MAX_SCENE_PIXELS", "16000000"))  # ~4000x4000 px, about 3 GB of arrays
        self._slots = threading.BoundedSemaphore(int(os.getenv("MAX_CONCURRENT_SCENES", "1")))
        self._session = None
        self._sha = None

    @staticmethod
    def _expected_sha(card: Dict[str, Any]) -> Optional[str]:
        return (card.get("artifact") or {}).get("sha256") or card.get("sha256")

    def is_ready(self) -> bool:
        return os.path.isfile(self.model_path) and os.path.isfile(self.card_path)

    def _sha256(self) -> str:
        if self._sha is None:
            with open(self.model_path, "rb") as f:
                self._sha = hashlib.sha256(f.read()).hexdigest()
        return self._sha

    def model_info(self) -> Dict[str, Any]:
        info: Dict[str, Any] = {"ready": self.is_ready(), "note": NOTE}
        if not info["ready"]:
            info["detail"] = f"missing {self.model_path} or {self.card_path}"
            return info
        card, modes, floor = load_card(self.card_path)
        expected = self._expected_sha(card)
        info.update(name=card.get("name"), runtime="onnxruntime", std_floor_multiplier=floor, modes=modes,
                    default_mode="balanced", temporal_rule=CHANGE["rule"], schema_version=SCHEMA,
                    sha256_ok=(self._sha256() == expected), metrics=card.get("metrics"),
                    metrics_note="L4S official test and reviewed VN013/Lang Nu scenes; see model_card.json; not field validated")
        return info

    def predict_patch(self, bbox: List[float], **_ignored) -> Dict[str, Any]:
        """Legacy bbox call. A bbox carries no imagery, so there is nothing to infer: no polygon is invented."""
        return {"status": "no_imagery", "candidates": [], "bbox": bbox,
                "detail": "use POST /api/v1/inference/scene with post/pre GeoTIFFs", "note": NOTE}

    @staticmethod
    def _check_name(name: str) -> None:
        if os.path.basename(name) != name or not name.lower().endswith((".tif", ".tiff")):
            raise ValueError(f"invalid scene file name: {name!r}")

    def _resolve(self, name: str) -> str:
        self._check_name(name)
        path = os.path.join(self.scene_dir, name)
        if not os.path.isfile(path):
            raise FileNotFoundError(path)
        return path

    def predict_scene(self, ref_tif: str, post_tif: str, pre_tif: str, mode: str = "balanced",
                      meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """ref_tif: 8-band reference image (grid and slope in band 7). post_tif/pre_tif: Sentinel-2 composites
        (B2,B3,B4,B8,B11,B12,ndvi,n_obs) of the same season. Files are looked up inside SCENE_DIR only.
        Refuses to run if the ONNX sha256 differs from the model card, and answers Busy when all slots are in use."""
        if mode not in MODES:
            raise ValueError(f"mode must be one of {MODES}")
        for n in (ref_tif, post_tif, pre_tif):
            self._check_name(n)
        if not self.is_ready():
            raise RuntimeError("model files are not installed")
        card, modes, floor = load_card(self.card_path)
        if self._sha256() != self._expected_sha(card):
            raise RuntimeError("ONNX sha256 does not match model_card.json; refusing to run")
        if not self._slots.acquire(blocking=False):
            raise Busy("another scene is being processed; retry later")
        try:
            return self._run_scene(card, modes, floor, (ref_tif, post_tif, pre_tif), mode, meta or {})
        finally:
            self._slots.release()

    def _run_scene(self, card, modes, floor, names, mode, meta):
        import rasterio
        from rasterio import Affine
        from scipy import ndimage
        thr = float(modes[mode])
        sha = self._sha256()
        ref_p, post_p, pre_p = paths = [self._resolve(n) for n in names]
        for p in paths:
            with rasterio.open(p) as r:
                if r.width * r.height > self.max_pixels:
                    raise ValueError(f"scene too large: {r.width}x{r.height} px exceeds MAX_SCENE_PIXELS={self.max_pixels}")
        with rasterio.open(ref_p) as src:
            ot, crs = src.transform, src.crs
            ref = src.read().astype("float32")
        post, pre = read_aligned(post_p, ot), read_aligned(pre_p, ot)
        h, w = min(ref.shape[1], post.shape[1], pre.shape[1]), min(ref.shape[2], post.shape[2], pre.shape[2])
        ref, post, pre = ref[:, :h, :w], post[:, :h, :w], pre[:, :h, :w]
        slope = np.nan_to_num(ref[6], nan=float(np.nanmedian(ref[6])))
        img = np.stack([post[0], post[1], post[2], post[3], post[4], post[5], slope, post[6]])
        valid = np.isfinite(post[:7]).all(0) & (post[7] >= 1)
        if self._session is None:
            import onnxruntime as ort
            prov = [p for p in ort.get_available_providers() if p in ("CUDAExecutionProvider", "CPUExecutionProvider")]
            self._session = ort.InferenceSession(self.model_path, providers=prov)
        prob = predict_onnx(self._session, img, valid, floor)
        ok = valid & np.isfinite(prob)
        pred = ok & (prob > thr)
        lab, n = ndimage.label(pred, structure=np.ones((3, 3)))
        ids = np.arange(1, n + 1)
        size = ndimage.sum(pred, lab, ids) if n else np.array([])
        keep = ids[size >= MIN_PX] if n else np.array([], int)
        pre_ok = np.isfinite(pre[6])
        chg = (pre_ok & np.isfinite(post[6]) & ((post[6] - pre[6]) < CHANGE["dndvi"])
               & (post[6] < CHANGE["post_max"]) & (pre[6] > CHANGE["pre_min"]))
        objs = ndimage.find_objects(lab)
        feats = []
        for cid in keep:
            sl = objs[cid - 1]
            sub = lab[sl] == cid
            npx = int(sub.sum())
            frac = float(chg[sl][sub].mean())
            pvalid = float(pre_ok[sl][sub].mean())
            no = float(np.median(post[7][sl][sub]))
            status = ("not_assessable" if pvalid < CHANGE["min_pre_valid"]
                      else "change_detected" if frac >= CHANGE["min_fraction"] else "no_change")
            geom = _polygon(sub, ot * Affine.translation(sl[1].start, sl[0].start), crs)
            feats.append(dict(type="Feature", geometry=geom, properties=dict(
                id=int(cid), area_ha=round(npx / 100, 2), conf_mean=round(float(prob[sl][sub].mean()), 3),
                conf_max=round(float(prob[sl][sub].max()), 3), mode=mode, threshold=thr,
                preprocessing_std_floor=floor, model=card["name"], model_sha256=sha[:12],
                image_source=meta.get("image_source", ""), image_period=meta.get("image_period", ""),
                n_obs_median=round(no, 1), quality_flag="low_obs" if no < 3 else "ok",
                temporal_check=status, change_fraction=round(frac, 2), pre_valid_fraction=round(pvalid, 2),
                temporal_rule=CHANGE["rule"], review_status="ai_suggested", reviewed_by=None,
                review_note=None, severity=None, schema_version=SCHEMA)))
        cd = [f["properties"] for f in feats if f["properties"]["temporal_check"] == "change_detected"]
        return dict(
            type="FeatureCollection", features=feats,
            metadata=dict(schema_version=SCHEMA, model=card["name"], model_sha256=sha, mode=mode, threshold=thr,
                          std_floor=floor, note=NOTE,
                          warnings=season_warnings(meta.get("pre_period"), meta.get("post_period")), **meta),
            summary=dict(n_regions=len(feats), area_ha=round(sum(f["properties"]["area_ha"] for f in feats), 1),
                         n_change_detected=len(cd), area_change_detected_ha=round(sum(p["area_ha"] for p in cd), 1),
                         n_not_assessable=sum(f["properties"]["temporal_check"] == "not_assessable" for f in feats),
                         valid_fraction=round(float(ok.mean()), 3)))
