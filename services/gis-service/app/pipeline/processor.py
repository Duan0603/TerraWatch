"""
GIS Satellite Preprocessor & Tiling Service
Ingestion: Sentinel-2 L2A & Landsat-8
Calculations: NDVI, Slope, Cloud Masking, Tile Generation
"""
import math
from typing import List, Dict, Any

class GISProcessor:
    @staticmethod
    def calculate_ndvi_synthetic(nir: float, red: float) -> float:
        """
        NDVI = (NIR - RED) / (NIR + RED)
        Sentinel-2: Band 8 (NIR) and Band 4 (Red)
        """
        if (nir + red) == 0:
            return 0.0
        return round((nir - red) / (nir + red), 4)

    @staticmethod
    def generate_tiles(bbox: List[float], tile_size_km: float = 2.0) -> List[Dict[str, Any]]:
        """
        Slices a larger AOI bounding box into smaller patches for AI model inference.
        bbox: [min_lon, min_lat, max_lon, max_lat]
        """
        min_lon, min_lat, max_lon, max_lat = bbox
        
        # Approximate 1 degree lat ~ 111 km, lon depends on latitude
        lat_step = tile_size_km / 111.0
        lon_step = tile_size_km / (111.0 * math.cos(math.radians((min_lat + max_lat) / 2)))

        tiles = []
        curr_lat = min_lat
        patch_id = 1

        while curr_lat < max_lat:
            curr_lon = min_lon
            next_lat = min(curr_lat + lat_step, max_lat)
            while curr_lon < max_lon:
                next_lon = min(curr_lon + lon_step, max_lon)
                tiles.append({
                    "tile_id": f"tile_{patch_id:04d}",
                    "bbox": [round(curr_lon, 5), round(curr_lat, 5), round(next_lon, 5), round(next_lat, 5)],
                    "size_km": tile_size_km,
                    "status": "ready_for_inference"
                })
                patch_id += 1
                curr_lon = next_lon
            curr_lat = next_lat

        return tiles
