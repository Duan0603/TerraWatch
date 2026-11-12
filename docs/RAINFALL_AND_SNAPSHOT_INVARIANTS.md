# TerraWatch Rainfall Normalization & Feature Snapshot Invariants

## 1. Overview

The GIS ingestion layer (`services/gis-service/app/pipeline/`) enforces strict temporal and data-quality invariants before passing meteorological and geomorphic features to downstream AI inference (`ai-service`) and Core orchestration (`core-api`).

---

## 2. Rainfall Accumulation & Quality Rules (`RainfallProcessor`)

Hourly rainfall time series are split relative to prediction issue time $t = \text{as\_of}$ (UTC):

| Metric Key | Window | Coverage Rule | Missing-Data Rule |
| :--- | :--- | :--- | :--- |
| `rain_1h_mm` | $(t - 1\text{h}, t]$ | No `None` gaps | Must stay `None` (never `0.0`) |
| `rain_24h_acc_mm` | $(t - 24\text{h}, t]$ | Required for `"good"` status | Must stay `None` |
| `rain_72h_acc_mm` | $(t - 72\text{h}, t]$ | Antecedent saturation | Must stay `None` |
| `rain_7d_acc_mm` | $(t - 7\text{d}, t]$ | Deep groundwater signal | Must stay `None` |
| `forecast_next_24h_mm` | $(t, t + 24\text{h}]$ | Minimum `20` non-null hours | Must stay `None` |

---

## 3. Immutable Snapshot Temporal Invariants (`SnapshotProcessor`)

Schema version: **`rainfall-terrain-24h.v1`**.

1. **Anti-Lookahead Enforcement:**
   - Every rainfall observation included in window sums must satisfy both `available_at <= as_of_time` and `interval_end <= as_of_time`.
   - Weather forecast payloads must satisfy `available_at <= as_of_time` (falling back to `issued_at`).
2. **Minimum Observation Counts in Snapshots:**
   - 1h window: `min_count = 1`
   - 24h window: `min_count = 20`
   - 72h window: `min_count = 60`
   - 7d window: `min_count = 140`
3. **Degradation Hierarchy (`coverage_quality`):**
   - `good`: `rain_24h_acc_mm` valid, `forecast_next_24h_mm` valid, and `slope_avg` present.
   - `stale`: Only partial meteorological coverage (`ok_24h` or `ok_forecast`), or missing DEM terrain slope.
   - `missing`: Neither 24h observation window nor 24h forecast meets minimum validity thresholds.

---

## 4. Automated Test Commands

```bash
# Edge-case rainfall & snapshot invariant suites (no DB required)
python -m unittest services/gis-service/tests/test_rainfall_edge_cases.py
python -m unittest services/gis-service/tests/test_snapshot_invariants.py
python -m unittest services/gis-service/tests/test_terrain_benchmarks.py
```
