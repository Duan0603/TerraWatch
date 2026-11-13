"""Offline sensitivity audit; synthetic rain, fixed terrain, no API writes or training.

Run: python scripts/audit-live-gru.py > docs/live-gru-sensitivity.csv
Forecast is varied independently as well as with past rain. No monotonicity is assumed.
"""
import csv
import argparse
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'services/ai-service'))
from app.services.live_gru import LiveGRU


def cases():
    for pattern in ('uniform_7d', 'last_24h', 'last_6h'):
        for daily in (0, 10, 30, 60, 100, 150):
            history = np.zeros(168)
            hours = {'uniform_7d': 168, 'last_24h': 24, 'last_6h': 6}[pattern]
            history[-hours:] = daily / (24 if hours == 168 else hours)
            for forecast in sorted({0, 30, daily}):
                yield pattern, daily, history, forecast


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pytorch', action='store_true', help='Compare original checkpoint (requires training environment)')
    parser.add_argument('--checkpoint', type=Path, help='Override checkpoint for numerical parity')
    args = parser.parse_args()
    model = LiveGRU()
    static = dict(zip(model.card['spatial_12dist_slope_soil']['features'],
                      model.card['spatial_12dist_slope_soil']['mean']))
    writer = csv.writer(sys.stdout, lineterminator='\n')
    writer.writerow(['pattern', 'past_24h_mm', 'past_168h_mm', 'forecast_24h_mm',
                     'temporal_score', 'spatial_score', 'hazard_score'])
    inputs = list(cases())
    if args.pytorch:
        experiment = ROOT / 'gpu-training-kit/experiments/vietnam_1km_two_branch_gru'
        spec = importlib.util.spec_from_file_location('canonical_demo', experiment / 'inference_demo.py')
        demo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(demo)
        rows = [{**dict(zip(demo.RAIN, history)), 'forecast_24h_mm': forecast, **static}
                for _, _, history, forecast in inputs]
        checkpoint = args.checkpoint or ROOT / model.card.get('source_checkpoint_path',
            'gpu-training-kit/experiments/vietnam_1km_two_branch_gru/outputs/two_branch_gru_1km.pt')
        expected = demo.predict(rows, checkpoint)
        actual = np.array([[model.predict(h, f, static)[k] for k in
                            ('temporal_score', 'spatial_score', 'hazard_score')]
                           for _, _, h, f in inputs])
        errors = np.max(np.abs(actual - np.column_stack(expected)), axis=0)
        assert (errors < 1e-5).all(), errors
        print(json.dumps({'cases': len(inputs), 'max_abs_error_vs_pytorch': errors.tolist()}), file=sys.stderr)
    for pattern, daily, history, forecast in inputs:
        result = model.predict(history, forecast, static)
        assert all(np.isfinite(result[k]) and 0 <= result[k] <= 1
                   for k in ('temporal_score', 'spatial_score', 'hazard_score'))
        assert not result['calibrated_probability'] and not result['operational_alert']
        writer.writerow([pattern, daily, history.sum(), forecast,
                         result['temporal_score'], result['spatial_score'], result['hazard_score']])


if __name__ == '__main__':
    main()
