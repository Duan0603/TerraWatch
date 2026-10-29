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


class GuardTests(unittest.TestCase):
    """Fake model files in a temp dir: checks the guards that run before any raster is read."""

    def setUp(self):
        import hashlib, json, tempfile
        self.d = tempfile.TemporaryDirectory()
        self.addCleanup(self.d.cleanup)
        onnx, card = os.path.join(self.d.name, "m.onnx"), os.path.join(self.d.name, "card.json")
        open(onnx, "wb").write(b"not a real model")
        self.sha = hashlib.sha256(b"not a real model").hexdigest()
        self.card = dict(name="t", modes={"sensitive": 0.5, "balanced": 0.7, "conservative": 0.9},
                         input={"preprocessing": {"std_floor_multiplier": 2.0}}, artifact={"sha256": self.sha})
        json.dump(self.card, open(card, "w"))
        self.p = LandslidePredictor(onnx, card, self.d.name)

    def test_sha_mismatch_refuses_to_run(self):
        import json
        self.card["artifact"]["sha256"] = "0" * 64
        json.dump(self.card, open(self.p.card_path, "w"))
        with self.assertRaisesRegex(RuntimeError, "sha256"):
            self.p.predict_scene("a.tif", "b.tif", "c.tif")

    def test_busy_when_all_slots_taken(self):
        self.assertTrue(self.p._slots.acquire(blocking=False))  # the only slot (MAX_CONCURRENT_SCENES=1)
        with self.assertRaises(inference.Busy):
            self.p.predict_scene("a.tif", "b.tif", "c.tif")

    def test_slot_is_released_after_a_failed_run(self):
        for _ in range(2):  # files do not exist: fails inside the run, the slot must still be freed
            with self.assertRaises((FileNotFoundError, ImportError)):
                self.p.predict_scene("a.tif", "b.tif", "c.tif")


class SeasonTests(unittest.TestCase):
    def test_vn013_periods_are_accepted(self):
        self.assertEqual(inference.season_warnings("2024-07-15/2024-09-07", "2024-09-11/2024-10-31"), [])

    def test_same_dates_previous_year_are_accepted(self):
        self.assertEqual(inference.season_warnings("2023-09-11/2023-10-31", "2024-09-11/2024-10-31"), [])

    def test_opposite_season_warns(self):
        w = inference.season_warnings("2024-02-01/2024-03-01", "2024-09-11/2024-10-31")
        self.assertTrue(any("seasonal cycle" in x for x in w))

    def test_pre_after_post_warns(self):
        w = inference.season_warnings("2024-10-01/2024-11-01", "2024-09-11/2024-09-30")
        self.assertTrue(any("must end before" in x for x in w))

    def test_missing_or_bad_periods_say_unverified(self):
        for args in (("", ""), ("2024-07-15", "2024-09-11/2024-10-31")):
            self.assertTrue(any("not verified" in x for x in inference.season_warnings(*args)))


if __name__ == "__main__":
    unittest.main()
