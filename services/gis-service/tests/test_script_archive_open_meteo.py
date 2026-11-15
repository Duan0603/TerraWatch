"""scripts/archive-open-meteo.py: point list, request building, output file. No network (urlopen faked)."""
import gzip
import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "archive-open-meteo.py"
spec = importlib.util.spec_from_file_location("archive_open_meteo", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def write_config(tmp_path, configured, registry):
    (tmp_path / "live_rainfall_locations.json").write_text(json.dumps(configured), encoding="utf-8")
    (tmp_path / "live_gru_static_features.json").write_text(json.dumps({"locations": registry}), encoding="utf-8")


def test_points_dedupes_by_four_decimal_key_first_name_wins(tmp_path, monkeypatch):
    write_config(tmp_path,
                 [{"name": "A", "latitude": 22.12026, "longitude": 104.5278}],
                 {"k1": {"name": "A-dup", "latitude": 22.12031, "longitude": 104.52780},
                  "k2": {"name": "B", "latitude": "21.5", "longitude": "103.25"}})
    monkeypatch.setattr(mod, "CONFIG", tmp_path)
    pts = mod.points()
    assert pts == [{"key": "22.1203,104.5278", "name": "A", "latitude": 22.12026, "longitude": 104.5278},
                   {"key": "21.5000,103.2500", "name": "B", "latitude": 21.5, "longitude": 103.25}]


def test_points_missing_config_raises(tmp_path, monkeypatch):
    monkeypatch.setattr(mod, "CONFIG", tmp_path)
    with pytest.raises(FileNotFoundError):
        mod.points()


def test_points_shipped_config_is_valid():
    pts = mod.points()
    assert pts and len({p["key"] for p in pts}) == len(pts)


class FakeResponse:
    def __init__(self, body):
        self.body = body

    def read(self):
        return json.dumps(self.body).encode()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


@pytest.fixture
def fake_urlopen(monkeypatch):
    seen = {}

    def install(body):
        def urlopen(request, timeout=None):
            seen["url"], seen["timeout"], seen["headers"] = request.full_url, timeout, dict(request.header_items())
            return FakeResponse(body)
        monkeypatch.setattr(mod.urllib.request, "urlopen", urlopen)
        return seen
    return install


PTS = [{"key": "1.0000,2.0000", "name": "A", "latitude": 1.0, "longitude": 2.0},
       {"key": "3.0000,4.0000", "name": "B", "latitude": 3.0, "longitude": 4.0}]


def test_fetch_multiple_points_builds_query_and_pairs_results(fake_urlopen):
    seen = fake_urlopen([{"r": 1}, {"r": 2}])
    fetched_at, results = mod.fetch(PTS)
    q = parse_qs(urlparse(seen["url"]).query)
    assert seen["url"].startswith(mod.URL + "?") and seen["timeout"] == 60
    assert q["latitude"] == ["1.0,3.0"] and q["longitude"] == ["2.0,4.0"]
    assert q["hourly"] == ["precipitation"] and q["timezone"] == ["UTC"]
    assert q["past_days"] == ["8"] and q["forecast_days"] == ["2"]
    assert fetched_at.tzinfo is not None
    assert [r["raw"] for r in results] == [{"r": 1}, {"r": 2}] and results[0]["key"] == "1.0000,2.0000"


def test_fetch_single_point_object_is_wrapped(fake_urlopen):
    fake_urlopen({"r": 1})
    assert mod.fetch(PTS[:1])[1][0]["raw"] == {"r": 1}


def test_fetch_result_count_mismatch_raises(fake_urlopen):
    fake_urlopen([{"r": 1}])
    with pytest.raises(ValueError, match="Expected 2 results, got 1"):
        mod.fetch(PTS)


def test_main_writes_gzip_file_under_dated_path(tmp_path, monkeypatch, capsys):
    when = datetime(2031, 3, 4, 5, 6, 7, tzinfo=timezone.utc)
    monkeypatch.setattr(mod, "points", lambda: PTS)
    monkeypatch.setattr(mod, "fetch", lambda pts: (when, [dict(p, raw={}) for p in pts]))
    monkeypatch.setattr(sys, "argv", ["archive-open-meteo.py", "--out", str(tmp_path)])
    mod.main()
    path = tmp_path / "2031/03/04/050607Z.json.gz"
    data = json.loads(gzip.decompress(path.read_bytes()))
    assert data["fetched_at"] == when.isoformat() and data["source"] == mod.URL
    assert [p["key"] for p in data["points"]] == [p["key"] for p in PTS]
    assert "2 points ->" in capsys.readouterr().out


@pytest.mark.parametrize("argv", [["--self-test"], []])
def test_main_self_test_paths_do_not_fetch(monkeypatch, capsys, tmp_path, argv):
    monkeypatch.setattr(mod, "fetch", lambda pts: pytest.fail("network must not be used"))
    monkeypatch.setattr(sys, "argv", ["archive-open-meteo.py", *argv])
    mod.main()
    assert "self-test ok" in capsys.readouterr().out
    assert list(tmp_path.iterdir()) == []


def test_main_rejects_unknown_argument(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["archive-open-meteo.py", "--bogus"])
    with pytest.raises(SystemExit) as e:
        mod.main()
    assert e.value.code == 2
