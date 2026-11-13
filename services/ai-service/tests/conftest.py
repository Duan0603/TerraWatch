"""Shared fixtures for the new tests. No real Redis, network, or ONNX model is used."""
import json

import numpy as np
import pytest

from app.services.inference import LandslidePredictor

CARD = {"name": "fake_model", "version": "vT", "status": "test", "modes": {"sensitive": 0.3, "balanced": 0.5, "conservative": 0.7},
        "input": {"channels": list("abcdefgh"), "preprocessing": {"std_floor_multiplier": 2.0}},
        "artifact": {"trained_on": "synthetic", "sha256": ""}, "metrics": {"f1": 0.5}}


class FakeSession:
    """Stands in for onnxruntime. logit_fn(n_tiles) -> (n,128,128) logits; records every batch fed in."""
    def __init__(self, logit_fn=None, exc=None):
        self.logit_fn, self.exc, self.feeds = logit_fn, exc, []

    def get_inputs(self):
        return [type("I", (), {"name": "x"})()]

    def run(self, _out, feed):
        if self.exc:
            raise self.exc
        x = feed["x"]
        self.feeds.append(x)
        lg = self.logit_fn(len(x)) if self.logit_fn else np.zeros((len(x), 128, 128))
        return [np.asarray(lg, "float32").reshape(len(x), 1, 128, 128)]


def write_tif(path, arr, x0=500000.0, y0=2000000.0):
    import rasterio
    from rasterio.transform import from_origin
    arr = np.asarray(arr, "float32")
    with rasterio.open(path, "w", driver="GTiff", height=arr.shape[1], width=arr.shape[2], count=arr.shape[0],
                       dtype="float32", crs="EPSG:32648", transform=from_origin(x0, y0, 10, 10)) as d:
        d.write(arr)


@pytest.fixture
def scene_env(tmp_path):
    """Ready predictor (tmp model+card files, fake session) and a scene dir with valid 128x128 tifs."""
    sd = tmp_path / "scenes"
    sd.mkdir()
    model = tmp_path / "m.onnx"
    model.write_bytes(b"fake-onnx-bytes")
    import hashlib
    card = json.loads(json.dumps(CARD))
    card["artifact"]["sha256"] = hashlib.sha256(model.read_bytes()).hexdigest()
    cardp = tmp_path / "card.json"
    cardp.write_text(json.dumps(card))
    ref = np.zeros((8, 128, 128), "float32")
    ref[6] = 0.3 + np.random.RandomState(9).rand(128, 128) * 0.01  # non-constant: constant channels give 0/0 in tile norm
    post = np.random.RandomState(0).rand(8, 128, 128).astype("float32")
    post[6] = 0.2
    post[7] = 5 + (np.random.RandomState(10).rand(128, 128) > 0.9)  # median stays 5
    pre = post.copy()
    pre[6] = 0.6
    write_tif(sd / "ref.tif", ref)
    write_tif(sd / "post.tif", post)
    write_tif(sd / "pre.tif", pre)
    p = LandslidePredictor(str(model), str(cardp), str(sd))
    p._session = FakeSession(lambda n: np.full((n, 128, 128), 10.0))
    p.tmp, p.ref, p.post, p.pre, p.card = tmp_path, ref, post, pre, card
    return p
