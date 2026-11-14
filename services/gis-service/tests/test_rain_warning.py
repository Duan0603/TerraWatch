"""Story 4.41: rain-threshold warning for Làng Nủ (config built by scripts/build-rain-warning-sites.py)."""
from datetime import datetime, timezone

from app.pipeline import rain_warning as rw

KEY = '22.1202,104.5278'
TH = {'72': {'p95': 10, 'p99': 20, 'p99_9': 30}, '120': {'p95': 15, 'p99': 25, 'p99_9': 40}}


def test_level_is_the_higher_of_72h_and_120h():
    assert rw.level_of({'72': 5, '120': 5}, TH) == 0
    assert rw.level_of({'72': 21, '120': 5}, TH) == 2
    assert rw.level_of({'72': 5, '120': 41}, TH) == 3
    assert rw.level_of({'72': None, '120': 50}, TH) is None  # an incomplete window never claims a level


def test_percent_of_days_below_interpolates_and_caps():
    q = [[0, 0.0], [50, 10.0], [100, 30.0]]
    assert rw.days_below(5, q) == 25
    assert rw.days_below(20, q) == 75
    assert rw.days_below(99, q) == 100.0
    assert rw.days_below(None, q) is None


def test_missing_hour_makes_totals_incomplete():
    vals = [1.0] * 130
    assert rw.totals_ending(vals, 129) == {'24': 24.0, '72': 72.0, '120': 120.0}
    vals[100] = None
    t = rw.totals_ending(vals, 129)
    assert t['24'] == 24.0 and t['72'] is None and t['120'] is None


def test_config_is_built_for_lang_nu():
    cfg = rw.load_config()
    site = cfg['sites'][KEY]
    assert site['thresholds']['72']['p99'] < site['thresholds']['72']['p99_9']
    assert site['impact_zone']['footprint']['area_ha'] > 60
    assert cfg['hit_rates']['danger']['one_in'] < cfg['hit_rates']['warning']['one_in'] < cfg['hit_rates']['watch']['one_in']


def test_yagi_replay_reaches_danger_before_the_debris_flow():
    r = rw.replay('lang_nu_2024')
    flow = datetime(2024, 9, 9, 23, tzinfo=timezone.utc)  # ~06:00 on 10/9/2024, Vietnam time
    before = [h for h in r['hours'] if datetime.fromisoformat(h['interval_end']) <= flow]
    first = {lvl: next((h['interval_end'] for h in before if h['level'] in lvls), None)
             for lvl, lvls in (('warning', ('warning', 'danger')), ('danger', ('danger',)))}
    assert first['danger'] is not None, 'Yagi must reach danger before the reported time'
    assert first['warning'] <= first['danger']


def test_live_payload_gives_now_and_next_24h_only_for_sites():
    hourly = [{'interval_end': f'h{i}', 'mm': 3.0, 'kind': 'past_estimate' if i < 168 else 'forecast'} for i in range(192)]
    w = rw.rain_warning(KEY, {'hourly': hourly})
    assert w['now']['totals_mm']['72'] == 216.0 and w['now']['level'] in ('warning', 'danger')
    assert w['next_24h']['totals_mm']['72'] == 216.0
    assert w['now']['recorded_landslides_one_in'] is not None
    assert rw.rain_warning('21.8450,104.0850', {'hourly': hourly}) is None


def test_only_lang_nu_is_a_site_but_all_cases_feed_the_history():
    cfg = rw.load_config()
    assert list(cfg['sites']) == [KEY] and set(cfg['replays']) == {'lang_nu_2024', 'phuc_khanh_2025'}
    assert cfg['hit_rate_sites'] == 7  # the other dated cases still count in "1/N"
    for r in cfg['replays'].values():
        assert r['site_key'] == KEY and r['event_precision'] == 'hour' and r['event_end_utc'] is None


def test_lang_nu_extent_grows_with_rain_and_is_served():
    site = rw.load_config()['sites'][KEY]
    steps = site['runout']['steps']
    assert [s['rain72_mm'] for s in steps] == sorted(s['rain72_mm'] for s in steps)
    assert all(a['area_ha'] <= b['area_ha'] and a['lowest_elev_m'] >= b['lowest_elev_m'] for a, b in zip(steps, steps[1:]))
    assert steps[0]['people'] <= steps[-1]['people'] and steps[-1]['buildings'] > 0
    assert 0.4 < site['runout']['calibration']['iou'] < 1
    served = next(s for s in rw.sites()['sites'] if s['key'] == KEY)
    assert served['runout']['steps'][0]['geometry']['type'] in ('Polygon', 'MultiPolygon')
