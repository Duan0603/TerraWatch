"""Per-point rainfall climatology from the hourly IMERG V07 rasters in gpu-training-kit.

For each monitored point, takes the IMERG pixel that contains it, builds the full hourly series
(1998 onwards) and reports percentiles of rolling 24 h and 72 h totals. GIS compares live
Open-Meteo totals with these to say "unusually heavy rain for this place".

Needs rasterio. Example (AI service image already has it; data mounted read-only):
  docker run --rm -v "<kit>/data/rasters:/rasters:ro" -v "<repo>:/repo" --entrypoint python \
      terrawatch-ai-service /repo/scripts/build-rain-climatology.py --rasters /rasters
"""
import argparse
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
WINDOWS = (24, 72)
PERCENTILES = (90, 95, 99, 99.9)


def rolling_sums(series, hours):
    """Sum of each complete window of `hours` consecutive values; windows touching a NaN are dropped."""
    valid = np.isfinite(series)
    filled = np.where(valid, series, 0.0)
    total = np.convolve(filled, np.ones(hours), 'valid')
    complete = np.convolve(valid.astype(np.int64), np.ones(hours, dtype=np.int64), 'valid') == hours
    return total[complete]


def self_test():
    s = np.array([1, 2, 3, np.nan, 5, 6, 7], dtype=float)
    assert rolling_sums(s, 3).tolist() == [6, 18]
    assert rolling_sums(np.ones(5), 5).tolist() == [5]
    assert rolling_sums(np.ones(4), 5).size == 0
    print('self-test ok')


def band_time(name):
    return datetime.strptime(name[:11], '%Y%m%d_%H').replace(tzinfo=timezone.utc)


def read_series(files, points):
    import rasterio
    chunks, expected, gaps, first, overlap = [], None, 0, None, 0
    for path in files:
        with rasterio.open(path) as src:
            times = [band_time(d) for d in src.descriptions]
            if any(b-a != timedelta(hours=1) for a, b in zip(times, times[1:])):
                raise ValueError(f'Non-hourly bands in {path.name}')
            # vietnam_rain_20230729_20230806 repeats hours of the July/August files (checked identical,
            # max diff 0.0 on 2026-11-13); hours already read are skipped, never counted twice.
            skip = sum(t < expected for t in times) if expected else 0
            overlap += skip
            if skip == len(times):
                continue
            if expected and times[skip] > expected:
                # Keep hour alignment honest: a missing stretch becomes NaN so no window spans it.
                missing = int((times[skip]-expected).total_seconds() // 3600)
                chunks.append(np.full((missing, len(points)), np.nan))
                gaps += missing
            rows_cols = [src.index(p['longitude'], p['latitude']) for p in points]
            if any(not (0 <= r < src.height and 0 <= c < src.width) for r, c in rows_cols):
                raise ValueError('A point lies outside the rain raster')
            data = src.read().astype(np.float64)
            if src.nodata is not None:
                data[data == src.nodata] = np.nan
            data[data < 0] = np.nan
            chunks.append(np.stack([data[skip:, r, c] for r, c in rows_cols], axis=1))
            expected = times[-1] + timedelta(hours=1)
            first = first or times[0]
    return np.concatenate(chunks), first, expected, gaps, overlap


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rasters', type=Path)
    ap.add_argument('--locations', type=Path, default=ROOT/'services/gis-service/app/config/live_gru_static_features.json')
    ap.add_argument('--output', type=Path, default=ROOT/'services/gis-service/app/config/rain_climatology.json')
    ap.add_argument('--self-test', action='store_true')
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    self_test()
    points = list(json.loads(args.locations.read_text(encoding='utf-8'))['locations'].values())
    files = sorted(args.rasters.glob('vietnam_rain_*.tif'))
    if not files:
        raise SystemExit(f'No vietnam_rain_*.tif in {args.rasters}')
    series, start, end, gaps, overlap = read_series(files, points)
    digest = hashlib.sha256(''.join(f.name for f in files).encode()).hexdigest()
    result = {
        'source': 'NASA/GPM_L3/IMERG_V07 hourly, retrospective (revised, not as-issued)',
        'pixel_deg': 0.1, 'period_start_utc': start.isoformat(), 'period_end_utc_exclusive': end.isoformat(),
        'hours': int(series.shape[0]), 'gap_hours': gaps, 'overlap_hours_skipped': overlap, 'raster_files': len(files), 'raster_names_sha256': digest,
        'created_utc': datetime.now(timezone.utc).isoformat(),
        'note': 'Rolling totals ending every hour. A 10 km IMERG pixel smooths local peaks, so point forecasts '
                'exceed high percentiles more easily. Reference for "unusual rain here", not a landslide threshold.',
        'locations': {}}
    for i, p in enumerate(points):
        windows = {}
        for h in WINDOWS:
            sums = rolling_sums(series[:, i], h)
            windows[str(h)] = {f'p{q:g}'.replace('.', '_'): round(float(np.percentile(sums, q)), 1) for q in PERCENTILES}
            windows[str(h)].update(max=round(float(sums.max()), 1), windows=int(sums.size))
        result['locations'][p['key']] = {'name': p['name'], 'latitude': p['latitude'], 'longitude': p['longitude'],
                                         'valid_hours': int(np.isfinite(series[:, i]).sum()), 'windows': windows}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(points)} points, {series.shape[0]} hours ({start:%Y-%m-%d} .. {end:%Y-%m-%d}), gaps {gaps} h -> {args.output}')


if __name__ == '__main__':
    main()
