"""Builds services/gis-service/app/config/rain_warning_sites.json (Story 4.41).

Per warning site, from Open-Meteo hourly archive rain (ERA5, the same provider the live GIS service reads):
  - thresholds: P95 / P99 / P99.9 of rolling 24, 72 and 120 h totals over 1998-2026
  - daily_peak_72h_quantiles: to say "rain now is higher than X% of days since 1998"
  - level hit rates pooled over all case sites: days at >= level vs days with a recorded dated landslide
  - impact zone: debris-flow footprint (+100 m) with WorldPop 2025 people estimates and, when given,
    Google Open Buildings counts (confidence >= 0.7) x 3.5 people per household (2019 census average)
  - replay series: hourly rain around the recorded events
Inputs live outside the repo (team dataset + public downloads), e.g.:
  docker run --rm --network none -v "<data>:/d:ro" -v "<repo>:/repo" --entrypoint python terrawatch-ai-service \
     /repo/scripts/build-rain-warning-sites.py --om /d/external/open_meteo_clim \
     --footprint /d/gpu-training-kit/data/processed/lang_nu_delineation/candidate_wgs84.geojson \
     --worldpop /d/external/worldpop/vnm_pop_2025_CN_100m_R2025A_v1.tif
"""
import argparse
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
VN = timedelta(hours=7)
WINDOWS = (24, 72, 120)
QUANTILES = (0, 50, 75, 90, 95, 97, 98, 99, 99.5, 99.7, 99.8, 99.9, 99.95, 99.98, 100)
# Dated landslide cases of the team dataset (gpu-training-kit), point and local day.
CASES = {
    'lang_nu': [(date(2024, 9, 10), 'Lũ bùn đá Làng Nủ (bão Yagi)'), (date(2025, 9, 13), 'Sạt đường tại xã Phúc Khánh')],
    'doan337': [(date(2020, 10, 18), 'Sạt lở Đoàn 337, Hướng Hóa')], 'huong_hoa': [(date(2020, 10, 18), 'Sạt lở Hướng Hóa')],
    'phong_dien': [(date(2020, 10, 12), 'Sạt lở Phong Điền')], 'phong_tho': [(date(2018, 8, 3), 'Sạt lở Phong Thổ')],
    'nha_trang': [(date(2018, 11, 18), 'Sạt lở Nha Trang')], 'phu_cuong': [(date(2017, 10, 12), 'Sạt lở Phú Cường, Tân Lạc')],
}
# Warning sites: only places with Làng Nủ-grade data (mapped event area, hourly event time, buildings and a
# rain-dependent extent model). All CASES above still feed the pooled "1/N" history; they are just not shown.
# shortcut: Đoàn 337 is the only other candidate (mapped area + hourly time) but lacks buildings and an extent model.
SITES = {
    'lang_nu': {'name': 'Làng Nủ (xã Phúc Khánh, Bảo Yên, Lào Cai)', 'latitude': 22.1202, 'longitude': 104.5278,
                'zone': ('lang_nu_delineation/candidate_wgs84.geojson', 'Vùng lũ bùn đá 10/9/2024')},
}
# replay id: (site, local event time, precision 'hour' or 'day', label, event label)
REPLAYS = {
    'lang_nu_2024': ('lang_nu', datetime(2024, 9, 10, 6), 'hour', 'Bão Yagi 9/2024', 'Lũ bùn đá Làng Nủ (~6h 10/9/2024, theo báo chí)'),
    'phuc_khanh_2025': ('lang_nu', datetime(2025, 9, 13, 5), 'hour', 'Mưa lớn 9/2025', 'Sạt đường tại xã Phúc Khánh (đêm 12 rạng sáng 13/9/2025)'),
}


def rolling(s, h):
    c = np.concatenate([[0.0], np.cumsum(s)])
    out = np.full(s.shape, np.nan)
    out[h - 1:] = c[h:] - c[:-h]
    return out


def load(path):
    d = json.loads(Path(path).read_text(encoding='utf-8'))
    t0 = datetime.fromisoformat(d['hourly']['time'][0]).replace(tzinfo=timezone.utc)
    raw = d['hourly']['precipitation']
    if any(v is None for v in raw):
        raise ValueError(f'{path}: missing hours')
    return t0, np.array(raw, dtype=float)


def levels_by_day(t0, s, pct):
    """Level 0-3 per Vietnam local day: highest of the 72 h and 120 h windows ending that day."""
    local = np.array([(t0 + timedelta(hours=i) + VN).date().toordinal() for i in range(len(s))])
    days = np.unique(local)
    first = np.searchsorted(local, days)
    lvl = np.zeros(len(days), int)
    for h in (72, 120):
        peak = np.maximum.reduceat(np.nan_to_num(rolling(s, h)), first)
        p = pct[str(h)]
        lvl = np.maximum(lvl, (peak >= p['p95']).astype(int) + (peak >= p['p99']) + (peak >= p['p99_9']))
    return days, lvl, np.maximum.reduceat(np.nan_to_num(rolling(s, 72)), first)


def thresholds(s):
    out = {}
    for h in WINDOWS:
        r = rolling(s, h)
        out[str(h)] = {k: round(float(np.nanpercentile(r, q)), 1) for k, q in (('p95', 95), ('p99', 99), ('p99_9', 99.9))}
    return out


BUILDING_MIN_CONFIDENCE = 0.7
PEOPLE_PER_HOUSEHOLD = 3.5  # Viet Nam 2019 census average household size


def impact_zone(footprint, worldpop, label_vi, buildings=None):
    import rasterio
    from rasterio.mask import mask
    from rasterio.warp import transform_geom
    from shapely.geometry import Point, mapping, shape
    from shapely.ops import unary_union
    foot = unary_union([shape(f['geometry']).buffer(0) for f in json.loads(Path(footprint).read_text(encoding='utf-8'))['features']])
    utm = shape(transform_geom('EPSG:4326', 'EPSG:32648', mapping(foot)))
    zone = {'label': label_vi}
    blds = []
    if buildings:
        for f in json.loads(Path(buildings).read_text(encoding='utf-8'))['features']:
            if f['properties']['confidence'] >= BUILDING_MIN_CONFIDENCE:
                c = shape(f['geometry']).centroid
                blds.append(shape(transform_geom('EPSG:4326', 'EPSG:32648', mapping(Point(c.x, c.y)))))
    with rasterio.open(worldpop) as src:
        for label, g in (('footprint', utm), ('buffer_100m', utm.buffer(100))):
            arr, _ = mask(src, [transform_geom('EPSG:32648', src.crs, mapping(g))], crop=True, filled=True)
            a = arr[0].astype(float)
            a[(a == src.nodata) | (a < 0)] = 0
            geom = transform_geom('EPSG:32648', 'EPSG:4326', mapping(g.simplify(5)))
            zone[label] = {'area_ha': round(g.area / 1e4, 1), 'people_estimate': int(round(a.sum())), 'geometry': geom}
            if buildings:
                n = sum(g.contains(b) for b in blds)
                zone[label].update(buildings=n, people_from_buildings=int(round(n * PEOPLE_PER_HOUSEHOLD)))
    return zone


def self_test():
    assert np.allclose(rolling(np.array([1.0, 2, 3, 4]), 2)[1:], [3, 5, 7])
    print('self-test ok')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--om', type=Path, required=True)
    ap.add_argument('--kit', type=Path, required=True, help='gpu-training-kit/data/processed')
    ap.add_argument('--worldpop', type=Path, required=True)
    ap.add_argument('--buildings', type=Path, help='GeoJSON of Google Open Buildings around Làng Nủ (optional)')
    ap.add_argument('--runout', type=Path, help='runout_langnu_steps.json: modelled debris-flow extent per 72 h rain step (optional)')
    ap.add_argument('--output', type=Path, default=ROOT / 'services/gis-service/app/config/rain_warning_sites.json')
    args = ap.parse_args()
    self_test()

    series, pct, level_days, level_hits = {}, {}, np.zeros(4, int), np.zeros(4, int)
    for sid, cases in CASES.items():
        t0, s = load(args.om / f'{sid}.json')
        series[sid] = (t0, s)
        pct[sid] = thresholds(s)
        days, lvl, _ = levels_by_day(t0, s, pct[sid])
        hit = np.isin(days, [d.toordinal() for d, _ in cases])
        for k in (1, 2, 3):
            level_days[k] += int((lvl >= k).sum())
            level_hits[k] += int(((lvl >= k) & hit).sum())
    t0_any, s_any = next(iter(series.values()))
    period = f'{t0_any.year}–{(t0_any + timedelta(hours=len(s_any) - 1)).year}'
    hit_rates = {name: {'days': int(level_days[k]), 'recorded_landslide_days': int(level_hits[k]),
                        'one_in': int(level_days[k] // max(level_hits[k], 1))}
                 for k, name in ((1, 'watch'), (2, 'warning'), (3, 'danger'))}

    out_sites = {}
    for sid, meta in SITES.items():  # every case point
        t0, s = series[sid]
        days, lvl, peak72 = levels_by_day(t0, s, pct[sid])
        last = {}
        for d, label in sorted(CASES[sid]):
            k = int(lvl[np.searchsorted(days, d.toordinal())])
            for name, need in (('watch', 1), ('warning', 2), ('danger', 3)):
                if k >= need:
                    last[name] = {'date': d.isoformat(), 'label': label}
        key = f"{meta['latitude']:.4f},{meta['longitude']:.4f}"
        out_sites[key] = dict({k: v for k, v in meta.items() if k != 'zone'}, key=key, site_id=sid, thresholds=pct[sid],
                              daily_peak_72h_quantiles=[[q, round(float(np.percentile(peak72, q)), 1)] for q in QUANTILES],
                              last_event_at_level=last,
                              impact_zone=impact_zone(args.kit / meta['zone'][0], args.worldpop, meta['zone'][1],
                                                      args.buildings if sid == 'lang_nu' else None) if meta['zone'] else None)
        if sid == 'lang_nu' and args.runout:
            # Story 4.41 (rain-dependent extent): the zone drawn for a given 72 h rain comes from this table
            out_sites[key]['runout'] = json.loads(args.runout.read_text(encoding='utf-8'))

    replays = {}
    for rid, (sid, event_local, precision, label, event_label) in REPLAYS.items():
        t0, s = series[sid]
        day0 = datetime(event_local.year, event_local.month, event_local.day)
        start, end = day0 - timedelta(days=6), day0 + timedelta(days=1, hours=12)
        # 120 h of lead-in so the first replayed hour already has full windows
        i0 = int(((start - VN).replace(tzinfo=timezone.utc) - t0).total_seconds() // 3600) - 120
        i1 = int(((end - VN).replace(tzinfo=timezone.utc) - t0).total_seconds() // 3600)
        to_utc = lambda t: (t - VN).replace(tzinfo=timezone.utc).isoformat()
        replays[rid] = {'site_key': next(k for k, v in out_sites.items() if v['site_id'] == sid), 'label': label,
                        'event_label': event_label, 'event_precision': precision,
                        # hour: reported time; day: the whole local day (start/end) because only the date is known
                        'event_utc': to_utc(event_local if precision == 'hour' else day0),
                        'event_end_utc': to_utc(day0 + timedelta(days=1)) if precision == 'day' else None,
                        'first_interval_end_utc': (t0 + timedelta(hours=i0)).isoformat(),
                        'replay_from_index': 120, 'hourly_mm': [round(float(v), 2) for v in s[i0:i1 + 1]]}

    result = {'source': 'Open-Meteo archive (ERA5 reanalysis) hourly precipitation', 'period': period,
              'method': 'Per-site percentiles of rolling 72 h and 120 h rain; level = higher of the two (P95 watch, P99 warning, P99.9 danger). '
                        'Rain-only warning, not a landslide probability.',
              'hit_rates': hit_rates, 'hit_rate_sites': len(CASES),
              'people_source': 'WorldPop 2025 constrained 100 m (CC BY 4.0); OpenStreetMap had no buildings mapped here (14/11/2026)',
              'buildings_source': 'Google Open Buildings v3 (CC BY-4.0 / ODbL), confidence >= 0.7; Microsoft Building Footprints and OpenStreetMap had none here' if args.buildings else None,
              'footprint_source': 'Team dataset gpu-training-kit, Làng Nủ 10/9/2024 debris flow, agent-digitised (not expert-validated)',
              'sites': out_sites, 'replays': replays}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding='utf-8')
    print('written', args.output, 'hit rates', hit_rates)


if __name__ == '__main__':
    main()
