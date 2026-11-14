"""Save one hourly Open-Meteo snapshot for every monitored point, so rainfall history keeps
going while the local Docker stack is off. Run hourly by .github/workflows/rain-archive.yml;
the GIS service imports the files (LiveRainfallService.import_archive). Standard library only.

  python scripts/archive-open-meteo.py --out <dir>      # writes <dir>/YYYY/MM/DD/HHMMSSZ.json.gz
  python scripts/archive-open-meteo.py --self-test
"""
import argparse
import gzip
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CONFIG = Path(__file__).resolve().parents[1] / 'services/gis-service/app/config'
URL = 'https://api.open-meteo.com/v1/forecast'


def points():
    """Same keys as the GIS service (lat/lon to 4 decimals): configured points + points with terrain features."""
    found = {}
    configured = json.loads((CONFIG / 'live_rainfall_locations.json').read_text(encoding='utf-8'))
    registry = json.loads((CONFIG / 'live_gru_static_features.json').read_text(encoding='utf-8'))['locations'].values()
    for p in [*configured, *registry]:
        key = f"{float(p['latitude']):.4f},{float(p['longitude']):.4f}"
        found.setdefault(key, {'key': key, 'name': p['name'], 'latitude': float(p['latitude']), 'longitude': float(p['longitude'])})
    return list(found.values())


def fetch(pts):
    # Same series the GIS service uses: hourly mm in UTC, 168 h back + 24 h ahead.
    params = {'latitude': ','.join(str(p['latitude']) for p in pts), 'longitude': ','.join(str(p['longitude']) for p in pts),
              'hourly': 'precipitation', 'timezone': 'UTC', 'past_days': 8, 'forecast_days': 2}
    request = urllib.request.Request(f'{URL}?{urllib.parse.urlencode(params)}', headers={'User-Agent': 'rain-archive'})
    with urllib.request.urlopen(request, timeout=60) as response:
        body = json.loads(response.read())
    fetched_at = datetime.now(timezone.utc)
    body = body if isinstance(body, list) else [body]  # one point answers with an object, several with a list
    if len(body) != len(pts):
        raise ValueError(f'Expected {len(pts)} results, got {len(body)}')
    return fetched_at, [dict(p, raw=raw) for p, raw in zip(pts, body)]


def self_test():
    pts = points()
    assert pts and len({p['key'] for p in pts}) == len(pts)
    assert all(-90 <= p['latitude'] <= 90 and -180 <= p['longitude'] <= 180 for p in pts)
    print(f'self-test ok: {len(pts)} points')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', type=Path)
    ap.add_argument('--self-test', action='store_true')
    args = ap.parse_args()
    if args.self_test or not args.out:
        return self_test()
    fetched_at, results = fetch(points())
    path = args.out / fetched_at.strftime('%Y/%m/%d/%H%M%SZ.json.gz')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(gzip.compress(json.dumps({'fetched_at': fetched_at.isoformat(), 'source': URL, 'points': results}).encode()))
    print(f'{len(results)} points -> {path} ({path.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
