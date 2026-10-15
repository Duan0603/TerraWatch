// MapLibre GL JS Configuration & 3D Terrain Presets

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const FALLBACK_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

export const TERRAIN_CONFIG = {
  sourceId: 'terrarium-dem',
  sourceUrl: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  tileSize: 256,
  maxzoom: 15,
  exaggeration: 1.5,
  encoding: 'terrarium',
  attribution: 'DEM Mapzen/AWS'
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

export const ATTRIBUTIONS = [
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>',
  '<a href="https://openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a>',
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>',
  '<span>DEM Mapzen/AWS</span>'
];
