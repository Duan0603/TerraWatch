"""Scheduled, durable Open-Meteo weather estimates. Never labelled station observations."""
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

LOG = logging.getLogger(__name__)
UTC = timezone.utc
LOCK_ID = 74301892


def utc_now():
    return datetime.now(UTC)


def location_key(lat, lon):
    if not math.isfinite(lat) or not math.isfinite(lon) or not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError('Invalid coordinates')
    return f'{lat:.4f},{lon:.4f}'


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
    return {'provider': 'OPEN_METEO', 'source_kind': 'WEATHER_MODEL_ESTIMATE',
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

    def save_prediction(self, key, as_of, prediction):
        # A prediction retry must not make old weather look newly fetched.
        with self.connection() as conn:
            with conn.cursor() as cur:
                cur.execute('''UPDATE gis_schema.live_rainfall_snapshots
                    SET payload=jsonb_set(payload,'{gru_inference}',%s::jsonb)
                    WHERE location_key=%s AND payload->>'as_of'=%s''',
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

    def predict(self, location, data):
        attempted = utc_now().isoformat()
        def held(reason):
            return {'ready': False, 'reason': reason, 'attempted_at': attempted, 'experimental': True}
        if not os.getenv('LIVE_GRU_ENABLED', 'true').lower() == 'true':
            return held('DISABLED')
        try:
            as_of = datetime.fromisoformat(data['as_of'])
            if as_of.tzinfo is None or not 0 <= (utc_now()-as_of).total_seconds() <= 5400:
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
                  'hourly': 'precipitation', 'timezone': 'UTC', 'past_days': 8, 'forecast_days': 2}
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
            locations = self.locations()
            self.state.update(running=True, locations=len(locations), last_cycle_at=utc_now().isoformat(), last_error=None)
            for location in locations:
                if self.stop_event.is_set():
                    break
                cached = self.repo.get(location['key'])
                if cached and (utc_now()-cached['last_attempt_at']).total_seconds() < self.interval:
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
