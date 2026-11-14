"""Story 4.41: rain-threshold landslide warning for configured sites (config/rain_warning_sites.json).

Level = higher of the 72 h and 120 h rolling Open-Meteo totals against that site's own 1998-2026 percentiles
(P95 watch, P99 warning, P99.9 danger). Shown with how unusual the rain is and how often recorded landslides
followed that level in the past. A rain-only warning, never a landslide probability.
"""
import json
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

LEVELS = (None, 'watch', 'warning', 'danger')
LEVEL_VI = {None: 'Bình thường', 'watch': 'Theo dõi', 'warning': 'Cảnh báo', 'danger': 'Nguy hiểm'}
CONFIG = Path(__file__).resolve().parents[1] / 'config/rain_warning_sites.json'


@lru_cache(maxsize=1)
def load_config():
    try:
        return json.loads(CONFIG.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None  # Optional feature: a missing file must never block the rainfall fetch.


def level_of(totals, thresholds):
    """Index 0-3 from the 72 h and 120 h totals; None when a window is incomplete."""
    best = 0
    for h in ('72', '120'):
        mm = totals.get(h)
        if mm is None:
            return None
        t = thresholds[h]
        best = max(best, (mm >= t['p95']) + (mm >= t['p99']) + (mm >= t['p99_9']))
    return best


def days_below(mm, quantiles):
    """Share of days since 1998 whose peak 72 h rain was below mm (linear between stored quantiles)."""
    if mm is None:
        return None
    for (q0, v0), (q1, v1) in zip(quantiles, quantiles[1:]):
        if mm <= v1:
            return round(q0 if v1 == v0 else q0 + (q1 - q0) * (mm - v0) / (v1 - v0), 2)
    return 100.0


def totals_ending(values, end):
    """Sums of the 24/72/120 hourly values ending at index end (inclusive); None if any hour is missing."""
    out = {}
    for h in (24, 72, 120):
        part = values[end - h + 1:end + 1] if end - h + 1 >= 0 else []
        out[str(h)] = round(sum(part), 1) if len(part) == h and all(v is not None for v in part) else None
    return out


def assess(site, values, end, config):
    """Warning at the hour values[end] (values = hourly mm, oldest first)."""
    totals = totals_ending(values, end)
    idx = level_of(totals, site['thresholds'])
    level = LEVELS[idx] if idx is not None else None
    rate = config['hit_rates'].get(level) if level else None
    return {'totals_mm': totals, 'level': level, 'level_vi': LEVEL_VI[level] if idx is not None else 'Thiếu dữ liệu',
            'complete': idx is not None,
            'percent_days_below': days_below(totals['72'], site['daily_peak_72h_quantiles']),
            'recorded_landslides_one_in': rate and rate['one_in'],
            'last_event': site['last_event_at_level'].get(level) if level else None}


def rain_warning(key, payload):
    """Now and next-24 h warning for a live payload (168 past + 24 forecast hours); None for other places."""
    config = load_config()
    site = config and config['sites'].get(key)
    if not site:
        return None
    hourly = payload.get('hourly') or []
    values = [h.get('mm') for h in hourly]
    past = [i for i, h in enumerate(hourly) if h.get('kind') == 'past_estimate']
    if not past:
        return None
    now = past[-1]
    return {'site_key': key, 'site_name': site['name'], 'period': config['period'], 'source': config['source'],
            'method': config['method'], 'hit_rate_sites': config['hit_rate_sites'],
            'thresholds_mm': site['thresholds'],
            'now': assess(site, values, now, config),
            'next_24h': assess(site, values, now + 24, config) if now + 24 < len(values) else None}


def replay(replay_id):
    """Hour-by-hour warning through a recorded event (observed rain only, no forecast)."""
    config = load_config()
    item = config and config['replays'].get(replay_id)
    if not item:
        return None
    site = config['sites'][item['site_key']]
    values = item['hourly_mm']
    t0 = datetime.fromisoformat(item['first_interval_end_utc']).astimezone(timezone.utc)
    hours = []
    for i in range(item['replay_from_index'], len(values)):
        a = assess(site, values, i, config)
        hours.append({'interval_end': (t0 + timedelta(hours=i)).isoformat(), 'mm': values[i],
                      'totals_mm': a['totals_mm'], 'level': a['level'], 'percent_days_below': a['percent_days_below']})
    return {'replay_id': replay_id, 'label': item['label'], 'site_key': item['site_key'], 'site_name': site['name'],
            'event_utc': item.get('event_utc'), 'event_label': item.get('event_label'),
            'event_end_utc': item.get('event_end_utc'), 'event_precision': item.get('event_precision', 'hour'),
            'thresholds_mm': site['thresholds'], 'hit_rates': config['hit_rates'], 'hours': hours}


def sites():
    config = load_config()
    if not config:
        return None
    return {'period': config['period'], 'source': config['source'], 'method': config['method'],
            'hit_rates': config['hit_rates'], 'hit_rate_sites': config['hit_rate_sites'],
            'people_source': config['people_source'], 'footprint_source': config['footprint_source'],
            'buildings_source': config.get('buildings_source'),
            'replays': [{'replay_id': k, 'label': v['label'], 'site_key': v['site_key']} for k, v in config['replays'].items()],
            'sites': [dict({k: s[k] for k in ('key', 'name', 'latitude', 'longitude', 'thresholds', 'last_event_at_level', 'impact_zone')},
                           runout=s.get('runout')) for s in config['sites'].values()]}
