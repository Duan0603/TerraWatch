"""Read-only inventory of the local research cohort; never approves model release.

python scripts/check-gru-training-readiness.py --output docs/gru-training-readiness.json
python scripts/check-gru-training-readiness.py --self-test
"""
import argparse
import ast
import csv
import hashlib
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / 'gpu-training-kit'
SPATIAL_FEATURES = ('slope_deg', 'elevation_m', 'clay_pct', 'sand_pct', 'bulk_density_g_cm3')


def feature_inventory(rows):
    counts = {}
    for feature in SPATIAL_FEATURES:
        values = []
        for row in rows:
            try:
                value = float(row[feature])
                if math.isfinite(value):
                    values.append(value)
            except (KeyError, TypeError, ValueError):
                pass
        counts[feature] = {'finite_rows': len(values), 'missing_or_nonfinite_rows': len(rows)-len(values),
                           'min': min(values) if values else None, 'max': max(values) if values else None}
    return {'rows': len(rows), 'features': counts,
            'notice': 'Finite values only; does not certify coverage, labels or historical availability.'}


def utc(text):
    value = datetime.fromisoformat(text.replace('Z', '+00:00'))
    if value.utcoffset() is None:
        raise ValueError('Timezone required')
    return value


def blockers(row):
    reasons = []
    if row.get('verified_next24h_label') not in ('0', '1'):
        reasons.append('UNVERIFIED_24H_LABEL')
    for field in ('input_historical_availability_verified', 'source_unit_assignment_verified',
                  'target_label_verified'):
        if str(row.get(field, '')).lower() != 'true':
            reasons.append(field.upper())
    if row.get('verified_next24h_label') == '0' and str(row.get('verified_negative_observation')).lower() != 'true':
        reasons.append('UNVERIFIED_NEGATIVE_OBSERVATION')
    try:
        issue = utc(row['issue_time'])
        if not (utc(row['target_start_utc']) == issue
                and utc(row['target_end_utc_exclusive']) == issue + timedelta(hours=24)
                and utc(row['history_end_utc_exclusive']) == issue
                and utc(row['history_start_utc']) == issue - timedelta(hours=168)
                and utc(row['forecast_valid_start_utc']) == issue
                and utc(row['forecast_valid_end_utc']) == issue + timedelta(hours=24)):
            reasons.append('WINDOW_MISMATCH')
    except (KeyError, TypeError, ValueError):
        issue = None
        reasons.append('WINDOW_METADATA_MISSING_OR_INVALID')
    # Run initialisation is not evidence of when a forecast was available.
    for field in ('available_at', 'forecast_available_at'):
        try:
            available = utc(row[field])
            if issue is None or available > issue:
                reasons.append(field.upper() + '_AFTER_ISSUE')
        except (KeyError, TypeError, ValueError):
            reasons.append(field.upper() + '_MISSING_OR_INVALID')
    return reasons


def summarize(rows):
    counts = Counter()
    groups = defaultdict(set)
    dates = defaultdict(set)
    roles = Counter()
    for row in rows:
        counts.update(blockers(row))
        split = row.get('split_chronological', '')
        group = row.get('provisional_dependence_group')
        if group:
            groups[group].add(split)
        dates[split].add(row.get('target_local_date', ''))
        roles[(split, row.get('sample_role', ''))] += 1
    return {'rows': len(rows), 'rows_passing_label_and_clock_checks': sum(not blockers(r) for r in rows),
            'blocker_counts': dict(sorted(counts.items())),
            'split_role_counts': [{'split': s, 'role': role, 'rows': n} for (s, role), n in sorted(roles.items())],
            'dates_by_split': {s: sorted(v) for s, v in sorted(dates.items())},
            'dependence_groups_crossing_splits': sorted(g for g, splits in groups.items() if len(splits) > 1),
            'scope': 'Label/clock inventory only; not full validation of inputs, splits or release readiness.'}


def proxy_curve(rows):
    """Descriptive validation curve only; no threshold selection or test-set tuning."""
    labels = [int(r['proxy_binary_label']) for r in rows]
    scores = [float(r['p_hazard_slope_soil']) for r in rows]
    if not rows or set(labels) != {0, 1} or any(not math.isfinite(s) or not 0 <= s <= 1 for s in scores):
        raise ValueError('Both proxy classes and finite scores in [0,1] required')
    if any(r['split_chronological'] != 'val' for r in rows):
        raise ValueError('Only validation rows may enter the threshold curve')
    for threshold in sorted({0.0, .26, .5, .65, 1.0, *scores}):
        tp = sum(y == 1 and s >= threshold for y, s in zip(labels, scores))
        fp = sum(y == 0 and s >= threshold for y, s in zip(labels, scores))
        fn, tn = labels.count(1)-tp, labels.count(0)-fp
        yield {'threshold': threshold, 'tp': tp, 'fn': fn, 'fp': fp, 'tn': tn,
               'proxy_recall': tp/(tp+fn), 'proxy_false_positive_rate': fp/(fp+tn),
               'proxy_precision': tp/(tp+fp) if tp+fp else None, 'operational_alert': False}


def self_test():
    row = dict(verified_next24h_label='1', input_historical_availability_verified='True',
               source_unit_assignment_verified='True', target_label_verified='True',
               issue_time='2026-11-13T00:00:00Z', target_start_utc='2026-11-13T00:00:00Z',
               target_end_utc_exclusive='2026-11-14T00:00:00Z',
               history_start_utc='2026-11-06T00:00:00Z', history_end_utc_exclusive='2026-11-13T00:00:00Z',
               forecast_valid_start_utc='2026-11-13T00:00:00Z', forecast_valid_end_utc='2026-11-14T00:00:00Z',
               available_at='2026-11-12T23:59:00Z', forecast_available_at='2026-11-12T23:59:00Z')
    assert not blockers(row)
    assert 'UNVERIFIED_24H_LABEL' in blockers({**row, 'verified_next24h_label': ''})
    assert 'FORECAST_AVAILABLE_AT_AFTER_ISSUE' in blockers({**row, 'forecast_available_at': '2026-11-13T00:01:00Z'})
    assert 'UNVERIFIED_NEGATIVE_OBSERVATION' in blockers({**row, 'verified_next24h_label': '0'})
    assert 'WINDOW_METADATA_MISSING_OR_INVALID' in blockers({**row, 'issue_time': '2026-11-13T00:00:00'})
    assert 'WINDOW_MISMATCH' in blockers({**row, 'history_start_utc': '2026-11-07T00:00:00Z'})
    result = summarize([{**row, 'split_chronological': s, 'provisional_dependence_group': 'storm-a'}
                        for s in ('train', 'test')])
    assert result['dependence_groups_crossing_splits'] == ['storm-a']
    curve_rows = [dict(proxy_binary_label=str(y), p_hazard_slope_soil=s, split_chronological='val')
                  for y, s in ((1, .8), (0, .6))]
    curve = list(proxy_curve(curve_rows))
    assert curve[0]['tp'] == curve[0]['fp'] == 1
    assert next(r for r in curve if r['threshold'] == .65)['fp'] == 0
    try:
        list(proxy_curve([{**r, 'split_chronological': 'test'} for r in curve_rows]))
    except ValueError:
        pass
    else:
        raise AssertionError('Test-set threshold tuning accepted')
    inventory = feature_inventory([{'elevation_m': '-5'}, {'elevation_m': 'nan'}, {'elevation_m': ''}])
    assert inventory['features']['elevation_m']['finite_rows'] == 1
    assert inventory['features']['elevation_m']['min'] == -5
    assert inventory['features']['elevation_m']['missing_or_nonfinite_rows'] == 2
    print('13 readiness self-checks passed')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test', action='store_true')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--proxy-curve', type=Path, help='Write descriptive validation proxy curve as CSV')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    paths = {'cohort': KIT / 'data/processed/footprint_two_branch_experiment/footprint_spatiotemporal_proxy_2693.csv',
             'local_day_gfs': KIT / 'data/forecast_archive/local_day_gfs/manifest.json',
             'background_gfs': KIT / 'data/forecast_archive/temporal_background_gfs/manifest.json',
             'review_queue': KIT / 'data/processed/non_event_review/review_queue.csv',
             'label_decisions': KIT / 'data/processed/label_decisions_2017_2020/summary.json',
             'readiness': KIT / 'data/processed/forecast_readiness/summary.json'}
    paths['spatial_training'] = KIT / 'data/processed/two_branch_gru_option_b/spatial_train_12districts_7052.csv'
    with paths['cohort'].open(encoding='utf-8-sig', newline='') as handle:
        rows = list(csv.DictReader(handle))
        report = {'cohort': summarize(rows), 'candidate_features': {'temporal_cohort': feature_inventory(rows)}}
    with paths['spatial_training'].open(encoding='utf-8-sig', newline='') as handle:
        report['candidate_features']['spatial_training'] = feature_inventory(list(csv.DictReader(handle)))
    report['candidate_features']['spatial_feature_order'] = SPATIAL_FEATURES
    trainer = KIT / 'experiments/vietnam_1km_two_branch_gru/train.py'
    source = trainer.read_text(encoding='utf8')
    selected = [ast.literal_eval(node.value) for node in ast.walk(ast.parse(source))
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'soil_cols' for t in node.targets)]
    if selected != [list(SPATIAL_FEATURES)]:
        raise ValueError('Trainer spatial features do not match candidate data inventory')
    report['candidate_features']['trainer_sha256'] = hashlib.sha256(trainer.read_bytes()).hexdigest()
    report['candidate_features']['trainer_feature_selection_verified'] = True
    report['forecast_archives'] = {}
    for name in ('local_day_gfs', 'background_gfs'):
        manifest = json.loads(paths[name].read_text(encoding='utf8'))
        days = manifest['days']
        report['forecast_archives'][name] = {
            'days': len(days), 'historical_availability_verified': manifest.get('historical_availability_verified'),
            'days_with_available_at': sum(bool(d.get('historical_available_at')) for d in days),
            'days_with_run_before_target': sum(utc(d['run_initialization_utc']) < utc(d['target_start_utc']) for d in days)}
    with paths['review_queue'].open(encoding='utf-8-sig', newline='') as handle:
        reviews = list(csv.DictReader(handle))
    report['negative_review'] = {'rows': len(reviews), 'verified_non_event': sum(r['verified_non_event'].lower() == 'true' for r in reviews)}
    report['prior_audits'] = {name: json.loads(paths[name].read_text(encoding='utf8')) for name in ('label_decisions', 'readiness')}
    report['sources'] = {name: {'path': p.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                         for name, p in paths.items()}
    support = KIT / 'experiments/vietnam_1km_two_branch_gru/training_support.py'
    report['missing_training_modules'] = [] if support.is_file() else ['training_support.py']
    report['experimental_training_status'] = 'Demo v2 trained separately; HOLD below applies to official training/release.'
    if args.proxy_curve:
        source = KIT / 'experiments/vietnam_1km_two_branch_gru/outputs/validation_predictions_56.csv'
        with source.open(encoding='utf-8-sig', newline='') as handle:
            curve = list(proxy_curve(list(csv.DictReader(handle))))
        with args.proxy_curve.open('w', encoding='utf8', newline='') as handle:
            writer = csv.DictWriter(handle, fieldnames=list(curve[0]))
            writer.writeheader()
            writer.writerows(curve)
        report['proxy_validation_curve'] = {'path': str(args.proxy_curve), 'rows': len(curve),
                                             'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                                             'threshold_selected': None}
    report.update(decision='HOLD_OFFICIAL_TRAINING', recall_priority=True, acceptance_targets=None,
                  reason='No verified 24h training cohort or verified historical input availability; see blocker counts.',
                  experimental=True, calibrated_probability=False, operational_alert=False)
    output = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.write_text(output, encoding='utf8')
    else:
        print(output, end='')


if __name__ == '__main__':
    main()
