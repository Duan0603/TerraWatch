"""Fixtures for the HTTP API tests. Nothing here is autouse, so existing tests are unaffected."""
import psycopg2
import pytest
from fastapi.testclient import TestClient

from api_fakes import NOW, FakeSnapRepo, FakeTerrainRepo, BATXAT
from app import main
from app.pipeline.rainfall_processor import RainfallProcessor
from app.pipeline.terrain_repository import TerrainRepository


@pytest.fixture
def client():
    return TestClient(main.app, raise_server_exceptions=False)


@pytest.fixture
def frozen_rain(monkeypatch):
    """Pin RainfallProcessor.process_series to NOW so API tests never depend on the wall clock."""
    orig = RainfallProcessor.process_series
    monkeypatch.setattr(main.RainfallProcessor, "process_series",
                        staticmethod(lambda unit_id, open_meteo_data, as_of=None: orig(unit_id, open_meteo_data, NOW)))


@pytest.fixture
def snap_env(monkeypatch):
    repo = FakeSnapRepo()
    monkeypatch.setattr(main, "terrain_repo", FakeTerrainRepo(units=[BATXAT, {**BATXAT, "unit_id": "U2"}]))
    monkeypatch.setattr(main, "snapshot_repo", repo)
    return repo


def _db_url():
    return TerrainRepository().db_url


@pytest.fixture
def db():
    try:
        conn = psycopg2.connect(_db_url(), connect_timeout=3)
    except Exception as e:  # pragma: no cover
        pytest.skip(f"PostGIS not reachable: {type(e).__name__}")
    with conn.cursor() as cur:
        cur.execute("SELECT to_regclass('gis_schema.spatial_assessment_units'), "
                    "(SELECT count(*) FROM gis_schema.spatial_assessment_units WHERE unit_id='VN_LC_BATXAT_0001')")
        if not cur.fetchone()[1]:
            conn.close()
            pytest.skip("seed_v3_fixtures not loaded")
    yield conn
    conn.close()
