"""scripts/backtest-rain-events.py: pure helper and argument handling (no rasters, no kit data)."""
import importlib.util
import sys
from pathlib import Path

import numpy as np
import pytest

SCRIPTS = Path(__file__).resolve().parents[3] / "scripts"
spec = importlib.util.spec_from_file_location("backtest_rain_events", SCRIPTS / "backtest-rain-events.py")
backtest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backtest)
NAN = np.nan


def test_rolling_with_end_indexes_by_last_hour():
    r = backtest.rolling_with_end(np.array([1, 2, 3, NAN, 5], dtype=float), 2)
    assert np.isnan(r[0]) and r[1] == 3 and r[2] == 5 and np.isnan(r[3]) and np.isnan(r[4])


def test_rolling_with_end_keeps_length():
    assert backtest.rolling_with_end(np.ones(6), 3).shape == (6,)


@pytest.mark.xfail(strict=True, raises=ValueError,
                   reason="BUG: series shorter than the window raises a numpy broadcast ValueError; "
                          "rolling_sums (same maths) returns an empty array instead")
def test_rolling_with_end_short_series_is_all_nan():
    r = backtest.rolling_with_end(np.ones(2), 3)
    assert r.shape == (2,) and np.isnan(r).all()


def test_backtest_reuses_climatology_module_from_scripts_dir():
    assert backtest.clim.rolling_sums.__code__.co_filename.endswith("build-rain-climatology.py")


def test_backtest_boxes_are_well_formed():
    for x0, x1, y0, y1 in backtest.BOXES.values():
        assert x0 < x1 and y0 < y1


@pytest.mark.parametrize("argv", [[], ["--kit", "k"], ["--output", "o"]])
def test_backtest_main_requires_kit_and_output(monkeypatch, argv):
    monkeypatch.setattr(sys, "argv", ["x", *argv])
    with pytest.raises(SystemExit) as e:
        backtest.main()
    assert e.value.code == 2


def test_backtest_main_missing_events_file_fails_without_output(tmp_path, monkeypatch):
    monkeypatch.setattr(sys, "argv", ["x", "--kit", str(tmp_path), "--output", str(tmp_path / "o.json")])
    with pytest.raises(FileNotFoundError):
        backtest.main()
    assert not (tmp_path / "o.json").exists()
