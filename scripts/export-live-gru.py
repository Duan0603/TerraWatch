"""Export trained PyTorch GRU weights for dependency-free NumPy CPU inference.

Also publish static features for the currently registered weather coordinates.
No retraining and no invented static defaults.
"""
import csv
import hashlib
import json
import math
import subprocess
from pathlib import Path

import numpy as np
import torch
from rasterio.warp import transform

ROOT = Path(__file__).resolve().parents[1]
EXP = ROOT / 'gpu-training-kit/experiments/vietnam_1km_two_branch_gru'
OUT = ROOT / 'services/ai-service/models/gru_live'
FIELDS = ['slope_deg', 'clay_pct', 'sand_pct', 'bulk_density_g_cm3']


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    checkpoint = EXP / 'outputs/two_branch_gru_1km.pt'
    saved = torch.load(checkpoint, map_location='cpu', weights_only=True)
    arrays = {k: v.numpy() for k, v in saved['temporal_gru_state_dict'].items()}
    np.savez(OUT / 'weights.npz', **arrays)
    card = {k: saved[k] for k in ['seq_norm_b', 'sum_norm_b', 'spatial_12dist_slope_soil']}
    card.update(model_id='terrawatch-two-branch-gru-mil-v1', runtime='numpy-float32-gru',
                source_checkpoint_sha256=hashlib.sha256(checkpoint.read_bytes()).hexdigest(),
                weights_sha256=hashlib.sha256((OUT / 'weights.npz').read_bytes()).hexdigest(),
                trained_history_provider='IMERG', trained_forecast_provider='GFS', calibrated_probability=False)
    (OUT / 'model.json').write_text(json.dumps(card, indent=2)+'\n', encoding='utf8')
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
            if all(float(row[f+'_valid_area_fraction']) >= .95 and math.isfinite(float(row[f+'_mean'])) for f in FIELDS):
                by_unit[row['unit_id']] = {'values': {f: float(row[f+'_mean']) for f in FIELDS},
                    'coverage': {f: float(row[f+'_valid_area_fraction']) for f in FIELDS}, 'grid_version': row['grid_version']}
    registry = {}
    for key, location in wanted.items():
        registry[key] = {**location, **by_unit.get(location['unit_id'], {}), 'ready': location['unit_id'] in by_unit}
    output = ROOT / 'services/gis-service/app/config/live_gru_static_features.json'
    output.write_text(json.dumps({'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                                 'locations': registry}, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    print(json.dumps({'locations': len(registry), 'complete_static': sum(p['ready'] for p in registry.values())}))


if __name__ == '__main__': main()
