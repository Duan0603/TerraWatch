"""Export trained PyTorch GRU weights for dependency-free NumPy CPU inference.

Also publish static features for the currently registered weather coordinates.
No retraining and no invented static defaults.
"""
import csv
import argparse
import importlib.util
import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
import torch
from rasterio.warp import transform

ROOT = Path(__file__).resolve().parents[1]
EXP = ROOT / 'gpu-training-kit/experiments/vietnam_1km_two_branch_gru'
OUT = ROOT / 'services/ai-service/models/gru_live'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint', type=Path, default=EXP / 'outputs/two_branch_gru_1km.pt')
    parser.add_argument('--output', type=Path, default=OUT)
    parser.add_argument('--static-output', type=Path, default=ROOT / 'services/gis-service/app/config/live_gru_static_features.json')
    parser.add_argument('--model-id', default='terrawatch-two-branch-gru-mil-v1')
    args = parser.parse_args()
    out = args.output
    out.mkdir(parents=True, exist_ok=True)
    checkpoint = args.checkpoint.resolve()
    saved = torch.load(checkpoint, map_location='cpu', weights_only=True)
    fields = saved['spatial_12dist_slope_soil']['features']
    arrays = {k: v.numpy() for k, v in saved['temporal_gru_state_dict'].items()}
    np.savez(out / 'weights.npz', **arrays)
    card = {k: saved[k] for k in ['seq_norm_b', 'sum_norm_b', 'spatial_12dist_slope_soil']}
    card.update(model_id=args.model_id, runtime='numpy-float32-gru',
                source_checkpoint_sha256=hashlib.sha256(checkpoint.read_bytes()).hexdigest(),
                weights_sha256=hashlib.sha256((out / 'weights.npz').read_bytes()).hexdigest(),
                source_checkpoint_path=checkpoint.relative_to(ROOT).as_posix(),
                trained_history_provider='IMERG', trained_forecast_provider='GFS', calibrated_probability=False,
                experimental=True, operational_alert=False, verified_next24h_training_ready=False)
    (out / 'model.json').write_text(json.dumps(card, indent=2)+'\n', encoding='utf8')
    # Synthetic fixtures verify numerical parity, never supply missing terrain in live inference.
    cases = json.loads((ROOT / 'services/ai-service/tests/fixtures/live_gru_cases.json').read_text(encoding='utf8'))[:3]
    for i, case in enumerate(cases):
        if 'elevation_m' in fields and 'elevation_m' not in case['static']:
            case['static']['elevation_m'] = float(100 + (i % 6)*400)
    sys.path.insert(0, str(ROOT / 'services/ai-service'))
    audit_spec = importlib.util.spec_from_file_location('sensitivity_cases', ROOT / 'scripts/audit-live-gru.py')
    audit = importlib.util.module_from_spec(audit_spec)
    audit_spec.loader.exec_module(audit)
    static_mean = dict(zip(fields, card['spatial_12dist_slope_soil']['mean']))
    cases.extend({'history': history.tolist(), 'forecast': forecast, 'static': dict(static_mean)}
                 for _, _, history, forecast in audit.cases())
    spec = importlib.util.spec_from_file_location('canonical_demo', EXP / 'inference_demo.py')
    demo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(demo)
    rows = [{**dict(zip(demo.RAIN, c['history'])), 'forecast_24h_mm': c['forecast'], **c['static']} for c in cases]
    expected = demo.predict(rows, checkpoint)
    sys.path.insert(0, str(ROOT / 'services/ai-service'))
    from app.services.live_gru import LiveGRU
    model = LiveGRU(out)
    keys = ('temporal_score', 'spatial_score', 'hazard_score')
    actual = []
    for i, case in enumerate(cases):
        case['expected'] = {key: float(expected[j][i]) for j, key in enumerate(keys)}
        result = model.predict(case['history'], case['forecast'], case['static'])
        actual.append([result[key] for key in keys])
    errors = np.max(np.abs(np.asarray(actual) - np.column_stack(expected)), axis=0)
    if not (errors < 1e-5).all():
        raise ValueError(f'Checkpoint parity failed: {errors}')
    (out / 'fixtures.json').write_text(json.dumps(cases, indent=2)+'\n', encoding='utf8')
    (out / 'parity.json').write_text(json.dumps({'cases': len(cases), 'max_abs_error_vs_pytorch': dict(zip(keys, errors.tolist())),
        'checkpoint_sha256': card['source_checkpoint_sha256'], 'tolerance': 1e-5}, indent=2)+'\n', encoding='utf8')
    code = 'import json;from app.pipeline.live_rainfall import LiveRainfallService;print(json.dumps(LiveRainfallService().locations()))'
    locations = json.loads(subprocess.check_output(['docker', 'exec', 'terrawatch-gis-service', 'python', '-c', code]))
    x, y = transform('EPSG:4326', 'EPSG:32648', [p['longitude'] for p in locations], [p['latitude'] for p in locations])
    wanted = {}
    for location, east, north in zip(locations, x, y):
        unit = f'UTM48N_1km_{math.floor(east/1000)*1000}_{math.floor(north/1000)*1000}'
        wanted[location['key']] = dict(location, unit_id=unit)
    source = ROOT / 'gpu-training-kit/data/processed/grid_static_features_national/fixed_unit_static_features.csv'
    by_unit = {}
    with source.open(encoding='utf-8-sig', newline='') as handle:
        for row in csv.DictReader(handle):
            if row['unit_id'] not in {p['unit_id'] for p in wanted.values()}:
                continue
            if all(float(row[f+'_valid_area_fraction']) >= .95 and math.isfinite(float(row[f+'_mean'])) for f in fields):
                by_unit[row['unit_id']] = {'values': {f: float(row[f+'_mean']) for f in fields},
                    'coverage': {f: float(row[f+'_valid_area_fraction']) for f in fields}, 'grid_version': row['grid_version']}
    registry = {}
    for key, location in wanted.items():
        registry[key] = {**location, **by_unit.get(location['unit_id'], {}), 'ready': location['unit_id'] in by_unit}
    output = args.static_output
    output.write_text(json.dumps({'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                                 'locations': registry}, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    print(json.dumps({'locations': len(registry), 'complete_static': sum(p['ready'] for p in registry.values())}))


if __name__ == '__main__': main()
