# Rainfall–Terrain Landslide Forecast — Training (Colab)

Trains the deep-learning forecaster described in `docs/AI_MODEL_CARD.md` section 4
("Training and evaluation plan"). This directory does **not** replace that model card —
it implements it. Any claim about accuracy belongs in the model card's section 5 table,
filled in from a real run's output, never written by hand.

## Files

- `landslide_forecast_colab.ipynb` — the training notebook. Upload to Google Colab,
  set a GPU runtime (Runtime → Change runtime type → T4 GPU or better), run top to bottom.
- `dataset_schema.md` — exact columns the notebook expects in your dataset file.

## Before you run this for real

The notebook refuses to produce a "final" result on synthetic data — it only uses the
synthetic generator so you can confirm the pipeline (shapes, no crashes, training loop
converges on noise) before you have real data. You need, at minimum:

1. **Labels**: a landslide inventory with occurrence time + location (see prior
   conversation: Viện Khoa học Địa chất và Khoáng sản inventories, or digitized
   news/PCTT reports). Reporting date ≠ occurrence date — the model card requires you
   to track this distinction.
2. **Rainfall history per label point**: a daily (or finer) rainfall series for e.g. the
   60 days before each event, from the *same source* you'll use operationally (GPM
   IMERG / CHIRPS / ERA5-Land), plus matching series for negative (non-event) points.
3. **Static terrain/soil features per point**: slope, aspect, elevation, TWI,
   distance-to-stream, soil/geology class — extracted once (e.g. via Google Earth
   Engine) at the same resolution you intend to operate at.
4. **A grouping key** (`storm_id` or `event_cluster_id`) and a timestamp per sample —
   both are mandatory for the leakage-safe split the notebook performs. Without them,
   any accuracy number you report is not trustworthy (correlated/overlapping windows
   leaking between train and test is the single most common way these models look good
   in a thesis defense and fail in production).

## What "optimized for Colab" means here

- Mixed precision (`torch.cuda.amp`) — ~2x faster on a T4 for this model size, no
  accuracy cost for this architecture.
- Checkpointing to Drive every improvement, so a disconnected Colab runtime doesn't
  lose the trained model.
- Early stopping on validation PR-AUC (not loss) — PR-AUC is what matters for a
  rare-event problem like landslide occurrence; loss can improve while PR-AUC stalls.
- A gradient-boosted-tree baseline (XGBoost) trained on the *same split* — the model
  card requires comparing against an interpretable baseline before trusting the deep
  model's extra complexity.

## What "credible" means here (do not skip these when you write the thesis)

- **Group + temporal split**: test = events after a cutoff date; train/val = earlier
  events split by `storm_id` (never by row), so no storm's rainfall ever appears in
  both train and test.
- **Threshold frozen on validation only** — chosen once under a stated minimum-recall
  constraint, then evaluated exactly once on the untouched test set. Re-running test
  evaluation to "see how a different threshold does" and keeping the best one is
  leakage via the back door; the notebook structures the code so that's awkward to do
  by accident.
- **Calibration** (Platt scaling) reported with a reliability diagram, not just AUC —
  a model whose "0.9 probability" doesn't mean 90% empirical frequency is not reporting
  calibrated risk, which matters if the output is shown to officers as a probability.
- **Report sample AND event counts**, and state explicitly that window-level metrics
  are not the same as event-level metrics (the model card requires this distinction).
