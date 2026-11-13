"""Archive current GIS rainfall payloads locally, without inference or database writes.

Run hourly externally if desired. This script runs once; it never installs a job.
The cache timestamp is retained, not certified as historical provider availability.
"""
import argparse
import hashlib
import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


def stamp(text):
    result = datetime.fromisoformat(text.replace('Z', '+00:00'))
    if result.utcoffset() is None:
        raise ValueError('Timezone required')
    return result


def inspect_snapshot(snapshot):
    data = snapshot['data']
    issue, fetched = stamp(data['as_of']), stamp(data['fetched_at'])
    hourly = {stamp(h['interval_end']): h['mm'] for h in data['hourly']}
    if len(hourly) != len(data['hourly']):
        raise ValueError('Duplicate rainfall interval')
    values = [hourly.get(issue + timedelta(hours=h)) for h in range(-167, 25)]
    if any(v is None or not math.isfinite(v) or v < 0 for v in values):
        raise ValueError('Incomplete or invalid 168h history / 24h forecast')
    history, forecast = values[:168], values[168:]
    for hours in (24, 72, 168):
        if data['history'][str(hours)]['valid_hours'] != hours or not math.isclose(
                sum(history[-hours:]), data['history'][str(hours)]['mm'], abs_tol=.001):
            raise ValueError('History sum does not match hourly data')
    if data['forecast_24h']['valid_hours'] != 24 or not math.isclose(
            sum(forecast), data['forecast_24h']['mm'], abs_tol=.001):
        raise ValueError('Forecast sum does not match hourly data')
    return {'history_hours': 168, 'forecast_hours': 24,
            'cache_fetched_after_issue_seconds': (fetched - issue).total_seconds(),
            'provider_run_issued_at': data.get('provider_run_issued_at'),
            'historical_availability_verified': False,
            'notice': 'Archive receipt proves capture now; it does not prove availability at as_of.'}


def self_test():
    issue = datetime(2026, 11, 13, tzinfo=timezone.utc)
    snapshot = {'data': {'as_of': issue.isoformat(), 'fetched_at': (issue+timedelta(minutes=20)).isoformat(),
                        'hourly': [{'interval_end': (issue+timedelta(hours=h)).isoformat(), 'mm': 1.0}
                                   for h in range(-167, 25)],
                        'history': {str(h): {'valid_hours': h, 'mm': float(h)} for h in (24, 72, 168)},
                        'forecast_24h': {'valid_hours': 24, 'mm': 24.0}}}
    result = inspect_snapshot(snapshot)
    assert result['cache_fetched_after_issue_seconds'] == 1200
    assert not result['historical_availability_verified']
    for invalid in (None, float('nan'), -1):
        snapshot['data']['hourly'][0]['mm'] = invalid
        try:
            inspect_snapshot(snapshot)
        except ValueError:
            pass
        else:
            raise AssertionError('Invalid rainfall accepted')
    print('5 archive self-checks passed')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://localhost:8080')
    parser.add_argument('--output', type=Path, default=ROOT / 'gpu-training-kit/data/forecast_archive/open_meteo_live')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    base = args.base_url.rstrip('/') + '/api/v1/gis/rainfall/live'
    def read(url):
        with urlopen(url, timeout=30) as response:
            raw = response.read()
        return raw, datetime.now(timezone.utc)
    map_raw, captured = read(base + '/map')
    batch = args.output / captured.strftime('%Y%m%dT%H%M%S%fZ')
    batch.mkdir(parents=True, exist_ok=False)
    (batch / 'map.json').write_bytes(map_raw)
    entries = []
    # Map features may be polygons: the location key is the exact API query coordinate.
    keys = sorted({f['properties']['key'] for f in json.loads(map_raw)['features']})
    for key in keys:
        lat, lon = map(float, key.split(','))
        try:
            raw, received = read(base + '?' + urlencode({'latitude': lat, 'longitude': lon}))
            snapshot = json.loads(raw)
            digest = hashlib.sha256(raw).hexdigest()
            filename = f'{lat:.4f},{lon:.4f}-{digest}.json'
            (batch / filename).write_bytes(raw)
            entry = {'key': key, 'file': filename, 'sha256': digest, 'received_at': received.isoformat()}
            try:
                entry['validation'] = inspect_snapshot(snapshot)
            except (ValueError, TypeError, KeyError):
                entry['validation_error'] = 'INCOMPLETE_OR_INVALID_WEATHER_PAYLOAD'
            entries.append(entry)
        except Exception as exc:
            # Keep successful receipts even when another location fails; URLs may contain credentials.
            entries.append({'key': key, 'error_type': type(exc).__name__})
    manifest = {'captured_at': captured.isoformat(), 'map_sha256': hashlib.sha256(map_raw).hexdigest(),
                'experimental': True, 'calibrated_probability': False, 'operational_alert': False,
                'entries': entries}
    (batch / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    print(json.dumps({'archive': str(batch), 'locations': len(keys),
                      'saved': sum('file' in e for e in entries),
                      'valid': sum('validation' in e for e in entries)}))
    if any('validation' not in e for e in entries):
        sys.exit(1)


if __name__ == '__main__':
    main()
