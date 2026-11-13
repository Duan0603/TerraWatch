"""Fakes and constants for tests/test_api*.py (in-memory stand-ins for repositories and provider clients)."""
from datetime import datetime, timedelta, timezone

import numpy as np
import psycopg2

from app.pipeline.rainfall_client import RainfallClientError  # noqa: F401

NOW = datetime(2031, 3, 4, 5, 0, tzinfo=timezone.utc)  # frozen "current hour"
BATXAT = {"unit_id": "VN_LC_BATXAT_0001", "unit_name": "Unit 1", "latitude": 22.525, "longitude": 103.855,
          "centroid_lat": 22.525, "centroid_lon": 103.855}
SECRET = "password=hunter2 host=10.0.0.9"


def om_series(as_of=NOW, past_hours=168, future_hours=24, value=1.0):
    n0 = as_of - timedelta(hours=past_hours - 1)
    times = [(n0 + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M") for i in range(past_hours + future_hours)]
    return {"hourly": {"time": times, "precipitation": [value] * len(times)}}


class FakeRainRepo:
    def __init__(self, units=(BATXAT,), summary=None, fail=False):
        self.units, self.summary, self.fail = list(units), summary, fail
        self.obs, self.fcst, self.queries = [], [], []

    def get_assessment_units(self, area_id=None, unit_id=None):
        self.queries.append((area_id, unit_id))
        if self.fail:
            raise psycopg2.OperationalError(SECRET)
        return [u for u in self.units if unit_id in (None, u["unit_id"])]

    def get_latest_rainfall_summary(self, unit_id):
        if self.fail:
            raise psycopg2.OperationalError(SECRET)
        return self.summary

    def save_rainfall_observations(self, obs):
        self.obs.append(obs)
        return len(obs)

    def save_rainfall_forecast(self, f):
        self.fcst.append(f)
        return True


class FakeRainClient:
    def __init__(self, data=None, exc=None):
        self.data, self.exc, self.calls = data if data is not None else om_series(), exc, []

    def fetch_rainfall_series(self, latitude, longitude, past_days=7, forecast_days=2):
        self.calls.append((latitude, longitude, past_days, forecast_days))
        if self.exc:
            raise self.exc
        return self.data


class FakeLive:
    def __init__(self, read=None, map_=None, exc=None):
        self._read, self._map, self.exc = read, map_, exc
        self.state = {"enabled": False, "interval_seconds": 3600, "running": False,
                      "last_cycle_at": None, "last_error": None, "locations": 0}
        self.read_args = []

    def read(self, lat, lon):
        self.read_args.append((lat, lon))
        if self.exc:
            raise self.exc
        return self._read

    def map_collection(self):
        if self.exc:
            raise self.exc
        return self._map


class FakeTerrainRepo:
    def __init__(self, units=(BATXAT,), summary=None, fail=False, update_ok=True):
        self.units, self.summary, self.fail, self.update_ok = list(units), summary, fail, update_ok
        self.updates, self.queries = [], []

    def get_assessment_units(self, area_id=None, unit_ids=None):
        self.queries.append((area_id, unit_ids))
        if self.fail:
            raise psycopg2.OperationalError(SECRET)
        return self.units

    def update_terrain_metrics(self, unit_id, metrics):
        self.updates.append((unit_id, metrics))
        return self.update_ok

    def get_terrain_summary(self, unit_id):
        if self.fail:
            raise psycopg2.OperationalError(SECRET)
        return self.summary


class FakeElevClient:
    def __init__(self, source="COPERNICUS_GLO_30", exc=None):
        self.source, self.exc, self.calls = source, exc, []

    def fetch_grid_around_point(self, center_lat, center_lon, grid_size, step_deg):
        self.calls.append((center_lat, center_lon, grid_size, step_deg))
        if self.exc:
            raise self.exc
        yy, xx = np.mgrid[0:grid_size, 0:grid_size]
        return 700.0 + yy * 10.0 + xx * 5.0, step_deg, self.source


class FakeSnapRepo:
    def __init__(self, fail=False, latest=None, by_id=None):
        self.fail, self.latest, self.by_id = fail, latest, by_id
        self.saved, self.asof_seen = [], []

    def _chk(self):
        if self.fail:
            raise psycopg2.OperationalError(SECRET)

    def get_unit_terrain(self, unit_id):
        self._chk()
        return {"slope_avg": 30.0, "slope_max": 45.0, "elevation_avg": 700.0, "relief_m": 100.0, "dem_source": "SRTM_30M"}

    def get_observations_as_of(self, unit_id, as_of_time, days_back=7):
        self.asof_seen.append(as_of_time)
        return [{"interval_end": (as_of_time - timedelta(hours=i)).isoformat(),
                 "available_at": (as_of_time - timedelta(hours=i)).isoformat(),
                 "rainfall_mm": 1.0, "source_provider": "OPEN_METEO"} for i in range(168)]

    def get_latest_forecast_as_of(self, unit_id, as_of_time):
        return {"available_at": (as_of_time - timedelta(hours=1)).isoformat(), "predicted_rain_24h_mm": 12.5,
                "provider_run_id": "RUN1"}

    def save_snapshot(self, d):
        self._chk()
        self.saved.append(d)
        return f"00000000-0000-0000-0000-{len(self.saved):012d}"

    def get_latest_snapshot(self, unit_id):
        self._chk()
        return self.latest

    def get_snapshot_by_id(self, sid):
        self._chk()
        return self.by_id
