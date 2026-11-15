"""scripts/check-gru-training-readiness.py: label/clock blockers, summaries, proxy curve, argument handling."""
import importlib.util
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "check-gru-training-readiness.py"
spec = importlib.util.spec_from_file_location("check_gru_training_readiness", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

GOOD = dict(verified_next24h_label="1", input_historical_availability_verified="True",
            source_unit_assignment_verified="True", target_label_verified="True",
            issue_time="2026-11-13T00:00:00Z", target_start_utc="2026-11-13T00:00:00Z",
            target_end_utc_exclusive="2026-11-14T00:00:00Z",
            history_start_utc="2026-11-06T00:00:00Z", history_end_utc_exclusive="2026-11-13T00:00:00Z",
            forecast_valid_start_utc="2026-11-13T00:00:00Z", forecast_valid_end_utc="2026-11-14T00:00:00Z",
            available_at="2026-11-12T23:59:00Z", forecast_available_at="2026-11-12T23:59:00Z")


# ---------------------------------------------------------------- utc
def test_utc_accepts_z_and_offsets():
    assert mod.utc("2026-11-13T00:00:00Z") == mod.utc("2026-11-13T07:00:00+07:00")


@pytest.mark.parametrize("bad", ["2026-11-13T00:00:00", "nope"])
def test_utc_rejects_naive_and_garbage(bad):
    with pytest.raises(ValueError):
        mod.utc(bad)


# ---------------------------------------------------------------- blockers
def test_clean_row_has_no_blockers():
    assert mod.blockers(GOOD) == []


@pytest.mark.parametrize("override,expected", [
    ({"verified_next24h_label": ""}, "UNVERIFIED_24H_LABEL"),
    ({"verified_next24h_label": "2"}, "UNVERIFIED_24H_LABEL"),
    ({"input_historical_availability_verified": "false"}, "INPUT_HISTORICAL_AVAILABILITY_VERIFIED"),
    ({"source_unit_assignment_verified": ""}, "SOURCE_UNIT_ASSIGNMENT_VERIFIED"),
    ({"target_label_verified": "no"}, "TARGET_LABEL_VERIFIED"),
    ({"verified_next24h_label": "0"}, "UNVERIFIED_NEGATIVE_OBSERVATION"),
    ({"history_start_utc": "2026-11-07T00:00:00Z"}, "WINDOW_MISMATCH"),
    ({"target_end_utc_exclusive": "2026-11-13T23:00:00Z"}, "WINDOW_MISMATCH"),
    ({"issue_time": "2026-11-13T00:00:00"}, "WINDOW_METADATA_MISSING_OR_INVALID"),
    ({"forecast_available_at": "2026-11-13T00:01:00Z"}, "FORECAST_AVAILABLE_AT_AFTER_ISSUE"),
    ({"available_at": "2026-11-13T00:01:00Z"}, "AVAILABLE_AT_AFTER_ISSUE"),
    ({"available_at": "garbage"}, "AVAILABLE_AT_MISSING_OR_INVALID"),
])
def test_blockers_each_rule(override, expected):
    assert expected in mod.blockers({**GOOD, **override})


def test_verified_negative_with_observation_passes():
    assert mod.blockers({**GOOD, "verified_next24h_label": "0", "verified_negative_observation": "TRUE"}) == []


def test_available_exactly_at_issue_is_allowed():
    assert mod.blockers({**GOOD, "available_at": GOOD["issue_time"]}) == []


def test_empty_row_reports_every_missing_piece():
    r = mod.blockers({})
    assert {"UNVERIFIED_24H_LABEL", "WINDOW_METADATA_MISSING_OR_INVALID",
            "AVAILABLE_AT_MISSING_OR_INVALID", "FORECAST_AVAILABLE_AT_MISSING_OR_INVALID"} <= set(r)


# ---------------------------------------------------------------- summarize
def test_summarize_counts_groups_and_dates():
    rows = [{**GOOD, "split_chronological": "train", "provisional_dependence_group": "storm-a",
             "target_local_date": "2026-11-13", "sample_role": "pos"},
            {**GOOD, "split_chronological": "test", "provisional_dependence_group": "storm-a",
             "target_local_date": "2026-11-14", "sample_role": "pos"},
            {**GOOD, "verified_next24h_label": "", "split_chronological": "test",
             "provisional_dependence_group": "storm-b", "target_local_date": "2026-11-14", "sample_role": "neg"}]
    s = mod.summarize(rows)
    assert s["rows"] == 3 and s["rows_passing_label_and_clock_checks"] == 2
    assert s["blocker_counts"] == {"UNVERIFIED_24H_LABEL": 1}
    assert s["dependence_groups_crossing_splits"] == ["storm-a"]
    assert s["dates_by_split"] == {"test": ["2026-11-14"], "train": ["2026-11-13"]}
    assert s["split_role_counts"] == [{"split": "test", "role": "neg", "rows": 1},
                                      {"split": "test", "role": "pos", "rows": 1},
                                      {"split": "train", "role": "pos", "rows": 1}]


def test_summarize_empty():
    s = mod.summarize([])
    assert s["rows"] == 0 and s["rows_passing_label_and_clock_checks"] == 0 and s["blocker_counts"] == {}


# ---------------------------------------------------------------- feature_inventory
def test_feature_inventory_counts_finite_values_only():
    inv = mod.feature_inventory([{"elevation_m": "-5"}, {"elevation_m": "nan"}, {"elevation_m": ""},
                                 {"elevation_m": "inf"}, {"slope_deg": "3"}])
    e = inv["features"]["elevation_m"]
    assert (e["finite_rows"], e["missing_or_nonfinite_rows"], e["min"], e["max"]) == (1, 4, -5, -5)
    assert inv["features"]["slope_deg"]["finite_rows"] == 1 and inv["rows"] == 5
    assert inv["features"]["clay_pct"] == {"finite_rows": 0, "missing_or_nonfinite_rows": 5, "min": None, "max": None}
    assert set(inv["features"]) == set(mod.SPATIAL_FEATURES)


# ---------------------------------------------------------------- proxy_curve
def curve_rows(pairs, split="val"):
    return [dict(proxy_binary_label=str(y), p_hazard_slope_soil=s, split_chronological=split) for y, s in pairs]


def test_proxy_curve_confusion_counts_and_rates():
    curve = list(mod.proxy_curve(curve_rows([(1, .8), (0, .6)])))
    at = {c["threshold"]: c for c in curve}
    assert at[0.0]["tp"] == at[0.0]["fp"] == 1 and at[0.0]["fn"] == at[0.0]["tn"] == 0
    assert (at[.65]["tp"], at[.65]["fp"], at[.65]["tn"]) == (1, 0, 1)
    assert at[.65]["proxy_recall"] == 1 and at[.65]["proxy_false_positive_rate"] == 0 and at[.65]["proxy_precision"] == 1
    assert at[1.0]["tp"] == 0 and at[1.0]["proxy_precision"] is None  # no predicted positives
    assert all(c["operational_alert"] is False for c in curve)
    assert [c["threshold"] for c in curve] == sorted(at)


@pytest.mark.parametrize("rows,why", [
    ([], "empty"),
    (curve_rows([(1, .8), (1, .7)]), "one class"),
    (curve_rows([(1, 1.2), (0, .1)]), "score above 1"),
    (curve_rows([(1, -.1), (0, .1)]), "score below 0"),
    (curve_rows([(1, float("nan")), (0, .1)]), "nan score"),
    (curve_rows([(1, .8), (0, .6)], split="test"), "non-validation split"),
])
def test_proxy_curve_rejects_invalid_input(rows, why):
    with pytest.raises(ValueError):
        list(mod.proxy_curve(rows))


# ---------------------------------------------------------------- CLI
def test_main_self_test_flag(monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["x", "--self-test"])
    mod.main()
    assert "self-checks passed" in capsys.readouterr().out


def test_main_unknown_flag_exits_2(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["x", "--nope"])
    with pytest.raises(SystemExit) as e:
        mod.main()
    assert e.value.code == 2


def test_main_missing_kit_fails_without_writing_output(tmp_path, monkeypatch):
    out = tmp_path / "r.json"
    monkeypatch.setattr(mod, "KIT", tmp_path / "no-kit")
    monkeypatch.setattr(sys, "argv", ["x", "--output", str(out)])
    with pytest.raises(FileNotFoundError):
        mod.main()
    assert not out.exists()
