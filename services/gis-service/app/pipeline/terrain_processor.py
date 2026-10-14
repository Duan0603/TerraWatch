import math
from dataclasses import dataclass
from typing import List, Optional, Tuple
import numpy as np


@dataclass
class TerrainMetrics:
    elevation_avg: float
    elevation_min: float
    elevation_max: float
    relief_m: float
    slope_avg: float
    slope_max: float
    dem_source: str = "SRTM_30M"
    dem_resolution_m: float = 30.0
    effective_resolution_m: float = 1000.0
    valid_cell_count: int = 0


class TerrainProcessor:
    """
    Terrain analysis engine calculating elevation, relief, and slope metrics
    over spatial assessment units with metric coordinate transformation.
    """

    WGS84_A = 6378137.0  # Semi-major axis in meters
    WGS84_B = 6356752.314245  # Semi-minor axis in meters

    def degrees_to_meters_lat(self, deg: float, lat: float = 22.5) -> float:
        """
        Converts latitude degrees to meters using WGS-84 ellipsoid approximation.
        1 degree of latitude varies from ~110.574 km at equator to ~111.694 km at poles.
        Around Northern Vietnam (Lao Cai ~22.5N), 1 deg latitude ~= 110,750 meters.
        """
        rad = math.radians(lat)
        # Meridian distance formula
        m_per_deg = 111132.92 - 559.82 * math.cos(2 * rad) + 1.175 * math.cos(4 * rad)
        return float(deg * m_per_deg)

    def degrees_to_meters_lon(self, deg: float, lat: float = 22.5) -> float:
        """
        Converts longitude degrees to meters at a given latitude.
        Around Lao Cai (22.5N), 1 deg longitude ~= 102,800 meters.
        """
        rad = math.radians(lat)
        # Parallel distance formula
        p_per_deg = (math.pi / 180.0) * self.WGS84_A * math.cos(rad) / math.sqrt(
            1.0 - (1.0 - (self.WGS84_B / self.WGS84_A) ** 2) * (math.sin(rad) ** 2)
        )
        return float(deg * p_per_deg)

    def compute_metrics_from_grid(
        self,
        elevation_grid: np.ndarray,
        center_lat: float,
        step_deg: float,
        dem_source: str = "SRTM_30M",
        nodata_values: Optional[List[float]] = None
    ) -> TerrainMetrics:
        """
        Calculates terrain metrics from a 2D numpy elevation grid.
        
        Args:
            elevation_grid: 2D array of elevation values in meters
            center_lat: Latitude of grid center for metric distance projection
            step_deg: Grid resolution in decimal degrees
            dem_source: Identifier of DEM source
            nodata_values: List of values indicating missing data (e.g. -9999.0)
            
        Returns:
            TerrainMetrics with elevation_avg, min, max, relief, and slope stats.
        """
        if nodata_values is None:
            nodata_values = [-9999.0, -32768.0]

        grid = np.array(elevation_grid, dtype=np.float64)

        # 1. Mask Nodata and NaNs
        mask_valid = ~np.isnan(grid) & ~np.isinf(grid)
        for nv in nodata_values:
            mask_valid &= ~np.isclose(grid, nv, atol=1e-3)

        valid_elevations = grid[mask_valid]
        if valid_elevations.size == 0:
            raise ValueError("All elevation grid cells are invalid or nodata.")

        elev_avg = float(np.mean(valid_elevations))
        elev_min = float(np.min(valid_elevations))
        elev_max = float(np.max(valid_elevations))
        relief = float(elev_max - elev_min)

        # 2. Metric step conversion
        dx = self.degrees_to_meters_lon(step_deg, center_lat)
        dy = self.degrees_to_meters_lat(step_deg, center_lat)

        rows, cols = grid.shape
        slopes_deg: List[float] = []

        if rows >= 3 and cols >= 3:
            # Central difference gradient method (Zevenbergen-Thorne / Horn adaptation)
            for r in range(1, rows - 1):
                for c in range(1, cols - 1):
                    # Check 3x3 neighborhood valid
                    sub = mask_valid[r-1:r+2, c-1:c+2]
                    if not np.all(sub):
                        continue

                    # West to East: z[r, c+1] - z[r, c-1]
                    dz_dx = (grid[r, c + 1] - grid[r, c - 1]) / (2.0 * dx)
                    # South to North: z[r - 1, c] - z[r + 1, c]
                    dz_dy = (grid[r - 1, c] - grid[r + 1, c]) / (2.0 * dy)

                    slope_rad = math.atan(math.sqrt(dz_dx**2 + dz_dy**2))
                    slope_d = math.degrees(slope_rad)
                    slopes_deg.append(slope_d)

        if slopes_deg:
            slope_avg = float(np.mean(slopes_deg))
            slope_max = float(np.max(slopes_deg))
        else:
            # Flat plane or small grid fallback
            slope_avg = 0.0
            slope_max = 0.0

        return TerrainMetrics(
            elevation_avg=round(elev_avg, 2),
            elevation_min=round(elev_min, 2),
            elevation_max=round(elev_max, 2),
            relief_m=round(relief, 2),
            slope_avg=round(slope_avg, 2),
            slope_max=round(slope_max, 2),
            dem_source=dem_source,
            dem_resolution_m=round(min(dx, dy), 1),
            effective_resolution_m=1000.0,
            valid_cell_count=int(valid_elevations.size)
        )
