"""Backtest: was IMERG rain before real mapped landslides above the 99th percentile of that place?

Events = NASA COOLR / Lower Mekong inventory points (date only, time unknown) inside fixed boxes.
For each (region, date) the IMERG pixel holding the most points is used. Rule fixed before looking:
max rolling 24 h / 72 h total ending inside the event's Vietnam calendar day or the day before
(date-only inventories), compared with that pixel's own 1998-2026 percentiles. Baseline = days per
year on which the same pixel's 72 h total reaches its P99 (the false-alarm cost of the rule).

  docker run --rm -v "<kit>:/kit:ro" -v "<repo>:/repo" --entrypoint python terrawatch-ai-service \
      /repo/scripts/backtest-rain-events.py --kit /kit --output /repo/<out>.json
"""
import argparse
import collections
import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('clim', ROOT / 'scripts/build-rain-climatology.py')
clim = importlib.util.module_from_spec(spec)
spec.loader.exec_module(clim)

UTC, VN = timezone.utc, timedelta(hours=7)
BOXES = {'Sa Pa + Bát Xát (Lào Cai)': (103.5, 104.0, 22.2, 22.85), 'Mù Cang Chải (Yên Bái)': (103.9, 104.4, 21.6, 22.0),
         'Hướng Hóa (Quảng Trị)': (106.4, 106.95, 16.4, 16.95), 'Phong Điền (Huế)': (107.1, 107.5, 16.3, 16.7)}
MIN_POINTS = 10


def rolling_with_end(series, hours):
    """Totals of complete windows, indexed by the window's last hour (NaN where incomplete)."""
    valid = np.isfinite(series)
    total = np.convolve(np.where(valid, series, 0.0), np.ones(hours), 'valid')
    full = np.convolve(valid.astype(np.int64), np.ones(hours, dtype=np.int64), 'valid') == hours
    out = np.full(series.shape, np.nan)
    out[hours-1:] = np.where(full, total, np.nan)
    return out


def self_test():
    s = np.array([1, 2, 3, np.nan, 5], dtype=float)
    r = rolling_with_end(s, 2)
    assert np.isnan(r[0]) and r[1] == 3 and r[2] == 5 and np.isnan(r[3]) and np.isnan(r[4])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--kit', type=Path, required=True)
    ap.add_argument('--output', type=Path, required=True)
    args = ap.parse_args()
    self_test()
    feats = json.loads((args.kit/'data/raw/vietnam_event_points.geojson').read_text(encoding='utf-8'))['features']
    groups = collections.defaultdict(list)
    for f in feats:
        x, y = f['geometry']['coordinates'][:2]
        for region, (x0, x1, y0, y1) in BOXES.items():
            if x0 <= x <= x1 and y0 <= y <= y1 and f['properties'].get('event_date'):
                day = datetime.fromtimestamp(f['properties']['event_date']/1000, UTC).date()
                groups[(region, day)].append((x, y, f['properties']))
    groups = {k: v for k, v in groups.items() if len(v) >= MIN_POINTS}
    # Representative pixel = the 0.1° IMERG cell holding most points of the group.
    cell = lambda x, y: (round((x-102.1)//0.1), round((23.4-y)//0.1))
    points = []
    for key, pts in groups.items():
        (cx, cy), n = collections.Counter(cell(x, y) for x, y, _ in pts).most_common(1)[0]
        points.append({'key': key, 'latitude': 23.4-(cy+0.5)*0.1, 'longitude': 102.1+(cx+0.5)*0.1, 'points_in_pixel': n})
    files = sorted((args.kit/'data/rasters').glob('vietnam_rain_*.tif'))
    series, start, end, gaps, overlap = clim.read_series(files, points)
    times = [start + timedelta(hours=h) for h in range(series.shape[0])]  # band hour start, UTC
    result = []
    for i, p in enumerate(points):
        region, day = p['key']
        pts = groups[p['key']]
        # Window ends = end of each band hour, inside VN day D-1 00:00 .. D+1 00:00.
        lo = datetime(day.year, day.month, day.day, tzinfo=UTC) - VN - timedelta(days=1)
        hi = lo + timedelta(days=2)
        row = {'region': region, 'event_date': day.isoformat(), 'points': len(pts),
               'methods': dict(collections.Counter(q['method'] for _, _, q in pts)),
               'source': collections.Counter(q['source_name'] for _, _, q in pts).most_common(1)[0][0],
               'pixel_center': [round(p['latitude'], 2), round(p['longitude'], 2)], 'points_in_pixel': p['points_in_pixel']}
        for h in (24, 72):
            roll = rolling_with_end(series[:, i], h)
            ok = np.isfinite(roll)
            p99 = float(np.percentile(roll[ok], 99))
            idx = [k for k, t in enumerate(times) if lo < t + timedelta(hours=1) <= hi and ok[k]]
            k = max(idx, key=lambda j: roll[j])
            peak = float(roll[k])
            ends = times[k] + timedelta(hours=1)
            row[f'{h}h'] = {'peak_mm': round(peak, 1), 'peak_window_end_vn': (ends+VN).strftime('%Y-%m-%d %H:%M'),
                            'p99_mm': round(p99, 1), 'exceeds_p99': peak >= p99,
                            'percentile_rank': round(float((roll[ok] < peak).mean()*100), 2)}
        roll72 = rolling_with_end(series[:, i], 72)
        p99 = np.percentile(roll72[np.isfinite(roll72)], 99)
        alert_days = {(t+VN).date() for t, v in zip(times, roll72) if np.isfinite(v) and v >= p99 and t.year < 2026}
        row['alert_days_per_year_72h_p99'] = round(len(alert_days)/28, 1)  # 1998-2025 = 28 full years
        result.append(row)
    result.sort(key=lambda r: (r['region'], r['event_date']))
    out = {'created_utc': datetime.now(UTC).isoformat(), 'imerg_period': [start.isoformat(), end.isoformat()],
           'rule': 'max rolling total ending in VN day D-1 00:00..D+1 00:00 vs pixel P99 (all hours 1998-2026)',
           'min_points_per_event': MIN_POINTS, 'events': result}
    args.output.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for r in result:
        print(r['region'], r['event_date'], r['points'], r['24h'], r['72h'], r['alert_days_per_year_72h_p99'])


if __name__ == '__main__':
    main()
