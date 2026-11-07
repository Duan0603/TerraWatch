"""Export real historical model outputs to WebGIS replay assets.

Run from repository root with the training environment. No model retraining,
network download, invented labels or synthetic coordinates.
"""
import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path

from rasterio.warp import transform

ROOT = Path(__file__).resolve().parents[1]
EXPERIMENT = ROOT / 'gpu-training-kit/experiments/vietnam_1km_two_branch_gru'
OUT = ROOT / 'apps/webgis/public/model-demo'
DISTRICTS = {'Nha Trang': 'Nha Trang', 'Phong Dien': 'Phong Điền', 'Huong Hua': 'Hướng Hóa'}
EVENT_DAYS = {'Nha Trang': '2018-11-18', 'Phong Dien': '2020-10-12', 'Huong Hua': '2020-10-18'}


def read(path):
    with path.open(encoding='utf-8-sig', newline='') as handle:
        return list(csv.DictReader(handle))


def write(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n', encoding='utf-8', newline='\n')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = read(EXPERIMENT / 'outputs/validation_predictions_56.csv') + read(EXPERIMENT / 'outputs/test_predictions_2521.csv')
    # Optional local research table: full hourly histories are not needed to use the exported replay.
    context = ROOT / 'gpu-training-kit/data/processed/footprint_two_branch_experiment/footprint_spatiotemporal_proxy_2693.csv'
    history = {r['sample_id']: r for r in read(context)} if context.exists() else {}
    grouped = defaultdict(list)
    for row in rows:
        grouped[(row['district'], row['target_local_date'])].append(row)
    scenarios = []
    for (district, day), group in sorted(grouped.items()):
        features = []
        for row in group:
            _, _, x, y = row['unit_id'].split('_')
            x, y = int(x), int(y)
            xs, ys = transform('EPSG:32648', 'EPSG:4326', [x, x+1000, x+1000, x, x], [y, y, y+1000, y+1000, y])
            coordinates = [[round(lon, 7), round(lat, 7)] for lon, lat in zip(xs, ys)]
            props = {k: float(row[k]) for k in ['forecast_24h_mm', 'slope_deg', 'clay_pct', 'sand_pct',
                'bulk_density_g_cm3', 'rain_past_24h_mm', 'rain_past_168h_mm', 'p_temporal_gru',
                'p_spatial_12dist_slope_soil', 'p_hazard_slope_soil']}
            props.update(unit_id=row['unit_id'], target_local_date=day, mapped_proxy_label=int(row['proxy_binary_label']))
            full = history.get(row['sample_id'])
            props['history_24h_totals'] = [round(sum(float(full[f'rain_h{i:03d}']) for i in range(j+1, j+25)), 3)
                for j in range(0, 168, 24)] if full else None
            features.append({'type': 'Feature', 'id': row['unit_id'], 'properties': props,
                             'geometry': {'type': 'Polygon', 'coordinates': [coordinates]}})
        sid = district.lower().replace(' ', '-') + '_' + day
        filename = sid + '.geojson'
        write(OUT / filename, {'type': 'FeatureCollection', 'features': features})
        scenarios.append({'id': sid, 'district': DISTRICTS[district], 'date': day,
                          'eventDay': day == EVENT_DAYS[district], 'split': group[0]['split_chronological'],
                          'cells': len(features), 'mappedCells': sum(int(r['proxy_binary_label']) for r in group),
                          'url': filename, 'sha256': hashlib.sha256((OUT / filename).read_bytes()).hexdigest()})
    metrics = json.loads((EXPERIMENT / 'outputs/metrics.json').read_text(encoding='utf-8'))
    checkpoint = EXPERIMENT / 'outputs/two_branch_gru_1km.pt'
    index = {'version': 1, 'mode': 'historical_replay', 'model': 'GRU–MIL × Logistic Regression',
             'checkpointSha256': hashlib.sha256(checkpoint.read_bytes()).hexdigest(),
             'defaultScenario': 'huong-hua_2020-10-18', 'scenarios': scenarios,
             'metrics': metrics['slope_plus_soil_model'],
             'sourceFilesSha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in [
                 EXPERIMENT / 'outputs/validation_predictions_56.csv', EXPERIMENT / 'outputs/test_predictions_2521.csv']}}
    write(OUT / 'index.json', index)
    assert sum(s['cells'] for s in scenarios) == 2577
    print(f'Exported {len(scenarios)} scenarios / 2577 real model rows to {OUT}')


if __name__ == '__main__':
    main()
