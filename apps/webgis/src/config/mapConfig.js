// MapLibre GL JS Configuration & 3D Terrain Presets

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const HAS_MAPTILER_KEY = Boolean(MAPTILER_KEY);

// Nền bản đồ: MapTiler Topo (hillshade + đường đồng mức + màu thực vật/đất phủ theo loại)
// nếu có key; nếu không, rơi về OpenFreeMap (miễn phí, không cần key) để vẫn zero-config.
export const STYLE_URL = HAS_MAPTILER_KEY
  ? `https://api.maptiler.com/maps/topo-v2/style.json?key=${MAPTILER_KEY}`
  : 'https://tiles.openfreemap.org/styles/liberty';

export const FALLBACK_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

// Style ảnh vệ tinh (raster) phủ lên terrain 3D - chỉ khả dụng khi có MapTiler key.
export const SATELLITE_STYLE_URL = HAS_MAPTILER_KEY
  ? `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_KEY}`
  : null;

export const HAS_SATELLITE_STYLE = Boolean(SATELLITE_STYLE_URL);

// DEM cho 3D Terrain: MapTiler Terrain-RGB (qua TileJSON, như tài liệu MapTiler yêu cầu) nếu có key,
// ngược lại Terrarium DEM (Mapzen/AWS, miễn phí, dùng template {z}/{x}/{y}).
export const TERRAIN_CONFIG = HAS_MAPTILER_KEY
  ? {
      sourceId: 'maptiler-terrain-rgb',
      source: {
        type: 'raster-dem',
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`,
        encoding: 'mapbox',
        attribution: 'MapTiler Terrain-RGB'
      },
      exaggeration: 1.5
    }
  : {
      sourceId: 'terrarium-dem',
      source: {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 15,
        encoding: 'terrarium',
        attribution: 'DEM Mapzen/AWS'
      },
      exaggeration: 1.5
    };

export const DEFAULT_CAMERA = {
  center: [106.0, 16.0], // [longitude, latitude]
  zoom: 5.2,
  pitch: 35,
  bearing: 0
};

export const INCIDENT_CAMERA = {
  zoom: 13,
  pitch: 60,
  duration: 1800
};

export const ERROR_MESSAGE = 'Không thể tải lớp bản đồ địa hình. Vui lòng kiểm tra lại kết nối mạng';

export const ATTRIBUTIONS = HAS_MAPTILER_KEY
  ? [
      '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a>',
      '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>'
    ]
  : [
      '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>',
      '<a href="https://openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a>',
      '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>',
      '<span>DEM Mapzen/AWS</span>'
    ];
