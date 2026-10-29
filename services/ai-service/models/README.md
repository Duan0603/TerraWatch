# Model files (not committed)

Copy from `TerraWatch_AI/models/l4s_tilenorm_v1/` (Drive):

- `deeplabv3plus_r50_l4s_tilenorm.onnx` (106.7 MB, sha256 starts with `cbd88fb40d63`)
- `model_card.json` (rename is not needed; set `MODEL_CARD_PATH` if you keep another name)

`GET /api/v1/models/info` returns `ready: true` and `sha256_ok: true` once both files are here.
Scene GeoTIFFs go in `scenes/` (or `SCENE_DIR`). Model v1.0 is frozen: thresholds and the std floor come from
the card, do not edit them here; a change needs a new version and re-measurement.
