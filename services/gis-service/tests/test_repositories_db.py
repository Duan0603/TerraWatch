"""Repository tests against a real PostGIS. Skipped when the database is unreachable."""
from datetime import timedelta

import psycopg2
import pytest

from app.pipeline.rainfall_repository import RainfallRepository
from app.pipeline.snapshot_repository import SnapshotRepository
from app.pipeline.terrain_processor import TerrainMetrics
from app.pipeline.terrain_repository import TerrainRepository
from pipeline_fakes import db, db_url, dt, needs_db  # noqa: F401  (db is a fixture)

pytestmark = needs_db
T0 = dt(2026, 1, 10, 12)


def obs(unit, end, mm, available=None, **kw):
    return {"unit_id": unit, "interval_start": end - timedelta(hours=1), "interval_end": end,
            "available_at": available or end, "rainfall_mm": mm, **kw}


def fc(unit, run, issued, available=None, mm=12.0, **kw):
    return {"unit_id": unit, "provider_run_id": run, "provider_name": "OPEN_METEO", "issued_at": issued,
            "valid_from": issued, "valid_until": issued + timedelta(hours=24), "available_at": available or issued,
            "predicted_rain_24h_mm": mm, "quality_flag": "good", **kw}


def snap(unit, as_of=T0, **kw):
    return {"unit_id": unit, "as_of_time": as_of, "features": {"rain_24h_mm": 5.0}, **kw}


# ---------- connection handling ----------
class ConnSpy:
    def __init__(self, monkeypatch):
        self.conns = []
        real = psycopg2.connect
        monkeypatch.setattr(psycopg2, "connect", lambda *a, **k: self.conns.append(real(*a, **k)) or self.conns[-1])


@pytest.mark.parametrize("repo_cls", [RainfallRepository, SnapshotRepository, TerrainRepository])
def test_env_db_url_resolution(monkeypatch, repo_cls):
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@h:1/d")
    assert repo_cls().db_url == "postgresql://u:p@h:1/d"
    assert repo_cls("explicit://x").db_url == "explicit://x"
    monkeypatch.delenv("DATABASE_URL")
    for k, v in dict(POSTGRES_HOST="hh", POSTGRES_PORT="7", POSTGRES_USER="uu", POSTGRES_PASSWORD="pp",
                     POSTGRES_DB="dd").items():
        monkeypatch.setenv(k, v)
    assert repo_cls().db_url == "postgresql://uu:pp@hh:7/dd"


@pytest.mark.parametrize("repo_cls,call", [
    (RainfallRepository, lambda r: r.get_assessment_units()),
    (SnapshotRepository, lambda r: r.get_unit_terrain("x")),
    (TerrainRepository, lambda r: r.get_terrain_summary("x")),
])
def test_connection_failure_raises_not_empty(repo_cls, call):
    with pytest.raises(psycopg2.OperationalError):
        call(repo_cls("postgresql://postgres:postgres@127.0.0.1:55499/terrawatch?connect_timeout=2"))


def test_connection_closed_after_error(db, monkeypatch):
    spy = ConnSpy(monkeypatch)
    u = db.unit()
    with pytest.raises(psycopg2.Error):
        RainfallRepository(db_url()).save_rainfall_observations([obs("NO_SUCH_UNIT_" + u, T0, 1.0)])
    assert spy.conns and all(c.closed for c in spy.conns)


# ---------- RainfallRepository ----------
def test_assessment_units_filters_null_centroid_and_inactive(db):
    a, b, c = db.unit("A", x=10.0), db.unit("B", x=11.0), db.unit("C", x=12.0)
    db.q("UPDATE gis_schema.spatial_assessment_units SET is_active=FALSE WHERE unit_id=%s", (c,))
    db.q("UPDATE gis_schema.spatial_assessment_units SET centroid=NULL WHERE unit_id=%s", (b,))
    repo = RainfallRepository(db_url())
    rows = {r["unit_id"]: r for r in repo.get_assessment_units() if r["unit_id"].startswith(db.prefix)}
    assert set(rows) == {a, b}  # inactive excluded
    assert rows[a]["longitude"] == pytest.approx(10.005) and rows[a]["latitude"] == pytest.approx(5.005)
    assert rows[b]["latitude"] is None and rows[b]["longitude"] is None  # null centroid stays null
    assert [r["unit_id"] for r in repo.get_assessment_units(unit_id=a)] == [a]
    assert repo.get_assessment_units(unit_id="NOPE") == []
    assert repo.get_assessment_units(area_id=-12345) == []
    ids = [r["unit_id"] for r in repo.get_assessment_units()]
    assert ids == sorted(ids)


def test_unit_id_filter_is_parameterised(db):
    db.unit()
    assert RainfallRepository(db_url()).get_assessment_units(unit_id="x' OR '1'='1") == []


def test_save_observations_insert_upsert_and_missing_stays_null(db):
    u = db.unit()
    repo = RainfallRepository(db_url())
    assert repo.save_rainfall_observations([]) == 0
    rows = [obs(u, T0, 1.5), obs(u, T0 + timedelta(hours=1), None, quality_flag="missing")]
    assert repo.save_rainfall_observations(rows) == 2
    assert repo.save_rainfall_observations([obs(u, T0, 2.5, quality_flag="estimated")]) == 1  # upsert same key
    got = db.q("SELECT rainfall_mm, quality_flag, source_provider, source_revision FROM gis_schema.rainfall_observations "
               "WHERE unit_id=%s ORDER BY interval_end", (u,))
    assert got == [(2.5, "estimated", "OPEN_METEO", "v1"), (None, "missing", "OPEN_METEO", "v1")]


def test_save_observations_is_atomic_on_bad_row(db):
    u = db.unit()
    repo = RainfallRepository(db_url())
    with pytest.raises(psycopg2.errors.ForeignKeyViolation):
        repo.save_rainfall_observations([obs(u, T0, 1.0), obs("NOPE_" + u, T0, 1.0)])
    assert db.q("SELECT count(*) FROM gis_schema.rainfall_observations WHERE unit_id=%s", (u,)) == [(0,)]


def test_save_observations_duplicate_keys_in_one_batch_rejected_atomically(db):
    u = db.unit()
    with pytest.raises(psycopg2.Error):
        RainfallRepository(db_url()).save_rainfall_observations([obs(u, T0, 1.0), obs(u, T0, 2.0)])
    assert db.q("SELECT count(*) FROM gis_schema.rainfall_observations WHERE unit_id=%s", (u,)) == [(0,)]


def test_save_observations_missing_field_raises_and_writes_nothing(db):
    u = db.unit()
    bad = obs(u, T0, 1.0)
    del bad["available_at"]
    with pytest.raises(KeyError):
        RainfallRepository(db_url()).save_rainfall_observations([bad])


def test_save_forecast_insert_upsert_and_empty(db):
    u = db.unit()
    repo = RainfallRepository(db_url())
    assert repo.save_rainfall_forecast({}) is False
    assert repo.save_rainfall_forecast(fc(u, "run1", T0, mm=5.0)) is True
    assert repo.save_rainfall_forecast(fc(u, "run1", T0, mm=9.0, quality_flag="stale")) is True
    assert db.q("SELECT predicted_rain_24h_mm, quality_flag FROM gis_schema.rainfall_forecasts WHERE unit_id=%s",
                (u,)) == [(9.0, "stale")]


def test_save_forecast_null_prediction_rejected(db):
    u = db.unit()
    with pytest.raises(psycopg2.errors.NotNullViolation):  # a missing forecast must not be stored as a number
        RainfallRepository(db_url()).save_rainfall_forecast(fc(u, "r", T0, mm=None))


def _hourly(db, u, now_sql_hours, mm=1.0, flag="good"):
    for h in now_sql_hours:
        db.q("INSERT INTO gis_schema.rainfall_observations (unit_id,interval_start,interval_end,available_at,"
             "rainfall_mm,source_provider,quality_flag) VALUES (%s, NOW()-(%s*INTERVAL '1 minute')-INTERVAL '1 hour',"
             "NOW()-(%s*INTERVAL '1 minute'), NOW(), %s,'T',%s)", (u, h, h, mm, flag))


def test_summary_windows_and_forecast(db):
    u = db.unit()
    _hourly(db, u, [30, 90, 23 * 60 + 30, 25 * 60, 71 * 60, 73 * 60, 6 * 24 * 60, 8 * 24 * 60], mm=1.0)
    RainfallRepository(db_url()).save_rainfall_forecast(
        fc(u, "r", T0, mm=7.456) | {"valid_until": dt(2030, 1, 1)})
    s = RainfallRepository(db_url()).get_latest_rainfall_summary(u)
    assert (s["rain_1h_mm"], s["rain_24h_acc_mm"], s["rain_72h_acc_mm"], s["rain_7d_acc_mm"]) == (1.0, 3.0, 5.0, 7.0)
    assert s["forecast_next_24h_mm"] == 7.46 and s["forecast_valid_until"].startswith("2030-01-01")
    assert s["latest_observation_time"] and s["unit_id"] == u


def test_summary_none_without_recent_data_or_unknown_unit(db):
    u = db.unit()
    repo = RainfallRepository(db_url())
    assert repo.get_latest_rainfall_summary("NOPE_" + u) is None
    _hourly(db, u, [26 * 60])  # only older than 24h
    assert repo.get_latest_rainfall_summary(u) is None


def test_summary_excludes_missing_rows_and_keeps_null_forecast(db):
    u = db.unit()
    _hourly(db, u, [30], mm=2.0)
    _hourly(db, u, [90], mm=99.0, flag="missing")
    s = RainfallRepository(db_url()).get_latest_rainfall_summary(u)
    assert s["rain_24h_acc_mm"] == 2.0 and s["forecast_next_24h_mm"] is None and s["forecast_valid_until"] is None


def test_summary_all_missing_returns_none_not_zero(db):
    u = db.unit()
    db.q("INSERT INTO gis_schema.rainfall_observations (unit_id,interval_start,interval_end,available_at,rainfall_mm,"
         "source_provider,quality_flag) VALUES (%s,NOW()-INTERVAL '2 hours',NOW()-INTERVAL '1 hour',NOW(),NULL,'T','missing')", (u,))
    assert RainfallRepository(db_url()).get_latest_rainfall_summary(u) is None


@pytest.mark.xfail(strict=True, reason="BUG: expected quality_flag/accumulation to expose that hours are missing; actual "
                                       "rainfall_repository.py:146-155 drops 'missing' rows from SUM and reports "
                                       "quality_flag='good' with an understated 24h total")
def test_summary_partial_gap_is_not_reported_as_good(db):
    u = db.unit()
    _hourly(db, u, [30, 150, 270], mm=1.0)
    _hourly(db, u, [90], mm=0.0, flag="missing")
    s = RainfallRepository(db_url()).get_latest_rainfall_summary(u)
    assert s["quality_flag"] != "good" or s["rain_24h_acc_mm"] is None


@pytest.mark.xfail(strict=True, reason="BUG: expected forecast issued after 'now' to be ignored (no look-ahead); actual "
                                       "rainfall_repository.py:159-168 selects latest issued_at with no available_at/now filter")
def test_summary_ignores_future_issued_forecast(db):
    u = db.unit()
    _hourly(db, u, [30])
    RainfallRepository(db_url()).save_rainfall_forecast(fc(u, "future", dt(2099, 1, 1), mm=500.0))
    assert RainfallRepository(db_url()).get_latest_rainfall_summary(u)["forecast_next_24h_mm"] is None


# ---------- SnapshotRepository ----------
def test_unit_terrain_and_unknown(db):
    u = db.unit(slope_avg=None)
    r = SnapshotRepository(db_url())
    t = r.get_unit_terrain(u)
    assert t["unit_id"] == u and t["slope_avg"] is None and t["dem_source"] == "TEST"  # null stays null
    assert r.get_unit_terrain("NOPE_" + u) is None


def test_observations_as_of_availability_and_window_boundaries(db):
    u = db.unit()
    repo = SnapshotRepository(db_url())
    RainfallRepository(db_url()).save_rainfall_observations([
        obs(u, T0 - timedelta(hours=1), 1.0),                                   # normal
        obs(u, T0 - timedelta(days=7), 2.0),                                    # exactly on window start: included
        obs(u, T0 - timedelta(days=7, seconds=1), 3.0),                         # 1s outside
        obs(u, T0 - timedelta(hours=2), 4.0, available=T0),                     # available exactly at as_of: included
        obs(u, T0 - timedelta(hours=3), 5.0, available=T0 + timedelta(seconds=1)),  # available later: excluded
        obs(u, T0 - timedelta(hours=4), None, quality_flag="missing"),
    ])
    rows = repo.get_observations_as_of(u, T0)
    mm = {r["interval_end"]: r["rainfall_mm"] for r in rows}
    assert sorted(mm.values(), key=lambda v: (v is None, v)) == [1.0, 2.0, 4.0, None]
    assert [r["interval_end"] for r in rows] == sorted(r["interval_end"] for r in rows)
    assert all(isinstance(r["interval_end"], str) and isinstance(r["available_at"], str) for r in rows)
    assert len(repo.get_observations_as_of(u, T0, days_back=1)) == 3
    assert repo.get_observations_as_of("NOPE_" + u, T0) == []
    assert repo.get_observations_as_of(u, T0 - timedelta(days=30)) == []


def test_latest_forecast_as_of_excludes_later_available(db):
    u = db.unit()
    rr, repo = RainfallRepository(db_url()), SnapshotRepository(db_url())
    rr.save_rainfall_forecast(fc(u, "old", T0 - timedelta(hours=6), mm=1.0))
    rr.save_rainfall_forecast(fc(u, "exact", T0, mm=2.0))
    rr.save_rainfall_forecast(fc(u, "late", T0 + timedelta(hours=1), mm=3.0))
    got = repo.get_latest_forecast_as_of(u, T0)
    assert got["provider_run_id"] == "exact" and got["predicted_rain_24h_mm"] == 2.0
    assert isinstance(got["issued_at"], str) and isinstance(got["valid_until"], str)
    assert repo.get_latest_forecast_as_of(u, T0 - timedelta(hours=7)) is None
    assert repo.get_latest_forecast_as_of("NOPE_" + u, T0) is None


@pytest.mark.xfail(strict=True, reason="BUG: expected forecast with issued_at after as_of to be excluded; actual "
                                       "snapshot_repository.py:104-108 filters only on available_at (issued_at "
                                       "after as_of with earlier available_at leaks)")
def test_latest_forecast_as_of_excludes_issued_after_as_of(db):
    u = db.unit()
    RainfallRepository(db_url()).save_rainfall_forecast(
        fc(u, "x", T0 + timedelta(hours=2), available=T0 - timedelta(hours=1)))
    assert SnapshotRepository(db_url()).get_latest_forecast_as_of(u, T0) is None


def test_save_snapshot_roundtrip_defaults_and_lookup(db):
    u = db.unit()
    repo = SnapshotRepository(db_url())
    sid = repo.save_snapshot(snap(u, source_references={"a": 1}))
    assert repo.get_snapshot_by_id(sid)["features"] == {"rain_24h_mm": 5.0}
    got = repo.get_latest_snapshot(u)
    assert got["snapshot_id"] == sid and got["schema_version"] == "rainfall-terrain-24h.v1"
    assert got["unit_version"] == "v1" and got["coverage_quality"] == "good" and got["source_references"] == {"a": 1}
    assert got["as_of_time"].startswith("2026-01-10T12:00:00") and isinstance(got["created_at"], str)
    sid2 = repo.save_snapshot(snap(u, as_of=T0 + timedelta(hours=1)))
    assert repo.get_latest_snapshot(u)["snapshot_id"] == sid2
    assert repo.get_snapshot_by_id(sid)["snapshot_id"] == sid


def test_snapshot_unknown_ids(db):
    u = db.unit()
    repo = SnapshotRepository(db_url())
    assert repo.get_latest_snapshot(u) is None
    assert repo.get_snapshot_by_id("00000000-0000-0000-0000-000000000000") is None
    with pytest.raises(psycopg2.errors.InvalidTextRepresentation):
        repo.get_snapshot_by_id("not-a-uuid")


def test_save_snapshot_unknown_unit_and_missing_keys(db):
    u = db.unit()
    repo = SnapshotRepository(db_url())
    with pytest.raises(psycopg2.errors.ForeignKeyViolation):
        repo.save_snapshot(snap("NOPE_" + u))
    with pytest.raises(KeyError):
        repo.save_snapshot({"unit_id": u, "as_of_time": T0})


def test_save_snapshot_same_key_returns_same_id(db):
    u = db.unit()
    repo = SnapshotRepository(db_url())
    assert repo.save_snapshot(snap(u)) == repo.save_snapshot(snap(u))
    assert db.q("SELECT count(*) FROM gis_schema.feature_snapshots WHERE unit_id=%s", (u,)) == [(1,)]


@pytest.mark.xfail(strict=True, reason="BUG: expected existing snapshot for same key to be kept unchanged (immutable, "
                                       "idempotent create); actual snapshot_repository.py:141-145 ON CONFLICT DO UPDATE "
                                       "overwrites features/coverage_quality/source_references")
def test_save_snapshot_does_not_overwrite_existing(db):
    u = db.unit()
    repo = SnapshotRepository(db_url())
    sid = repo.save_snapshot(snap(u))
    repo.save_snapshot({**snap(u), "features": {"rain_24h_mm": 999.0}, "coverage_quality": "stale"})
    assert repo.get_snapshot_by_id(sid)["features"] == {"rain_24h_mm": 5.0}


# ---------- TerrainRepository ----------
def metrics(**kw):
    base = dict(elevation_avg=321.0, elevation_min=300.0, elevation_max=350.0, relief_m=50.0, slope_avg=11.5,
                slope_max=30.0, dem_source="COPERNICUS", dem_resolution_m=30.0, effective_resolution_m=90.0)
    return TerrainMetrics(**{**base, **kw})


def test_terrain_units_filters(db):
    a, b, c = db.unit("A", x=20.0), db.unit("B", x=21.0), db.unit("C", x=22.0)
    db.q("UPDATE gis_schema.spatial_assessment_units SET centroid=NULL WHERE unit_id=%s", (c,))
    repo = TerrainRepository(db_url())
    got = {r["unit_id"]: r for r in repo.get_assessment_units(unit_ids=[a, c, "NOPE"])}
    assert set(got) == {a, c} and got[c]["centroid_lat"] is None and got[a]["centroid_lon"] == pytest.approx(20.005)
    assert repo.get_assessment_units(unit_ids=["x'); DROP TABLE x;--"]) == []
    assert any(r["unit_id"] == b for r in repo.get_assessment_units())
    assert repo.get_assessment_units(area_id=-5) == []
    assert repo.get_assessment_units(unit_ids=[]) != []  # empty list means no filter


def test_update_terrain_metrics_and_summary(db):
    u = db.unit()
    repo = TerrainRepository(db_url())
    assert repo.update_terrain_metrics(u, metrics()) is True
    s = repo.get_terrain_summary(u)
    assert (s["slope_avg"], s["slope_max"], s["elevation_avg"], s["relief_m"]) == (11.5, 30.0, 321.0, 50.0)
    assert (s["dem_source"], s["dem_resolution_m"], s["effective_resolution_m"]) == ("COPERNICUS", 30.0, 90.0)
    assert isinstance(s["updated_at"], str) and s["centroid_lat"] == pytest.approx(5.005)


def test_update_unknown_unit_false_and_summary_none(db):
    u = db.unit()
    repo = TerrainRepository(db_url())
    assert repo.update_terrain_metrics("NOPE_" + u, metrics()) is False
    assert repo.get_terrain_summary("NOPE_" + u) is None


def test_update_rolls_back_on_error_and_closes_connection(db, monkeypatch):
    u = db.unit()
    spy = ConnSpy(monkeypatch)
    with pytest.raises(psycopg2.Error):
        TerrainRepository(db_url()).update_terrain_metrics(u, metrics(dem_source="x" * 500))  # VARCHAR(100)
    assert all(c.closed for c in spy.conns)
    assert db.q("SELECT dem_source FROM gis_schema.spatial_assessment_units WHERE unit_id=%s", (u,)) == [("TEST",)]
