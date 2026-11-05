"""Load both branches from the published research checkpoint; no training imports.

Input: CSV with rain_h001..rain_h168 (oldest first), forecast_24h_mm,
slope_deg, clay_pct, sand_pct, bulk_density_g_cm3.
Output: uncalibrated research scores, not certified forecast probabilities.
"""
import argparse
import csv
from pathlib import Path

import numpy as np
import torch
from torch import nn

RAIN = [f'rain_h{i:03d}' for i in range(1, 169)]


class TemporalTriggerGRU(nn.Module):
    def __init__(self):
        super().__init__()
        self.gru = nn.GRU(input_size=7, hidden_size=24, num_layers=1, batch_first=True)
        self.head = nn.Sequential(nn.Linear(29, 16), nn.ReLU(), nn.Linear(16, 1))

    def forward(self, sequence, summary):
        _, hidden = self.gru(sequence)
        return self.head(torch.cat([hidden[-1], summary], dim=-1)).squeeze(-1)


def predict(rows, checkpoint, device='cpu'):
    if not rows:
        raise ValueError('Input CSV is empty')
    saved = torch.load(checkpoint, map_location='cpu', weights_only=True)
    spatial = saved['spatial_12dist_slope_soil']
    features = spatial['features']
    required = RAIN + ['forecast_24h_mm'] + features
    missing = sorted(set(required) - set(rows[0]))
    if missing:
        raise ValueError(f'Missing columns: {missing}')
    matrix = np.asarray([[float(row[c]) for c in required] for row in rows], dtype=np.float64)
    if not np.isfinite(matrix).all():
        raise ValueError('Input contains missing/nonfinite values; do not silently fill them')
    rain, gfs, static = matrix[:, :168], matrix[:, 168], matrix[:, 169:]
    if (rain < 0).any() or (gfs < 0).any():
        raise ValueError('Rainfall values must be nonnegative millimetres')
    sequence = np.log1p(rain).reshape(-1, 24, 7)
    summary = np.log1p(np.column_stack([
        rain[:, -24:].sum(1), rain[:, -72:].sum(1), rain.sum(1), rain.max(1), gfs]))
    sn, un = saved['seq_norm_b'], saved['sum_norm_b']
    sequence = (sequence - np.asarray(sn['mean'])) / np.asarray(sn['std'])
    summary = (summary - np.asarray(un['mean'])) / np.asarray(un['std'])
    model = TemporalTriggerGRU().to(device).eval()
    model.load_state_dict(saved['temporal_gru_state_dict'], strict=True)
    with torch.inference_mode():
        temporal = torch.sigmoid(model(
            torch.as_tensor(sequence, dtype=torch.float32, device=device),
            torch.as_tensor(summary, dtype=torch.float32, device=device))).cpu().numpy()
    weights = np.asarray([spatial['weights'][c] for c in features])
    z = ((static - np.asarray(spatial['mean'])) / np.asarray(spatial['std'])) @ weights + spatial['bias']
    spatial_score = 1.0 / (1.0 + np.exp(-np.clip(z, -500, 500)))
    return temporal, spatial_score, temporal * spatial_score


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--checkpoint', type=Path,
                        default=Path(__file__).resolve().parent / 'outputs/two_branch_gru_1km.pt')
    parser.add_argument('--device', choices=['cpu', 'cuda'], default='cpu')
    args = parser.parse_args()
    with args.input.open(encoding='utf-8-sig', newline='') as handle:
        rows = list(csv.DictReader(handle))
    temporal, spatial, score = predict(rows, args.checkpoint, args.device)
    names = ['unit_id', 'target_local_date', 'temporal_score', 'spatial_score',
             'hazard_score', 'experimental_flag_at_050', 'verified_operational_forecast']
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('w', encoding='utf-8-sig', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=names)
        writer.writeheader()
        for row, t, s, h in zip(rows, temporal, spatial, score):
            writer.writerow(dict(unit_id=row.get('unit_id', ''),
                target_local_date=row.get('target_local_date', ''),
                temporal_score=float(t), spatial_score=float(s), hazard_score=float(h),
                experimental_flag_at_050=int(h >= .5), verified_operational_forecast=False))
    print(f'Wrote {len(rows)} research scores to {args.output}')


if __name__ == '__main__':
    main()
