"""scripts/build-rain-warning-sites.py: pure helpers and argument handling (no data files, no rasterio)."""
import importlib.util
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pytest

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "build-rain-warning-sites.py"
spec = importlib.util.spec_from_file_location("build_rain_warning_sites", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

UTC = timezone.utc


def test_rolling_is_nan_until_window_full_then_sums():
    r = mod.rolling(np.array([1.0, 2, 3, 4]), 2)
    assert np.isnan(r[0]) and r[1:].tolist() == [3, 5, 7]


def write_om(tmp_path, times, values):
    p = tmp_path / "s.json"
    p.write_text(json.dumps({"hourly": {"time": times, "precipitation": values}}), encoding="utf-8")
    return p


def test_load_returns_utc_start_and_float_array(tmp_path):
    t0, s = mod.load(write_om(tmp_path, ["2024-09-01T00:00", "2024-09-01T01:00"], [0, 1.5]))
    assert t0 == datetime(2024, 9, 1, tzinfo=UTC) and s.dtype == float and s.tolist() == [0.0, 1.5]


def test_load_rejects_missing_hours(tmp_path):
    with pytest.raises(ValueError, match="missing hours"):
        mod.load(write_om(tmp_path, ["2024-09-01T00:00", "2024-09-01T01:00"], [0, None]))


def test_thresholds_are_ordered_percentiles_for_each_window():
    s = np.arange(300, dtype=float) % 7
    th = mod.thresholds(s)
    assert set(th) == {"24", "72", "120"}
    for w in th.values():
        assert set(w) == {"p95", "p99", "p99_9"} and w["p95"] <= w["p99"] <= w["p99_9"]
    assert th["24"]["p95"] <= th["72"]["p95"] <= th["120"]["p95"]


def test_thresholds_constant_series():
    th = mod.thresholds(np.ones(200))
    assert th["72"] == {"p95": 72.0, "p99": 72.0, "p99_9": 72.0}


PCT = {"72": {"p95": 10, "p99": 20, "p99_9": 30}, "120": {"p95": 1000, "p99": 2000, "p99_9": 3000}}


def test_levels_by_day_uses_vietnam_local_days_and_peak_window():
    # 200 h from 2024-09-01 00:00 UTC; 5 mm/h => every full 72 h window is 360 mm (> p99.9 of 72 h).
    t0 = datetime(2024, 9, 1, tzinfo=UTC)
    days, lvl, peak72 = mod.levels_by_day(t0, np.full(200, 5.0), PCT)
    assert days[0] == date(2024, 9, 1).toordinal()          # 00:00 UTC is 07:00 local, same day
    assert (lvl[:3] == 0).all()                              # first days have no complete 72 h window yet
    assert lvl[-1] == 3 and peak72[-1] == 360.0
    assert len(days) == len(lvl) == len(peak72)


def test_levels_by_day_local_day_boundary_at_17_utc():
    t0 = datetime(2024, 9, 1, 16, tzinfo=UTC)               # 23:00 local on 1 Sep
    days, _, _ = mod.levels_by_day(t0, np.zeros(3), PCT)
    assert days.tolist() == [date(2024, 9, 1).toordinal(), date(2024, 9, 2).toordinal()]


def test_levels_by_day_steps_through_thresholds():
    t0 = datetime(2024, 9, 1, tzinfo=UTC)
    for per_hour, expected in ((0.0, 0), (10 / 72 + 0.01, 1), (20 / 72 + 0.01, 2), (30 / 72 + 0.01, 3)):
        _, lvl, _ = mod.levels_by_day(t0, np.full(96, per_hour), PCT)
        assert lvl[-1] == expected, per_hour


def test_constants_are_consistent():
    assert set(mod.REPLAYS[r][0] for r in mod.REPLAYS) <= set(mod.CASES)
    assert set(mod.SITES) <= set(mod.CASES)
    assert list(mod.QUANTILES) == sorted(mod.QUANTILES)
    assert mod.WINDOWS == (24, 72, 120)


def test_self_test_runs(capsys):
    mod.self_test()
    assert "self-test ok" in capsys.readouterr().out


@pytest.mark.parametrize("argv", [[], ["--om", "a"], ["--om", "a", "--kit", "b"]])
def test_main_requires_om_kit_worldpop(monkeypatch, argv):
    monkeypatch.setattr(sys, "argv", ["x", *argv])
    with pytest.raises(SystemExit) as e:
        mod.main()
    assert e.value.code == 2


def test_main_missing_series_file_fails_without_writing_output(tmp_path, monkeypatch):
    out = tmp_path / "o.json"
    monkeypatch.setattr(sys, "argv", ["x", "--om", str(tmp_path), "--kit", str(tmp_path),
                                      "--worldpop", str(tmp_path / "w.tif"), "--output", str(out)])
    with pytest.raises(FileNotFoundError):
        mod.main()
    assert not out.exists()
