# Expected dataset schema

One row = one (point, issue_time) sample. Save as Parquet (preferred) or CSV at the
path you set as `DATA_PATH` in the notebook.

| Column | Type | Meaning |
| --- | --- | --- |
| `sample_id` | str | Unique row id |
| `point_id` | str | Spatial unit id (pixel/polygon) |
| `lat`, `lon` | float | Centroid, for spatial-holdout checks |
| `issue_time` | datetime | The moment the forecast would have been made ("now") |
| `storm_id` | str | Groups samples from the same rainfall event/storm. **Required** — this is the grouping key for the leakage-safe split. Rows with no real storm association (pure negatives) can use a synthetic id derived from the rain event they were sampled alongside. |
| `label` | int (0/1) | Did a landslide occur in `[issue_time, issue_time+24h)` at/near this point? |
| `rain_lag_01` … `rain_lag_60` | float (mm) | Daily rainfall for day-1 … day-60 before `issue_time`, same source end-to-end. Missing days must be NaN, not 0. |
| `slope_deg` | float | From DEM |
| `aspect_deg` | float | From DEM |
| `elevation_m` | float | From DEM |
| `twi` | float | Topographic wetness index |
| `dist_to_stream_m` | float | From DEM-derived stream network |
| `soil_class` | str/int category | From SoilGrids / national soil map |
| `land_cover` | str/int category (optional) | If available |

Notes:
- Rainfall lag columns must be contiguous (`rain_lag_01..rain_lag_N`); the notebook
  infers `N` from the column names present and builds the LSTM input sequence from them.
- `soil_class` / `land_cover` are label-encoded by the notebook (fit on train only) and
  fed through an embedding layer — do not one-hot them yourself.
- Do not pre-scale anything; the notebook fits scalers on the training split only.
