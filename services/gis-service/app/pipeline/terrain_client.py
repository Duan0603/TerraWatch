import logging
import time
from typing import List, Optional, Tuple
import numpy as np
import requests

logger = logging.getLogger("TerrainClient")


class OpenMeteoElevationClient:
    """
    Client for retrieving Digital Elevation Model (DEM) data from Open-Meteo Elevation API
    (backed by Copernicus DEM 30m / 90m global datasets).
    """

    ELEVATION_API_URL = "https://api.open-meteo.com/v1/elevation"

    def __init__(self, timeout_sec: int = 10, max_retries: int = 3):
        self.timeout_sec = timeout_sec
        self.max_retries = max_retries

    def fetch_elevations_batch(self, lats: List[float], lons: List[float]) -> List[float]:
        """
        Queries elevation in meters for a batch of coordinates.
        """
        if len(lats) != len(lons):
            raise ValueError("lats and lons must have identical length.")

        lat_str = ",".join(f"{lat:.5f}" for lat in lats)
        lon_str = ",".join(f"{lon:.5f}" for lon in lons)
        params = {"latitude": lat_str, "longitude": lon_str}

        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                resp = requests.get(self.ELEVATION_API_URL, params=params, timeout=self.timeout_sec)
                resp.raise_for_status()
                data = resp.json()

                if "elevation" in data and isinstance(data["elevation"], list):
                    return [float(e) if e is not None else -9999.0 for e in data["elevation"]]

                raise ValueError(f"Malformed elevation response: {data}")

            except (requests.RequestException, ValueError) as ex:
                last_error = ex
                logger.warning("Attempt %d failed to query Open-Meteo Elevation: %s", attempt, ex)
                if attempt < self.max_retries:
                    time.sleep(1.0 * (2 ** (attempt - 1)))

        logger.error("Failed to query Open-Meteo Elevation after %d attempts: %s", self.max_retries, last_error)
        raise RuntimeError(f"Open-Meteo Elevation query failed: {last_error}")

    def fetch_grid_around_point(
        self,
        center_lat: float,
        center_lon: float,
        grid_size: int = 5,
        step_deg: float = 0.0003
    ) -> Tuple[np.ndarray, float, str]:
        """
        Constructs a regular grid around (center_lat, center_lon) and queries elevation.
        Returns (grid_array, step_deg, dem_source).
        """
        # Ensure odd grid size so centroid is in center and matrix reshaping succeeds
        if grid_size % 2 == 0:
            grid_size += 1

        half = grid_size // 2
        lats_list: List[float] = []
        lons_list: List[float] = []

        # From North to South (row), West to East (col)
        for r in range(-half, half + 1):
            for c in range(-half, half + 1):
                pt_lat = center_lat - r * step_deg
                pt_lon = center_lon + c * step_deg
                lats_list.append(pt_lat)
                lons_list.append(pt_lon)

        try:
            elevations = self.fetch_elevations_batch(lats_list, lons_list)
            grid = np.array(elevations, dtype=np.float64).reshape((grid_size, grid_size))
            return grid, step_deg, "COPERNICUS_GLO_30"
        except Exception as ex:
            logger.warning("Live DEM fetch failed (%s). Generating fallback DEM grid.", ex)
            fallback_grid = self._generate_fallback_grid(center_lat, center_lon, grid_size, step_deg)
            return fallback_grid, step_deg, "FALLBACK_SYNTHETIC"

    def _generate_fallback_grid(
        self,
        center_lat: float,
        center_lon: float,
        grid_size: int,
        step_deg: float
    ) -> np.ndarray:
        """
        Generates realistic mountainous terrain elevation based on Lao Cai regional baselines
        (500m - 1800m) with high slope if network is offline.
        """
        # Seeded deterministically by coordinates
        seed = int((abs(center_lat) + abs(center_lon)) * 10000) % 100000
        rng = np.random.RandomState(seed)
        base_elevation = 750.0 + (center_lat - 22.0) * 800.0

        grid = np.zeros((grid_size, grid_size), dtype=np.float64)
        for r in range(grid_size):
            for c in range(grid_size):
                slope_offset = (r * 18.5) + (c * 12.0)
                noise = rng.normal(0, 3.5)
                grid[r, c] = round(base_elevation + slope_offset + noise, 2)
        return grid
