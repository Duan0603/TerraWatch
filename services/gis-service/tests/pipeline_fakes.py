"""Shared helpers for pipeline tests (no network, optional throwaway DB)."""
import uuid
from datetime import datetime, timezone

import psycopg2
import pytest
import requests

from app.pipeline.rainfall_repository import RainfallRepository

UTC = timezone.utc


class FakeResponse:
    def __init__(self, payload=None, status=200, json_error=None):
        self.payload, self.status_code, self.json_error = payload, status, json_error

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.exceptions.HTTPError(f"{self.status_code} error", response=self)

    def json(self):
        if self.json_error:
            raise self.json_error
        return self.payload


class Recorder:
    """Stands in for requests.get / Session.get: records calls, replays queued outcomes."""

    def __init__(self, *outcomes):
        self.outcomes, self.calls = list(outcomes), []

    def __call__(self, url, params=None, timeout=None, **kw):
        self.calls.append({"url": url, "params": params, "timeout": timeout, **kw})
        out = self.outcomes.pop(0) if len(self.outcomes) > 1 else self.outcomes[0]
        if isinstance(out, BaseException):
            raise out
        return out


def dt(*a):
    return datetime(*a, tzinfo=UTC)


def db_url():
    return RainfallRepository().db_url


def _db_reason():
    try:
        psycopg2.connect(db_url(), connect_timeout=2).close()
        return None
    except psycopg2.Error as e:
        return f"database not reachable: {str(e).splitlines()[0]}"


_REASON = _db_reason()
needs_db = pytest.mark.skipif(_REASON is not None, reason=_REASON or "")

POLY = ("ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY[ST_MakePoint(%(x)s,%(y)s),ST_MakePoint(%(x)s+0.01,%(y)s),"
        "ST_MakePoint(%(x)s+0.01,%(y)s+0.01),ST_MakePoint(%(x)s,%(y)s+0.01),ST_MakePoint(%(x)s,%(y)s)])),4326)")


class Db:
    """Throwaway rows with a unique per-test prefix; everything is deleted on teardown."""

    def __init__(self):
        self.prefix = "TWT_" + uuid.uuid4().hex[:10]
        self.conn = psycopg2.connect(db_url())
        self.conn.autocommit = True
        self.live_keys = []

    def unit(self, suffix="A", x=10.0, y=5.0, **cols):
        uid = f"{self.prefix}_{suffix}"
        cols = {"slope_avg": 10.0, "slope_max": 20.0, "elevation_avg": 100.0, "relief_m": 50.0,
                "dem_source": "TEST", **cols}
        names = ["unit_id", "unit_name", "admin_province", "admin_district", "geom", *cols]
        marks = ["%(uid)s", "%(uid)s", "'P'", "'D'", POLY, *[f"%({c})s" for c in cols]]
        with self.conn.cursor() as cur:
            cur.execute(f"INSERT INTO gis_schema.spatial_assessment_units ({','.join(names)}) "
                        f"VALUES ({','.join(marks)})", {"uid": uid, "x": x, "y": y, **cols})
        return uid

    def q(self, sql, params=None):
        with self.conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall() if cur.description else None

    def close(self):
        with self.conn.cursor() as cur:
            cur.execute("DELETE FROM gis_schema.spatial_assessment_units WHERE unit_id LIKE %s", (self.prefix + "%",))
            for k in self.live_keys:
                for t in ("live_rainfall_snapshots", "live_rainfall_history"):
                    try:
                        cur.execute(f"DELETE FROM gis_schema.{t} WHERE location_key=%s", (k,))
                    except psycopg2.errors.UndefinedTable:
                        pass
        self.conn.close()


@pytest.fixture
def db():
    d = Db()
    try:
        yield d
    finally:
        d.close()
