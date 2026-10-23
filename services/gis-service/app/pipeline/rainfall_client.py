"""
Open-Meteo Meteorological Rainfall Client
Provider: Open-Meteo Weather API (https://open-meteo.com/)
Covers: Historical Weather Observations and 24h Forward Weather Forecasts.
Complies with Story 2.1 & Architecture Invariants: UTC timestamps, metric mm units.
"""
import logging
from typing import Dict, Any, Optional
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

class RainfallClientError(Exception):
    """Custom exception raised when external meteorological API fails."""
    pass

class OpenMeteoRainfallClient:
    FORECAST_API_URL = "https://api.open-meteo.com/v1/forecast"
    ARCHIVE_API_URL = "https://archive-api.open-meteo.com/v1/archive"

    def __init__(self, timeout_sec: int = 10, max_retries: int = 3):
        self.timeout_sec = timeout_sec
        self.session = requests.Session()
        
        retries = Retry(
            total=max_retries,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"]
        )
        adapter = HTTPAdapter(max_retries=retries)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

    def fetch_rainfall_series(
        self, 
        latitude: float, 
        longitude: float, 
        past_days: int = 7, 
        forecast_days: int = 2
    ) -> Dict[str, Any]:
        """
        Fetches hourly precipitation (in mm) for both historical antecedent window and next forecast days.
        Returns the parsed JSON response with guaranteed UTC timezone.
        """
        params = {
            "latitude": round(latitude, 4),
            "longitude": round(longitude, 4),
            "hourly": "precipitation",
            "timezone": "UTC",
            "past_days": past_days,
            "forecast_days": forecast_days
        }

        try:
            response = self.session.get(self.FORECAST_API_URL, params=params, timeout=self.timeout_sec)
            response.raise_for_status()
            data = response.json()
            
            if "hourly" not in data or "precipitation" not in data["hourly"]:
                raise RainfallClientError(f"Open-Meteo response missing hourly precipitation: {data}")
                
            return data
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to query Open-Meteo API for ({latitude}, {longitude}): {str(e)}")
            raise RainfallClientError(f"Open-Meteo API network failure: {str(e)}") from e
