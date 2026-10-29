"""Tests that do not need the ONNX file. Run from services/ai-service: python -m unittest discover -s tests -t ."""
import os
import unittest

import numpy as np

from app.services import inference
from app.services.inference import LandslidePredictor, predict_onnx


class FakeSession:
    """Stands in for onnxruntime: constant logit 0 -> score 0.5 everywhere."""
    def get_inputs(self):
        return [type("I", (), {"name": "x"})()]

    def run(self, _out, feed):
        return [np.zeros((len(feed["x"]), 1, inference.TILE, inference.TILE), "float32")]


class InferenceTests(unittest.TestCase):
    def setUp(self):
        self.p = LandslidePredictor(model_path="missing.onnx", card_path="missing.json", scene_dir="scenes")

    def test_legacy_call_invents_nothing(self):
        r = self.p.predict_patch([104.0, 21.0, 104.1, 21.1], slope_avg=40, ndvi_drop=-0.6)
        self.assertEqual(r["status"], "no_imagery")
        self.assertEqual(r["candidates"], [])
        for k in ("geometry", "risk_level", "confidence_score", "metrics"):
            self.assertNotIn(k, r)

    def test_not_ready_without_model_files(self):
        self.assertFalse(self.p.is_ready())
        self.assertFalse(self.p.model_info()["ready"])
        with self.assertRaises(RuntimeError):
            self.p.predict_scene("a.tif", "b.tif", "c.tif")

    def test_scene_names_cannot_escape_scene_dir(self):
        for bad in ("../x.tif", "a/b.tif", r"..\x.tif", "x.txt", "/etc/passwd"):
            with self.assertRaises(ValueError):
                self.p._resolve(bad)

    def test_tiling_covers_whole_image(self):
        img = np.random.RandomState(0).rand(8, 200, 230).astype("float32")
        prob = predict_onnx(FakeSession(), img, np.ones((200, 230), bool), 2.0)
        self.assertEqual(prob.shape, (200, 230))
        self.assertTrue(np.allclose(prob, 0.5))

    def test_invalid_pixels_stay_nan(self):
        img = np.random.RandomState(1).rand(8, 128, 128).astype("float32")
        valid = np.ones((128, 128), bool)
        valid[:, 32:] = False  # 25% valid: the tile is skipped, so no pixel gets a score
        self.assertTrue(np.isnan(predict_onnx(FakeSession(), img, valid, 2.0)).all())

    @unittest.skipUnless(os.path.isfile("models/model_card.json"), "model_card.json not installed")
    def test_card_contract(self):
        card, modes, floor = inference.load_card("models/model_card.json")
        self.assertEqual(floor, 2.0)
        self.assertEqual(list(modes), list(inference.MODES))
        self.assertLess(modes["sensitive"], modes["balanced"])
        self.assertLess(modes["balanced"], modes["conservative"])


if __name__ == "__main__":
    unittest.main()
