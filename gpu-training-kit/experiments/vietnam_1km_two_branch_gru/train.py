"""Standalone GPU/CPU trainer for the 1-km Two-Branch 168h-GRU + MIL & 12-District Spatial model.

This experiment operates on our 1-km national grid (UTM48N_1km_*) using:
- Branch 1 (Temporal Trigger GRU): 168-hour hourly IMERG sequence (24 blocks x 7h) + 24-hour local-day
  GFS forecast, trained via Multiple-Instance Learning (MIL) max-pooling over 2,652 bags (2,104 multi-day
  bags covering 6,128 unit-days, 432 in-window non-event bags, and 116 single-day Tier A bags) without
  fabricating single-day labels for multi-day inventories.
- Branch 2 (Spatial Susceptibility): 1-km terrain/soil features trained on 7,060 cells across
  12 pre-validation districts (2017-08 to 2018-09).
- Combined hazard score: P_hazard(u, t) = P_temporal(u, t) * P_spatial(u).

NOTE: Uses explicit Footprint.shp proxy labels (mapped_presence=1, >1km background_proxy=0).
Does NOT claim verified NEXT24H ground-truth labels.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import rasterio
import torch
import torch.nn as nn

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from training_support import (
    binary_metrics,
    fit_l2_logistic,
    sample_id_for,
    sha,
    sigmoid,
    FIELDS, RAIN_COLUMNS,
    TemporalTriggerGRU,
    build_sequence_rain_tensor,
    build_summary_rain_matrix,
    set_seed,
)


def train_mil_temporal_gru_device(
    train_bags: list[dict],
    seq_mean: np.ndarray,
    seq_std: np.ndarray,
    sum_mean: np.ndarray,
    sum_std: np.ndarray,
    device: str = "cpu",
    epochs: int = 80,
    lr: float = 0.008,
    weight_decay: float = 1e-3,
    seed: int = 42,
) -> tuple[TemporalTriggerGRU, list[dict]]:
    set_seed(seed)
    if device == "cuda":
        torch.cuda.manual_seed_all(seed)
    model = TemporalTriggerGRU(step_dim=7, hidden_dim=24, summary_dim=5).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)

    all_seq, all_sum, bag_slices, bag_labels, bag_tiers = [], [], [], [], []
    cursor = 0
    for b in train_bags:
        n_inst = len(b["seq"])
        s_norm = (b["seq"] - seq_mean) / seq_std
        u_norm = (b["sum"] - sum_mean) / sum_std
        all_seq.append(s_norm)
        all_sum.append(u_norm)
        bag_slices.append((cursor, cursor + n_inst))
        bag_labels.append(float(b["label"]))
        bag_tiers.append(b["tier"])
        cursor += n_inst

    seq_t = torch.tensor(np.concatenate(all_seq, axis=0), dtype=torch.float32, device=device)
    sum_t = torch.tensor(np.concatenate(all_sum, axis=0), dtype=torch.float32, device=device)
    y_bag = torch.tensor(bag_labels, dtype=torch.float32, device=device)

    n_pos = max(float((y_bag == 1).sum().item()), 1.0)
    n_neg = max(float((y_bag == 0).sum().item()), 1.0)
    n_tot = n_pos + n_neg
    tier_mult = torch.tensor(
        [0.75 if t == "TIER_B_MULTIDAY_BAG" else 1.0 for t in bag_tiers],
        dtype=torch.float32,
        device=device,
    )
    class_w = torch.where(y_bag == 1, n_tot / (2.0 * n_pos), n_tot / (2.0 * n_neg)) * tier_mult

    history = []
    for epoch in range(1, epochs + 1):
        model.train()
        optimizer.zero_grad()
        inst_logits = model(seq_t, sum_t)
        bag_logits = torch.stack([inst_logits[s:e].max() for s, e in bag_slices])
        losses = nn.functional.binary_cross_entropy_with_logits(bag_logits, y_bag, reduction="none")
        loss = (losses * class_w).mean()
        loss.backward()
        optimizer.step()
        if epoch in (1, 20, 40, 60, epochs):
            with torch.no_grad():
                probs = torch.sigmoid(bag_logits).detach().cpu().numpy()
                m = binary_metrics(y_bag.detach().cpu().numpy().astype(int), probs, 0.50)
                history.append({
                    "epoch": epoch,
                    "mil_bag_loss": round(float(loss.item()), 4),
                    "train_bag_roc_auc": m["roc_auc"],
                    "train_bag_f1_at_050": m["f1"],
                })
                print(json.dumps(history[-1]), flush=True)
    model.eval()
    return model, history


@torch.no_grad()
def predict_temporal_gru_device(
    model: TemporalTriggerGRU,
    df: pd.DataFrame,
    seq_mean: np.ndarray,
    seq_std: np.ndarray,
    sum_mean: np.ndarray,
    sum_std: np.ndarray,
    device: str = "cpu",
) -> np.ndarray:
    model.eval()
    seq_raw = build_sequence_rain_tensor(df)
    sum_raw = build_summary_rain_matrix(df)
    seq_t = torch.tensor((seq_raw - seq_mean) / seq_std, dtype=torch.float32, device=device)
    sum_t = torch.tensor((sum_raw - sum_mean) / sum_std, dtype=torch.float32, device=device)
    logits = model(seq_t, sum_t)
    return torch.sigmoid(logits).detach().cpu().numpy()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    here = Path(__file__).resolve().parent
    parser.add_argument("--out", type=Path, default=here / "outputs_with_elevation")
    parser.add_argument("--device", choices=["auto", "cpu", "cuda"], default="auto")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    device = "cuda" if args.device == "auto" and torch.cuda.is_available() else args.device
    device = "cpu" if device == "auto" else device
    if device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA requested but unavailable; install a CUDA-enabled PyTorch build.")

    args.out.mkdir(parents=True, exist_ok=True)

    paths = {
        "spatiotemporal_4day": ROOT / "data/processed/footprint_two_branch_experiment/footprint_spatiotemporal_proxy_2693.csv",
        "spatial_12dist": ROOT / "data/processed/two_branch_gru_option_b/spatial_train_12districts_7052.csv",
        "candidate_ctx_gfs": ROOT / "data/processed/next24h_local_day_gfs_context/candidate_context_with_gfs.csv",
        "parent_relations": ROOT / "data/processed/next24h_local_day_candidates/parent_window_relations.csv",
        "window_links": ROOT / "data/processed/grid_rain_research/window_source_relations.csv",
    }
    input_hashes = {p.relative_to(ROOT).as_posix(): sha(p) for p in paths.values()}

    spatial_train_12dist = pd.read_csv(paths["spatial_12dist"], keep_default_na=False)
    for f in dict.fromkeys(FIELDS + ["elevation_m"]):
        spatial_train_12dist[f] = pd.to_numeric(spatial_train_12dist[f"{f}_mean"], errors="coerce")
    if not np.isfinite(spatial_train_12dist["elevation_m"]).all():
        raise ValueError("Spatial training requires finite elevation_m; do not impute missing DEM")
    spatial_train_12dist["spatial_proxy_label"] = spatial_train_12dist["spatial_proxy_label"].astype(int)

    ctx_df = pd.read_csv(paths["candidate_ctx_gfs"], keep_default_na=False, low_memory=False)
    ctx_complete = ctx_df[ctx_df["all_research_context_coverage_complete"].astype(str) == "True"].copy()
    for c in RAIN_COLUMNS + ["forecast_24h_mm"]:
        ctx_complete[c] = pd.to_numeric(ctx_complete[c], errors="coerce")
    parents_df = pd.read_csv(paths["parent_relations"], keep_default_na=False)
    links_df = pd.read_csv(paths["window_links"], keep_default_na=False)

    win_meta = (
        parents_df.merge(
            links_df[["window_id", "source_kind"]].drop_duplicates(),
            left_on="parent_research_window_id",
            right_on="window_id",
        )
        .merge(ctx_complete, on="sample_id")
    )
    multiday_pos = win_meta[
        (win_meta["source_kind"] == "point_coordinate_only")
        & (win_meta["parent_association_date_start"] < win_meta["parent_association_date_end_inclusive"])
        & (win_meta["parent_association_date_end_inclusive"] <= "2018-09-01")
    ].copy()

    multiday_bags = []
    for wid, grp in multiday_pos.groupby("parent_research_window_id"):
        grp_sorted = grp.drop_duplicates("target_local_date").sort_values("target_local_date")
        start_d = grp_sorted["parent_association_date_start"].iloc[0]
        end_d = grp_sorted["parent_association_date_end_inclusive"].iloc[0]
        expected_days = (pd.Timestamp(end_d) - pd.Timestamp(start_d)).days + 1
        if len(grp_sorted) != expected_days:
            continue
        multiday_bags.append({
            "bag_id": f"mil_pos_{wid}",
            "unit_id": grp_sorted["unit_id"].iloc[0],
            "start_date": start_d,
            "end_date": end_d,
            "num_days": expected_days,
            "label": 1,
            "tier": "TIER_B_MULTIDAY_BAG",
            "seq": build_sequence_rain_tensor(grp_sorted),
            "sum": build_summary_rain_matrix(grp_sorted),
        })

    neg_cache_path = here / 'outputs/tier_b_in_window_negatives_432.csv'
    input_hashes[neg_cache_path.relative_to(ROOT).as_posix()] = sha(neg_cache_path)
    multiday_non_ev_extracted = pd.read_csv(neg_cache_path, keep_default_na=False)
    if len(multiday_non_ev_extracted) != 432:
        raise ValueError('Expected the original 432 cached research negatives')
    for c in RAIN_COLUMNS + ['forecast_24h_mm']:
        multiday_non_ev_extracted[c] = pd.to_numeric(multiday_non_ev_extracted[c], errors='raise')

    df_4day = pd.read_csv(paths["spatiotemporal_4day"], keep_default_na=False, low_memory=False)
    df_4day["proxy_binary_label"] = df_4day["proxy_binary_label"].astype(int)
    df_4day["is_storm_day_window"] = df_4day["is_storm_day_window"].astype(int)
    for f in list(dict.fromkeys(FIELDS + ["elevation_m", "forecast_24h_mm"] + RAIN_COLUMNS)):
        df_4day[f] = pd.to_numeric(df_4day[f], errors="coerce")
    if not np.isfinite(df_4day["elevation_m"]).all():
        raise ValueError("Evaluation cohort requires finite elevation_m; do not impute missing DEM")

    parts_4day = {
        "train": df_4day[df_4day["split_chronological"] == "train"].copy(),
        "val": df_4day[df_4day["split_chronological"] == "val"].copy(),
        "test": df_4day[df_4day["split_chronological"] == "test"].copy(),
    }

    tier_a_train_bags = []
    for idx, row in parts_4day["train"].iterrows():
        row_df = parts_4day["train"].loc[[idx]]
        tier_a_train_bags.append({
            "bag_id": f"tier_a_{row['sample_id']}",
            "unit_id": row["unit_id"],
            "start_date": row["target_local_date"],
            "end_date": row["target_local_date"],
            "num_days": 1,
            "label": int(row["is_storm_day_window"]),
            "tier": "TIER_A_SINGLE_DAY",
            "seq": build_sequence_rain_tensor(row_df),
            "sum": build_summary_rain_matrix(row_df),
        })

    tier_b_neg_bags = []
    for idx, row in multiday_non_ev_extracted.iterrows():
        row_df = multiday_non_ev_extracted.loc[[idx]]
        tier_b_neg_bags.append({
            "bag_id": f"tier_b_neg_{row['sample_id']}",
            "unit_id": row["unit_id"],
            "start_date": row["target_local_date"],
            "end_date": row["target_local_date"],
            "num_days": 1,
            "label": 0,
            "tier": "TIER_B_IN_WINDOW_NON_EVENT",
            "seq": build_sequence_rain_tensor(row_df),
            "sum": build_summary_rain_matrix(row_df),
        })

    combined_bags_b = tier_a_train_bags + multiday_bags + tier_b_neg_bags
    seq_tr_b = np.concatenate([b["seq"] for b in combined_bags_b], axis=0)
    sum_tr_b = np.concatenate([b["sum"] for b in combined_bags_b], axis=0)
    seq_mean_b = seq_tr_b.mean(axis=(0, 1), keepdims=True)
    seq_std_b = np.maximum(seq_tr_b.std(axis=(0, 1), keepdims=True), 1e-6)
    sum_mean_b = sum_tr_b.mean(axis=0, keepdims=True)
    sum_std_b = np.maximum(sum_tr_b.std(axis=0, keepdims=True), 1e-6)

    print(f"Training TemporalTriggerGRU on {len(combined_bags_b)} MIL bags on device={device}...", flush=True)
    gru_b, hist_b = train_mil_temporal_gru_device(
        combined_bags_b,
        seq_mean_b,
        seq_std_b,
        sum_mean_b,
        sum_std_b,
        device=device,
        epochs=args.epochs,
        seed=args.seed,
    )

    p_temp_all = predict_temporal_gru_device(
        gru_b, df_4day, seq_mean_b, seq_std_b, sum_mean_b, sum_std_b, device=device
    )

    soil_cols = ["slope_deg", "elevation_m", "clay_pct", "sand_pct", "bulk_density_g_cm3"]
    slope_cols = ["slope_deg"]

    def fit_spatial(feat_cols: list[str]) -> tuple[np.ndarray, dict]:
        X_raw = spatial_train_12dist[feat_cols].to_numpy(dtype=np.float64)
        mu = X_raw.mean(axis=0)
        sd = np.where(X_raw.std(axis=0) > 1e-8, X_raw.std(axis=0), 1.0)
        w, b = fit_l2_logistic(
            (X_raw - mu) / sd,
            spatial_train_12dist["spatial_proxy_label"].to_numpy(dtype=np.int64),
            l2=1.0,
        )
        p_eval = sigmoid(((df_4day[feat_cols].to_numpy(dtype=np.float64) - mu) / sd) @ w + b)
        return p_eval, {
            "train_rows": len(spatial_train_12dist),
            "features": feat_cols,
            "mean": mu.tolist(),
            "std": sd.tolist(),
            "weights": {c: round(float(v), 4) for c, v in zip(feat_cols, w)},
            "bias": round(float(b), 4),
        }

    p_spat_soil, info_soil = fit_spatial(soil_cols)
    p_spat_slope, info_slope = fit_spatial(slope_cols)

    p_hazard_soil = p_temp_all * p_spat_soil
    p_hazard_slope = p_temp_all * p_spat_slope

    val_mask = (df_4day["split_chronological"] == "val").to_numpy()
    test_mask = (df_4day["split_chronological"] == "test").to_numpy()
    test_storm_mask = test_mask & (df_4day["sample_role"] != "TEMPORAL_NON_EVENT_BACKGROUND_PROXY").to_numpy()
    test_nonevent_mask = test_mask & (df_4day["sample_role"] == "TEMPORAL_NON_EVENT_BACKGROUND_PROXY").to_numpy()

    y_all = df_4day["proxy_binary_label"].to_numpy(dtype=int)

    best_th, best_f1 = 0.50, -1.0
    for th in np.linspace(0.10, 0.90, 81):
        m = binary_metrics(y_all[val_mask], p_hazard_soil[val_mask], float(th))
        if m["f1"] > best_f1:
            best_f1 = m["f1"]
            best_th = float(th)
    best_th = round(best_th, 2)

    thresholds = {
        "sensitive_val_f1_threshold": best_th,
        "balanced_standard_threshold": 0.50,
        "conservative_high_precision_threshold": 0.65,
    }

    rain_arr_4day = df_4day[RAIN_COLUMNS].to_numpy(dtype=np.float64)
    df_out = df_4day[[
        "sample_id", "unit_id", "district", "target_local_date",
        "sample_role", "proxy_binary_label", "verified_next24h_label",
        "split_chronological", "forecast_24h_mm",
        "slope_deg", "elevation_m", "clay_pct", "sand_pct", "bulk_density_g_cm3",
    ]].copy()
    df_out["rain_past_24h_mm"] = np.round(rain_arr_4day[:, -24:].sum(axis=1), 3)
    df_out["rain_past_168h_mm"] = np.round(rain_arr_4day.sum(axis=1), 3)
    df_out["p_temporal_gru"] = np.round(p_temp_all, 6)
    df_out["p_spatial_12dist_slope_soil"] = np.round(p_spat_soil, 6)
    df_out["p_hazard_slope_soil"] = np.round(p_hazard_soil, 6)
    df_out["p_spatial_12dist_slope_only"] = np.round(p_spat_slope, 6)
    df_out["p_hazard_slope_only"] = np.round(p_hazard_slope, 6)
    for mode_name, th_val in thresholds.items():
        df_out[f"pred_{mode_name}"] = (p_hazard_soil >= th_val).astype(int)

    val_path = args.out / "validation_predictions_56.csv"
    test_path = args.out / "test_predictions_2521.csv"
    df_out[val_mask].to_csv(val_path, index=False, encoding="utf-8-sig")
    df_out[test_mask].to_csv(test_path, index=False, encoding="utf-8-sig")

    ckpt_path = args.out / "two_branch_gru_1km.pt"
    torch.save(
        {
            "temporal_gru_state_dict": {k: v.cpu() for k, v in gru_b.state_dict().items()},
            "seq_norm_b": {"mean": seq_mean_b.tolist(), "std": seq_std_b.tolist()},
            "sum_norm_b": {"mean": sum_mean_b.tolist(), "std": sum_std_b.tolist()},
            "spatial_12dist_slope_soil": info_soil,
            "spatial_12dist_slope_only": info_slope,
            "operating_thresholds": thresholds,
            "verified_next24h_training_ready": False,
        },
        ckpt_path,
    )

    loaded = torch.load(ckpt_path, map_location=device, weights_only=True)
    gru_b.load_state_dict(loaded["temporal_gru_state_dict"])
    assert np.allclose(
        predict_temporal_gru_device(gru_b, df_4day, seq_mean_b, seq_std_b, sum_mean_b, sum_std_b, device=device),
        p_temp_all,
    ), "Checkpoint round-trip mismatch"

    metrics = {
        "experiment_id": "VIETNAM_1KM_TWO_BRANCH_GRU_MIL_OPTION_B",
        "device": device,
        "torch_version": torch.__version__,
        "epochs": args.epochs,
        "seed": args.seed,
        "training_bags_total": len(combined_bags_b),
        "spatial_training_cells_12districts": len(spatial_train_12dist),
        "single_day_labels_fabricated_from_multiday": 0,
        "verified_next24h_forecast_evaluation": False,
        "operating_thresholds": thresholds,
        "slope_plus_soil_model": {
            "validation_at_sensitive": binary_metrics(
                y_all[val_mask], p_hazard_soil[val_mask], thresholds["sensitive_val_f1_threshold"]
            ),
            "validation_at_balanced_050": binary_metrics(
                y_all[val_mask], p_hazard_soil[val_mask], thresholds["balanced_standard_threshold"]
            ),
            "test_overall_at_sensitive": binary_metrics(
                y_all[test_mask], p_hazard_soil[test_mask], thresholds["sensitive_val_f1_threshold"]
            ),
            "test_overall_at_balanced_050": binary_metrics(
                y_all[test_mask], p_hazard_soil[test_mask], thresholds["balanced_standard_threshold"]
            ),
            "test_overall_at_conservative_065": binary_metrics(
                y_all[test_mask], p_hazard_soil[test_mask], thresholds["conservative_high_precision_threshold"]
            ),
            "test_storm_day_at_balanced_050": binary_metrics(
                y_all[test_storm_mask], p_hazard_soil[test_storm_mask], thresholds["balanced_standard_threshold"]
            ),
            "test_non_event_false_alarm_rate_at_050": round(
                float(np.mean(p_hazard_soil[test_nonevent_mask] >= 0.50)), 4
            ),
        },
        "slope_only_model": {
            "validation_at_010": binary_metrics(y_all[val_mask], p_hazard_slope[val_mask], 0.10),
            "test_overall_at_010": binary_metrics(y_all[test_mask], p_hazard_slope[test_mask], 0.10),
            "test_storm_day_at_010": binary_metrics(y_all[test_storm_mask], p_hazard_slope[test_storm_mask], 0.10),
        },
        "output_sha256": {
            "two_branch_gru_1km.pt": sha(ckpt_path),
            "validation_predictions_56.csv": sha(val_path),
            "test_predictions_2521.csv": sha(test_path),
        },
    }
    (args.out / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    (args.out / "history.json").write_text(json.dumps(hist_b, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2), flush=True)


if __name__ == "__main__":
    main()
