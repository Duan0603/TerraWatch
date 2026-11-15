"""scripts/snapshot-live-gru.py: snapshot validation and one-shot archive run with urlopen faked (no network)."""
import importlib.util
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "snapshot-live-gru.py"
spec = importlib.util.spec_from_file_location("snapshot_live_gru", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

ISSUE = datetime(2026, 11, 13, tzinfo=timezone.utc)


def snapshot(**kw):
    data = {"as_of": ISSUE.isoformat(), "fetched_at": (ISSUE + timedelta(minutes=20)).isoformat(),
            "hourly": [{"interval_end": (ISSUE + timedelta(hours=h)).isoformat(), "mm": 1.0} for h in range(-167, 25)],
            "history": {str(h): {"valid_hours": h, "mm": float(h)} for h in (24, 72, 168)},
            "forecast_24h": {"valid_hours": 24, "mm": 24.0}}
    data.update(kw)
    return {"data": data}


# ---------------------------------------------------------------- stamp / inspect_snapshot
def test_stamp_parses_z_suffix():
    assert mod.stamp("2026-11-13T00:00:00Z") == ISSUE


def test_stamp_rejects_naive():
    with pytest.raises(ValueError, match="Timezone required"):
        mod.stamp("2026-11-13T00:00:00")


def test_inspect_valid_snapshot():
    r = mod.inspect_snapshot(snapshot())
    assert r["history_hours"] == 168 and r["forecast_hours"] == 24
    assert r["cache_fetched_after_issue_seconds"] == 1200
    assert r["historical_availability_verified"] is False and r["provider_run_issued_at"] is None


def test_inspect_passes_through_provider_run():
    assert mod.inspect_snapshot(snapshot(provider_run_issued_at="2026-11-12T18:00:00Z"))["provider_run_issued_at"] \
        == "2026-11-12T18:00:00Z"


@pytest.mark.parametrize("bad", [None, float("nan"), float("inf"), -1])
def test_inspect_rejects_invalid_hour_value(bad):
    s = snapshot()
    s["data"]["hourly"][0]["mm"] = bad
    with pytest.raises(ValueError, match="Incomplete or invalid"):
        mod.inspect_snapshot(s)


def test_inspect_rejects_missing_hour():
    s = snapshot()
    del s["data"]["hourly"][50]
    with pytest.raises(ValueError, match="Incomplete or invalid"):
        mod.inspect_snapshot(s)


def test_inspect_rejects_duplicate_interval():
    s = snapshot()
    s["data"]["hourly"].append(dict(s["data"]["hourly"][0]))
    with pytest.raises(ValueError, match="Duplicate rainfall interval"):
        mod.inspect_snapshot(s)


def test_inspect_rejects_history_sum_mismatch():
    s = snapshot()
    s["data"]["history"]["72"]["mm"] = 70.0
    with pytest.raises(ValueError, match="History sum"):
        mod.inspect_snapshot(s)


def test_inspect_rejects_wrong_valid_hours_label():
    s = snapshot()
    s["data"]["history"]["24"]["valid_hours"] = 23
    with pytest.raises(ValueError, match="History sum"):
        mod.inspect_snapshot(s)


def test_inspect_rejects_forecast_sum_mismatch():
    s = snapshot()
    s["data"]["forecast_24h"]["mm"] = 20.0
    with pytest.raises(ValueError, match="Forecast sum"):
        mod.inspect_snapshot(s)


def test_inspect_missing_key_raises_keyerror():
    with pytest.raises(KeyError):
        mod.inspect_snapshot({"data": {}})


# ---------------------------------------------------------------- main
def test_main_self_test(monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["x", "--self-test"])
    mod.main()
    assert "self-checks passed" in capsys.readouterr().out


class Resp:
    def __init__(self, raw):
        self.raw = raw

    def read(self):
        return self.raw

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def fake_api(monkeypatch, map_features, per_key):
    urls = []

    def urlopen(url, timeout=None):
        urls.append(url)
        if url.endswith("/map"):
            return Resp(json.dumps({"features": map_features}).encode())
        for key, payload in per_key.items():
            lat, lon = key.split(",")
            if f"latitude={float(lat)}" in url and f"longitude={float(lon)}" in url:
                if isinstance(payload, Exception):
                    raise payload
                return Resp(json.dumps(payload).encode())
        raise AssertionError(url)
    monkeypatch.setattr(mod, "urlopen", urlopen)
    return urls


def run_main(monkeypatch, tmp_path, *extra):
    monkeypatch.setattr(sys, "argv", ["x", "--base-url", "http://gis.test/", "--output", str(tmp_path), *extra])
    mod.main()


def manifest_of(tmp_path):
    (batch,) = list(tmp_path.iterdir())
    return batch, json.loads((batch / "manifest.json").read_text(encoding="utf-8"))


def test_main_archives_valid_location(monkeypatch, tmp_path, capsys):
    urls = fake_api(monkeypatch, [{"properties": {"key": "22.1202,104.5278"}}, {"properties": {"key": "22.1202,104.5278"}}],
                    {"22.1202,104.5278": snapshot()})
    run_main(monkeypatch, tmp_path)
    batch, m = manifest_of(tmp_path)
    assert urls[0] == "http://gis.test/api/v1/gis/rainfall/live/map"  # trailing slash stripped
    assert len(urls) == 2                                              # duplicate keys fetched once
    assert (batch / "map.json").exists()
    (entry,) = m["entries"]
    assert entry["key"] == "22.1202,104.5278" and (batch / entry["file"]).read_bytes()
    assert entry["validation"]["history_hours"] == 168 and len(entry["sha256"]) == 64
    assert m["experimental"] is True and m["calibrated_probability"] is False and m["operational_alert"] is False
    out = json.loads(capsys.readouterr().out)
    assert (out["locations"], out["saved"], out["valid"]) == (1, 1, 1)


def test_main_invalid_payload_is_saved_but_exits_1(monkeypatch, tmp_path, capsys):
    bad = snapshot()
    bad["data"]["forecast_24h"]["mm"] = 1.0
    fake_api(monkeypatch, [{"properties": {"key": "1.0,2.0"}}], {"1.0,2.0": bad})
    with pytest.raises(SystemExit) as e:
        run_main(monkeypatch, tmp_path)
    assert e.value.code == 1
    batch, m = manifest_of(tmp_path)
    assert m["entries"][0]["validation_error"] == "INCOMPLETE_OR_INVALID_WEATHER_PAYLOAD"
    assert "file" in m["entries"][0]
    assert json.loads(capsys.readouterr().out)["saved"] == 1


def test_main_one_location_failing_keeps_the_others_and_exits_1(monkeypatch, tmp_path):
    fake_api(monkeypatch, [{"properties": {"key": "1.0,2.0"}}, {"properties": {"key": "3.0,4.0"}}],
             {"1.0,2.0": OSError("http://u:secret@host"), "3.0,4.0": snapshot()})
    with pytest.raises(SystemExit) as e:
        run_main(monkeypatch, tmp_path)
    assert e.value.code == 1
    batch, m = manifest_of(tmp_path)
    failed, ok = m["entries"]
    assert failed == {"key": "1.0,2.0", "error_type": "OSError"}  # no message/URL stored
    assert "secret" not in (batch / "manifest.json").read_text(encoding="utf-8")
    assert "validation" in ok


def test_main_map_failure_propagates_and_writes_nothing(monkeypatch, tmp_path):
    def boom(url, timeout=None):
        raise OSError("down")
    monkeypatch.setattr(mod, "urlopen", boom)
    with pytest.raises(OSError):
        run_main(monkeypatch, tmp_path)
    assert list(tmp_path.iterdir()) == []
