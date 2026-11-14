"""Scheduled, durable Open-Meteo weather estimates. Never labelled station observations."""
import gzip
import json
import logging
import math
import os
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import Json, RealDictCursor
import requests

from app.pipeline.rainfall_repository import RainfallRepository
from app.pipeline.rain_warning import rain_warning

LOG = logging.getLogger(__name__)
UTC = timezone.utc
LOCK_ID = 74301892
RETRY_AFTER_ERROR_SECONDS = 300
VN = timezone(timedelta(hours=7), 'Asia/Ho_Chi_Minh')  # Vietnam has no DST, so a fixed offset is exact.
WEATHER_UNITS = {'temperature_2m': '°C', 'relative_humidity_2m': '%', 'precipitation_probability': '%',
                 'wind_speed_10m': 'km/h', 'weather_code': 'wmo code'}
HOURLY_VARIABLES = ','.join(['precipitation', *WEATHER_UNITS])


def utc_now():
    return datetime.now(UTC)


def location_key(lat, lon):
    if not math.isfinite(lat) or not math.isfinite(lon) or not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError('Invalid coordinates')
    return f'{lat:.4f},{lon:.4f}'


def summarize_weather(raw, series, as_of):
    """Current conditions and 7 Vietnam calendar days. Rain is reused from the validated series."""
    hourly, units = raw['hourly'], raw.get('hourly_units', {})
    times = hourly['time']
    if any(units.get(k) != u or len(hourly.get(k) or []) != len(times) for k, u in WEATHER_UNITS.items()):
        raise ValueError('Missing weather variable or unexpected unit')
    def clean(value):
        value = None if value is None else float(value)
        return value if value is not None and math.isfinite(value) else None
    rows = {}
    for i, text in enumerate(times):
        t = datetime.fromisoformat(text)
        t = t.replace(tzinfo=UTC) if t.tzinfo is None else t.astimezone(UTC)
        rows[t] = {k: clean(hourly[k][i]) for k in WEATHER_UNITS}
    days, today = [], as_of.astimezone(VN).date()
    for offset in range(7):
        day = today + timedelta(days=offset)
        # Temperature etc. are instants at t; precipitation at t covers the hour ending at t.
        insts = [r for t, r in rows.items() if t.astimezone(VN).date() == day]
        if not insts:
            continue
        start = datetime(day.year, day.month, day.day, tzinfo=VN)
        rain = [series.get((start+timedelta(hours=h)).astimezone(UTC)) for h in range(1, 25)]
        pick = lambda key, fn: fn([r[key] for r in insts if r[key] is not None], default=None)
        days.append({'date': day.isoformat(),
                     'rain_mm': round(sum(rain), 1) if None not in rain else None,
                     'rain_valid_hours': sum(v is not None for v in rain),
                     'temp_min_c': pick('temperature_2m', min), 'temp_max_c': pick('temperature_2m', max),
                     'precip_probability_max_pct': pick('precipitation_probability', max),
                     'weather_code': pick('weather_code', max),  # WMO codes grow with severity
                     'wind_max_kmh': pick('wind_speed_10m', max)})
    current = rows.get(as_of)
    return {'timezone': 'Asia/Ho_Chi_Minh', 'units': WEATHER_UNITS,
            'current': dict(current, at=as_of.isoformat()) if current else None, 'daily': days}


def normalize_weather(raw, fetched_at):
    """Open-Meteo precipitation is the sum over the hour preceding its timestamp."""
    if raw.get('hourly_units', {}).get('precipitation') != 'mm' or raw.get('utc_offset_seconds') != 0:
        raise ValueError('Expected millimetres and UTC')
    hourly = raw.get('hourly', {})
    times, values = hourly.get('time', []), hourly.get('precipitation', [])
    if not times or len(times) != len(values):
        raise ValueError('Invalid hourly response')
    series = {}
    for text, value in zip(times, values):
        end = datetime.fromisoformat(text)
        end = end.replace(tzinfo=UTC) if end.tzinfo is None else end.astimezone(UTC)
        if end in series or end.minute or end.second:
            raise ValueError('Duplicate or non-hourly timestamp')
        if value is None:
            series[end] = None
        else:
            value = float(value)
            series[end] = value if math.isfinite(value) and value >= 0 else None
    as_of = fetched_at.astimezone(UTC).replace(minute=0, second=0, microsecond=0)
    def window(start, hours):
        ends = [start + timedelta(hours=i) for i in range(1, hours+1)]
        vals = [series.get(t) for t in ends]
        count = sum(v is not None for v in vals)
        return {'mm': round(sum(vals), 3) if count == hours else None,
                'valid_hours': count, 'expected_hours': hours,
                'start': start.isoformat(), 'end': ends[-1].isoformat()}
    history = {str(h): window(as_of-timedelta(hours=h), h) for h in (1, 24, 72, 168)}
    forecast = window(as_of, 24)
    if not any(w['valid_hours'] for w in history.values()):
        raise ValueError('No usable recent rainfall intervals')
    try:
        weather = summarize_weather(raw, series, as_of)
    except (ValueError, TypeError, KeyError):
        weather = None  # Optional display data must never block the rainfall the GRU depends on.
    return {'weather': weather,'provider': 'OPEN_METEO', 'source_kind': 'WEATHER_MODEL_ESTIMATE',
            'source_url': 'https://open-meteo.com/en/docs', 'as_of': as_of.isoformat(),
            'fetched_at': fetched_at.isoformat(), 'provider_run_issued_at': None,
            'model_selection': 'best_match', 'history': history, 'forecast_24h': forecast,
            'provider_grid': {k: raw.get(k) for k in ('latitude', 'longitude', 'elevation')},
            'quality': 'complete' if history['168']['mm'] is not None and forecast['mm'] is not None else 'partial',
            'hourly': [{'interval_end': t.isoformat(), 'mm': series.get(t),
                        'kind': 'past_estimate' if t <= as_of else 'forecast'}
                       for t in [as_of+timedelta(hours=h) for h in range(-167, 25)]],
            'gru_inference': {'ready': False, 'reason': 'SOURCE_MISMATCH_OPEN_METEO_VS_IMERG_GFS',
                              'message': 'Mô hình GRU học từ IMERG + GFS; chưa suy luận tự động bằng nguồn Open-Meteo.'}}


def rain_anomaly(climate, payload):
    """Where current totals sit in this point's hourly IMERG record (scripts/build-rain-climatology.py).
    Context for "unusual rain here", not a landslide threshold or a calibrated warning."""
    if not climate:
        return None
    def compare(window, ref):
        mm = window['mm']
        level = None if mm is None else next((p for p in ('p99_9', 'p99', 'p95') if mm >= ref[p]), None)
        return {'mm': mm, 'level': level, **{k: ref[k] for k in ('p95', 'p99', 'p99_9', 'max')}}
    w = climate['windows']
    return {'reference': 'IMERG_V07', 'period': climate['period'],
            'history_24h': compare(payload['history']['24'], w['24']),
            'history_72h': compare(payload['history']['72'], w['72']),
            'forecast_24h': compare(payload['forecast_24h'], w['24'])}


def backfill_payloads(payload, stored):
    """Rain-only records for the hours missing since monitoring began (`stored` = hours already
    recorded), up to 7 days back, rebuilt from the hourly past series this fetch already holds.
    Forecast and GRU stay empty: what the system would have known at those hours is not recoverable."""
    if not stored:
        return []  # nothing stored yet: never invent history from before the point was monitored
    series = {datetime.fromisoformat(h['interval_end']): h['mm'] for h in payload['hourly']}
    as_of = datetime.fromisoformat(payload['as_of'])
    def total(end, hours):
        vals = [series.get(end - timedelta(hours=i)) for i in range(hours)]
        return round(sum(vals), 3) if None not in vals else None
    start = max(min(stored), as_of - timedelta(hours=167))
    hours = (start + timedelta(hours=i) for i in range(int((as_of - start).total_seconds() // 3600)))
    return [{'as_of': t.isoformat(), 'fetched_at': payload['fetched_at'], 'origin': 'backfill',
             'provider': payload['provider'], 'source_kind': payload['source_kind'], 'quality': 'backfill',
             'history': {str(h): {'mm': total(t, h)} for h in (1, 24, 72, 168)}, 'forecast_24h': {'mm': None}}
            for t in hours if t not in stored]


def load_climatology(key):
    path = Path(__file__).resolve().parents[1] / 'config/rain_climatology.json'
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        point = data['locations'].get(key)
        return point and dict(point, period=f"{data['period_start_utc'][:4]}–{data['period_end_utc_exclusive'][:4]}")
    except (OSError, ValueError, KeyError):
        return None  # Optional context must never block the rainfall fetch.


def map_feature(row, interval, now):
    """One cached location as GeoJSON. `current` is false for stale weather, expired or missing GRU results,
    so the map never colours an old score as if it were the present one."""
    gru = row.get('gru') or {}
    last = row.get('last_success_at')
    stale = last is None or (now-last).total_seconds() > interval*1.5 or bool(row.get('last_error'))
    expired = bool(gru.get('ready')) and datetime.fromisoformat(gru['valid_until']) <= now
    geometry = json.loads(row['geom']) if row.get('geom') else {'type': 'Point', 'coordinates': [row['longitude'], row['latitude']]}
    return {'type': 'Feature', 'geometry': geometry, 'properties': {
        'key': row['location_key'], 'name': row['location_name'],
        'current': bool(gru.get('ready')) and not stale and not expired,
        'stale': stale, 'expired': expired, 'reason': gru.get('reason'),
        'hazard_score': gru.get('hazard_score'), 'temporal_score': gru.get('temporal_score'),
        'spatial_score': gru.get('spatial_score'), 'issue_time': gru.get('issue_time'),
        'valid_until': gru.get('valid_until'), 'cell_id': gru.get('unit_id'),
        'rain_24h_mm': row.get('rain_24h_mm'), 'forecast_24h_mm': row.get('forecast_24h_mm')}}


class LiveWeatherRepository:
    def __init__(self):
        self.db_url = RainfallRepository().db_url

    def connect(self):
        return psycopg2.connect(self.db_url, connect_timeout=5)

    @contextmanager
    def connection(self):
        conn = self.connect()
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def ensure_schema(self):
        with self.connection() as conn:
            with conn.cursor() as cur:
                cur.execute('''CREATE TABLE IF NOT EXISTS gis_schema.live_rainfall_snapshots (
                    location_key TEXT PRIMARY KEY, location_name TEXT NOT NULL,
                    latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL,
                    payload JSONB, last_attempt_at TIMESTAMPTZ NOT NULL,
                    last_success_at TIMESTAMPTZ, last_error TEXT)''')
                # Append-only: one row per location and issue hour, kept as first fetched (no look-ahead for backtests).
                # shortcut: no retention (~4 MB/day for 14 points); add pruning or partitioning if points grow a lot.
                cur.execute('''CREATE TABLE IF NOT EXISTS gis_schema.live_rainfall_history (
                    location_key TEXT NOT NULL, as_of TIMESTAMPTZ NOT NULL, fetched_at TIMESTAMPTZ NOT NULL,
                    payload JSONB NOT NULL, PRIMARY KEY (location_key, as_of))''')

    def get(self, key):
        with self.connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('SELECT * FROM gis_schema.live_rainfall_snapshots WHERE location_key=%s', (key,))
                return cur.fetchone()

    def save(self, location, payload=None, error=None):
        with self.connection() as conn:
            with conn.cursor() as cur:
                cur.execute('''INSERT INTO gis_schema.live_rainfall_snapshots
                    (location_key, location_name, latitude, longitude, payload, last_attempt_at, last_success_at, last_error)
                    VALUES (%s,%s,%s,%s,%s,NOW(),CASE WHEN %s THEN NOW() ELSE NULL END,%s)
                    ON CONFLICT (location_key) DO UPDATE SET
                    location_name=EXCLUDED.location_name, last_attempt_at=NOW(), last_error=EXCLUDED.last_error,
                    payload=COALESCE(EXCLUDED.payload,live_rainfall_snapshots.payload),
                    last_success_at=CASE WHEN EXCLUDED.payload IS NOT NULL THEN NOW() ELSE live_rainfall_snapshots.last_success_at END''',
                    (location['key'], location['name'], location['latitude'], location['longitude'],
                     Json(payload) if payload is not None else None, payload is not None, error))
                if payload is not None:
                    cur.execute('SELECT as_of FROM gis_schema.live_rainfall_history WHERE location_key=%s', (location['key'],))
                    stored = {r[0] for r in cur.fetchall()}
                    for row in [*backfill_payloads(payload, stored), payload]:
                        self.append_history(cur, location['key'], row)

    @staticmethod
    def append_history(cur, key, payload):
        """First as-issued record of an hour wins; a backfilled hour gives way once a real record arrives.
        Display-only weather is dropped: rainfall, forecast and GRU result are what backtests need."""
        cur.execute('''INSERT INTO gis_schema.live_rainfall_history (location_key, as_of, fetched_at, payload)
            VALUES (%s,%s,%s,%s) ON CONFLICT (location_key, as_of) DO UPDATE
            SET fetched_at=EXCLUDED.fetched_at, payload=EXCLUDED.payload
            WHERE live_rainfall_history.payload->>'origin' = 'backfill' AND EXCLUDED.payload->>'origin' IS DISTINCT FROM 'backfill' ''',
            (key, payload['as_of'], payload['fetched_at'], Json({k: v for k, v in payload.items() if k != 'weather'})))
        return cur.rowcount

    def add_history(self, key, payload):
        with self.connection() as conn:
            with conn.cursor() as cur:
                return self.append_history(cur, key, payload)

    def recorded_hours(self):
        """(location_key, as_of) of every real, non-backfilled record."""
        with self.connection() as conn:
            with conn.cursor() as cur:
                cur.execute('''SELECT location_key, as_of FROM gis_schema.live_rainfall_history
                    WHERE coalesce(payload->>'origin', 'live') <> 'backfill' ''')
                return set(cur.fetchall())

    def history(self, key, since):
        """As-issued snapshots, oldest first. rain_1h_mm per hour builds a rainfall record over time."""
        with self.connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('''SELECT as_of, fetched_at,
                        (payload->'history'->'1'->>'mm')::float AS rain_1h_mm,
                        (payload->'history'->'24'->>'mm')::float AS rain_24h_mm,
                        (payload->'history'->'72'->>'mm')::float AS rain_72h_mm,
                        (payload->'history'->'168'->>'mm')::float AS rain_168h_mm,
                        (payload->'forecast_24h'->>'mm')::float AS forecast_24h_mm,
                        payload->>'quality' AS quality, coalesce(payload->>'origin', 'live') AS origin,
                        (payload->'gru_inference'->>'hazard_score')::float AS hazard_score,
                        (payload->'gru_inference'->>'temporal_score')::float AS temporal_score,
                        payload->'gru_inference'->>'model_id' AS model_id
                    FROM gis_schema.live_rainfall_history WHERE location_key=%s AND as_of>=%s ORDER BY as_of''',
                    (key, since))
                return cur.fetchall()

    def map_rows(self):
        """Every cached location with only the fields the map needs, plus the polygon of the active
        assessment unit centred on it (locations are registered from unit centroids)."""
        with self.connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('''SELECT s.location_key, s.location_name, s.latitude, s.longitude, s.last_success_at, s.last_error,
                        s.payload->'gru_inference' AS gru, (s.payload->'forecast_24h'->>'mm')::float AS forecast_24h_mm,
                        (s.payload->'history'->'24'->>'mm')::float AS rain_24h_mm, ST_AsGeoJSON(u.geom) AS geom
                    FROM gis_schema.live_rainfall_snapshots s
                    LEFT JOIN LATERAL (SELECT geom FROM gis_schema.spatial_assessment_units u WHERE u.is_active
                        AND round(ST_Y(u.centroid)::numeric, 4) = round(s.latitude::numeric, 4)
                        AND round(ST_X(u.centroid)::numeric, 4) = round(s.longitude::numeric, 4) LIMIT 1) u ON TRUE
                    ORDER BY s.location_key''')
                return cur.fetchall()

    def save_prediction(self, key, as_of, prediction):
        # A prediction retry must not make old weather look newly fetched.
        with self.connection() as conn:
            with conn.cursor() as cur:
                cur.execute('''UPDATE gis_schema.live_rainfall_snapshots
                    SET payload=jsonb_set(payload,'{gru_inference}',%s::jsonb)
                    WHERE location_key=%s AND payload->>'as_of'=%s''',
                    (Json(prediction), key, as_of))
                cur.execute('''UPDATE gis_schema.live_rainfall_history
                    SET payload=jsonb_set(payload,'{gru_inference}',%s::jsonb)
                    WHERE location_key=%s AND as_of=%s''',
                    (Json(prediction), key, as_of))


class LiveRainfallService:
    def __init__(self):
        self.repo = LiveWeatherRepository()
        self.interval = max(900, int(os.getenv('RAINFALL_REFRESH_SECONDS', '3600')))
        self.enabled = os.getenv('RAINFALL_AUTO_ENABLED', 'true').lower() == 'true'
        self.stop_event = threading.Event()
        self.thread = None
        self.state = {'enabled': self.enabled, 'interval_seconds': self.interval, 'running': False,
                      'last_cycle_at': None, 'last_error': None, 'locations': 0}

    def predict(self, location, data, max_age=5400):
        """max_age=None scores an archived snapshot as of its own hour (same inputs, same model)."""
        attempted = utc_now().isoformat()
        def held(reason):
            return {'ready': False, 'reason': reason, 'attempted_at': attempted, 'experimental': True}
        if not os.getenv('LIVE_GRU_ENABLED', 'true').lower() == 'true':
            return held('DISABLED')
        try:
            as_of = datetime.fromisoformat(data['as_of'])
            if as_of.tzinfo is None or (max_age is not None and not 0 <= (utc_now()-as_of).total_seconds() <= max_age):
                return held('WEATHER_STALE')
            path = Path(__file__).resolve().parents[1] / 'config/live_gru_static_features.json'
            registry = json.loads(path.read_text(encoding='utf8'))
            static = registry['locations'].get(location['key'])
            if not static or not static.get('ready'):
                return held('STATIC_FEATURES_UNAVAILABLE')
            hourly = {datetime.fromisoformat(h['interval_end']): h['mm'] for h in data['hourly']}
            history = [hourly.get(as_of-timedelta(hours=h)) for h in range(167, -1, -1)]
            forecast = data['forecast_24h']
            if any(v is None or not math.isfinite(v) or v < 0 for v in history) or forecast['mm'] is None or forecast['valid_hours'] != 24:
                return held('INCOMPLETE_WEATHER')
            body = {'unit_id': static['unit_id'], 'history': history, 'forecast_24h_mm': forecast['mm'],
                    'static': static['values'], 'issue_time': as_of.isoformat(), 'weather_source': 'OPEN_METEO'}
            base = os.getenv('AI_SERVICE_URL', 'http://ai-service:8001').rstrip('/')
            response = requests.post(base+'/api/v1/inference/gru/live', json=body, timeout=(3, 15))
            response.raise_for_status()
            result = response.json()
            for key in ('temporal_score', 'spatial_score', 'hazard_score'):
                if not math.isfinite(result[key]) or not 0 <= result[key] <= 1:
                    raise ValueError('Invalid model score')
            if result['unit_id'] != static['unit_id'] or result['issue_time'] != as_of.isoformat():
                raise ValueError('Model result does not match requested unit/time')
            return {'ready': True, 'experimental': True, 'attempted_at': attempted, **result,
                    'static_values': static['values'], 'static_coverage': static['coverage'],
                    'static_source_sha256': registry['source_sha256'], 'grid_version': static['grid_version']}
        except Exception as exc:
            LOG.warning('Experimental GRU unavailable for %s: %s', location['key'], type(exc).__name__)
            return held('MODEL_UNAVAILABLE_OR_INVALID_INPUT')

    def import_archive(self, root):
        """Hourly Open-Meteo snapshots saved by GitHub Actions while this stack was off
        (.github/workflows/rain-archive.yml). Each becomes a real as-issued record; hours already
        recorded are skipped, backfilled ones are replaced."""
        recorded, added = self.repo.recorded_hours(), 0
        for path in sorted(Path(root).rglob('*.json.gz')):
            run = json.loads(gzip.decompress(path.read_bytes()))
            fetched = datetime.fromisoformat(run['fetched_at'])
            for point in run['points']:
                try:
                    payload = normalize_weather(point['raw'], fetched)
                except (ValueError, KeyError, TypeError):
                    continue
                if (point['key'], datetime.fromisoformat(payload['as_of'])) in recorded:
                    continue
                payload.update(origin='github_archive', rain_anomaly=rain_anomaly(load_climatology(point['key']), payload))
                payload['gru_inference'] = self.predict(point, payload, max_age=None)
                added += self.repo.add_history(point['key'], payload)
        return added

    def locations(self):
        path = Path(__file__).resolve().parents[1] / 'config/live_rainfall_locations.json'
        locations = json.loads(path.read_text(encoding='utf-8'))
        units = RainfallRepository().get_assessment_units()
        locations += [{'name': u.get('unit_name') or u['unit_id'],
                       'latitude': u.get('latitude'), 'longitude': u.get('longitude')} for u in units]
        result = {}
        for location in locations:
            try:
                lat, lon = float(location['latitude']), float(location['longitude'])
                key = location_key(lat, lon)
            except (KeyError, TypeError, ValueError):
                LOG.warning('Skipping weather location with missing or invalid coordinates')
                continue
            result[key] = dict(location, key=key, latitude=lat, longitude=lon)
        return list(result.values())

    def fetch(self, location):
        api_key = os.getenv('OPEN_METEO_API_KEY', '').strip()
        url = 'https://customer-api.open-meteo.com/v1/forecast' if api_key else 'https://api.open-meteo.com/v1/forecast'
        params = {'latitude': location['latitude'], 'longitude': location['longitude'],
                  'hourly': HOURLY_VARIABLES, 'timezone': 'UTC', 'past_days': 8, 'forecast_days': 8}
        if api_key:
            params['apikey'] = api_key
        response = requests.get(url, params=params, timeout=(5, 20))
        response.raise_for_status()
        return normalize_weather(response.json(), utc_now())

    def run_once(self):
        self.repo.ensure_schema()
        conn = self.repo.connect()
        conn.autocommit = True
        try:
            with conn.cursor() as cur:
                cur.execute('SELECT pg_try_advisory_lock(%s)', (LOCK_ID,))
                if not cur.fetchone()[0]:
                    return
            archive = Path(os.getenv('RAIN_ARCHIVE_DIR', '/rain-archive'))
            if archive.is_dir():
                try:
                    self.state['archive_imported'] = self.import_archive(archive)
                except Exception as exc:
                    LOG.warning('Rain archive import failed: %s', type(exc).__name__)
            locations = self.locations()
            self.state.update(running=True, locations=len(locations), last_cycle_at=utc_now().isoformat(), last_error=None)
            for location in locations:
                if self.stop_event.is_set():
                    break
                cached = self.repo.get(location['key'])
                # A failed fetch (e.g. network not up yet after a restart) retries after 5 min, not a full interval.
                wait = RETRY_AFTER_ERROR_SECONDS if cached and cached.get('last_error') else self.interval
                if cached and (utc_now()-cached['last_attempt_at']).total_seconds() < wait:
                    payload = cached.get('payload')
                    if payload:
                        previous = payload.get('gru_inference', {})
                        attempted = previous.get('attempted_at')
                        retry_due = not attempted or (utc_now()-datetime.fromisoformat(attempted)).total_seconds() >= 300
                        if not previous.get('ready') and retry_due:
                            self.repo.save_prediction(location['key'], payload['as_of'], self.predict(location, payload))
                    continue
                try:
                    payload = self.fetch(location)
                    payload['rain_anomaly'] = rain_anomaly(load_climatology(location['key']), payload)
                    payload['rain_warning'] = rain_warning(location['key'], payload)  # Story 4.41
                    payload['gru_inference'] = self.predict(location, payload)
                    self.repo.save(location, payload=payload)
                except Exception as exc:
                    # Exception text/URLs can contain a commercial API key. Store only a safe type/status.
                    status = getattr(getattr(exc, 'response', None), 'status_code', None)
                    error = f'{type(exc).__name__}' + (f' HTTP {status}' if status else '')
                    self.repo.save(location, error=error)
                    LOG.warning('Weather refresh failed for %s: %s', location['key'], error)
        finally:
            conn.close()  # Releases the session advisory lock, including on failure.
            self.state['running'] = False

    def _loop(self):
        while not self.stop_event.is_set():
            try:
                self.run_once()
            except Exception as exc:
                self.state['last_error'] = type(exc).__name__
                LOG.warning('Weather scheduler cycle failed: %s', type(exc).__name__)
            self.stop_event.wait(min(self.interval, 60))

    def start(self):
        if self.enabled and not self.thread:
            self.thread = threading.Thread(target=self._loop, name='rainfall-refresh', daemon=True)
            self.thread.start()

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=2)

    def map_collection(self):
        now = utc_now()
        return {'type': 'FeatureCollection', 'experimental': True, 'calibrated_probability': False,
                'operational_alert': False, 'generated_at': now.isoformat(),
                'features': [map_feature(r, self.interval, now) for r in self.repo.map_rows()]}

    def read(self, latitude, longitude):
        row = self.repo.get(location_key(latitude, longitude))
        if not row:
            return None
        last_success = row['last_success_at']
        age = (utc_now()-last_success).total_seconds() if last_success else None
        return {'location_name': row['location_name'], 'latitude': row['latitude'], 'longitude': row['longitude'],
                'data': row['payload'], 'last_success_at': last_success.isoformat() if last_success else None,
                'last_attempt_at': row['last_attempt_at'].isoformat(), 'last_error': row['last_error'],
                'stale': last_success is None or age > self.interval*1.5 or bool(row['last_error']),
                'refresh_interval_seconds': self.interval}

    def history(self, latitude, longitude, days):
        return self.repo.history(location_key(latitude, longitude), utc_now()-timedelta(days=days))
