/**
 * TerraWatch WebGIS Geospatial & Remote Sensing TypeScript Declarations
 * Định nghĩa cấu trúc dữ liệu không gian, mô hình địa hình số (DEM), và các chỉ số thủy văn/sạt trượt
 */

export type SusceptibilityTier = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

export type AlertLevel = 'SAFE' | 'ADVISORY' | 'WATCH' | 'WARNING';

export interface TopographyAttributes {
  mean_elevation_m: number;
  peak_elevation_m: number;
  mean_slope_degrees: number;
  max_slope_degrees: number;
  dominant_aspect: 'North-East' | 'North-West' | 'South-East' | 'South-West' | string;
}

export interface HydrologyAttributes {
  flow_accumulation_mean: number;
  topographic_wetness_index_mean: number;
  annual_rainfall_mm: number;
  critical_rainfall_threshold_24h_mm: number;
  critical_rainfall_threshold_72h_mm: number;
}

export interface GeologyAttributes {
  lithology_unit: string;
  soil_type: string;
  weathering_crust_depth_m: number;
  fault_line_proximity_km: number;
}

export interface HazardInventory {
  historical_events_count: number;
  last_major_event_year: number;
  dominant_failure_mechanism: string;
  vulnerability_index: number;
}

export interface EarlyWarningThresholds {
  advisory_yellow_mm_24h: number;
  watch_orange_mm_24h: number;
  warning_red_mm_24h: number;
}

export interface MonitoringTelemetry {
  station_code: string;
  station_name: string;
  station_lat: number;
  station_lng: number;
  telemetry_status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
}

export interface LandslideZoneProperties {
  zone_id: string;
  name_vi: string;
  name_en: string;
  province_vi: string;
  province_en: string;
  susceptibility_tier: SusceptibilityTier;
  center_coordinate: [number, number];
  topography: TopographyAttributes;
  hydrology: HydrologyAttributes;
  geology: GeologyAttributes;
  hazard_inventory: HazardInventory;
  early_warning_thresholds: EarlyWarningThresholds;
  monitoring_telemetry: MonitoringTelemetry;
}

export interface LandslideZoneFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: LandslideZoneProperties;
}

export interface LandslideFeatureCollection {
  type: 'FeatureCollection';
  metadata: {
    dataset_name: string;
    version: string;
    crs: string;
    total_zones: number;
    generated_date: string;
    provider: string;
    accreditation: string;
  };
  features: LandslideZoneFeature[];
}

export interface MountainLocation {
  id: string;
  name: string;
  center: [number, number];
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
  description: string;
}

export interface TerrainConfig {
  sourceId: string;
  source: {
    type: 'raster-dem';
    url?: string;
    tiles?: string[];
    tileSize?: number;
    maxzoom?: number;
    encoding: 'mapbox' | 'terrarium';
    attribution: string;
  };
  exaggeration: number;
}

export interface CameraPreset {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  duration?: number;
}
