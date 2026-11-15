"""scripts/build-rain-climatology.py: pure helpers, read_series (fake rasterio, no files) and argument handling."""
import importlib.util
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pytest

SCRIPTS = Path(__file__).resolve().parents[3] / "scripts"


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / file)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


clim = load("build_rain_climatology", "build-rain-climatology.py")
NAN = np.nan


def test_rolling_sums_drops_windows_touching_nan():
    s = np.array([1, 2, 3, NAN, 5, 6, 7], dtype=float)
    assert clim.rolling_sums(s, 3).tolist() == [6, 18]


def test_rolling_sums_exact_and_too_short():
    assert clim.rolling_sums(np.ones(5), 5).tolist() == [5]
    assert clim.rolling_sums(np.ones(4), 5).size == 0


def test_rolling_sums_all_nan_is_empty():
    assert clim.rolling_sums(np.full(10, NAN), 3).size == 0


def test_band_time_parses_prefix_as_utc():
    assert clim.band_time("20230729_05_extra") == datetime(2023, 7, 29, 5, tzinfo=timezone.utc)


@pytest.mark.parametrize("bad", ["", "2023-07-29", "abcdefghijk"])
def test_band_time_rejects_bad_names(bad):
    with pytest.raises(ValueError):
        clim.band_time(bad)


def test_main_self_test_flag(monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["x", "--self-test"])
    clim.main()
    assert capsys.readouterr().out.strip() == "self-test ok"


def test_main_without_rasters_files_exits_with_message(tmp_path, monkeypatch):
    loc = tmp_path / "loc.json"
    loc.write_text('{"locations": {"a": {"key": "a", "name": "A", "latitude": 1, "longitude": 2}}}', encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["x", "--rasters", str(tmp_path), "--locations", str(loc),
                                      "--output", str(tmp_path / "out.json")])
    with pytest.raises(SystemExit) as e:
        clim.main()
    assert "No vietnam_rain_*.tif" in str(e.value)
    assert not (tmp_path / "out.json").exists()


class FakeSrc:
    """Stand-in for rasterio dataset: 1x1 pixel, one band per hour."""
    def __init__(self, descriptions, values, nodata=-9999.0):
        self.descriptions, self.nodata, self.height, self.width = descriptions, nodata, 1, 1
        self._v = np.array(values, dtype=float).reshape(len(values), 1, 1)

    def index(self, lon, lat):
        return (0, 0)

    def read(self):
        return self._v

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


@pytest.fixture
def fake_rasterio(monkeypatch):
    sources = {}

    class Mod:
        @staticmethod
        def open(path):
            return sources[path.name]
    monkeypatch.setitem(sys.modules, "rasterio", Mod)
    return sources


def names(start_hour, n, day="20230101"):
    return [f"{day}_{h:02d}" for h in range(start_hour, start_hour + n)]


PT = [{"longitude": 2.0, "latitude": 1.0}]


def test_read_series_overlap_skipped_gap_filled_with_nan_and_nodata_masked(fake_rasterio):
    fake_rasterio["a.tif"] = FakeSrc(names(0, 3), [1, 2, -9999.0])           # hours 0-2, last is nodata
    fake_rasterio["b.tif"] = FakeSrc(names(2, 2), [99, 4])                    # hour 2 repeats -> skipped
    fake_rasterio["c.tif"] = FakeSrc(names(6, 1), [7])                        # hours 4,5 missing
    series, first, expected, gaps, overlap = clim.read_series([Path("a.tif"), Path("b.tif"), Path("c.tif")], PT)
    col = series[:, 0].tolist()
    assert col[:2] == [1, 2] and np.isnan(col[2]) and col[3] == 4
    assert np.isnan(col[4]) and np.isnan(col[5]) and col[6] == 7
    assert (gaps, overlap) == (2, 1)
    assert first == datetime(2023, 1, 1, 0, tzinfo=timezone.utc)
    assert expected == datetime(2023, 1, 1, 7, tzinfo=timezone.utc)


def test_read_series_negative_values_become_nan(fake_rasterio):
    fake_rasterio["a.tif"] = FakeSrc(names(0, 2), [-1.0, 2.0], nodata=None)
    series = clim.read_series([Path("a.tif")], PT)[0]
    assert np.isnan(series[0, 0]) and series[1, 0] == 2


def test_read_series_non_hourly_bands_rejected(fake_rasterio):
    fake_rasterio["a.tif"] = FakeSrc(["20230101_00", "20230101_02"], [1, 2])
    with pytest.raises(ValueError, match="Non-hourly bands in a.tif"):
        clim.read_series([Path("a.tif")], PT)


def test_read_series_point_outside_raster_rejected(fake_rasterio):
    src = FakeSrc(names(0, 1), [1])
    src.index = lambda lon, lat: (5, 0)
    fake_rasterio["a.tif"] = src
    with pytest.raises(ValueError, match="outside the rain raster"):
        clim.read_series([Path("a.tif")], PT)
