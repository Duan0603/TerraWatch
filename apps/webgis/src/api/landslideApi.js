import { axiosClient } from './axiosClient';

// Story 4.38: satellite-detected landslides that an officer has verified (GeoJSON FeatureCollection from Core API).
const landslideApi = {
  getConfirmed() {
    return axiosClient.get('/landslides/active');
  },

  // GeoJSON điểm GRU thử nghiệm (mưa Open-Meteo + đất/độ dốc) từ cache của GIS; chỉ dùng cho cán bộ.
  getExperimentalRisk() {
    return axiosClient.get('/gis/rainfall/live/map');
  },

  // Demo mô phỏng mưa: mưa giả lập qua GRU thật, không lưu gì.
  getSimulationLocations() {
    return axiosClient.get('/gis/rainfall/simulate/locations');
  },
  simulateRain(key, past7dMm, next24hMm, signal) {
    return axiosClient.get('/gis/rainfall/simulate', { params: { key, past_7d_mm: past7dMm, next_24h_mm: next24hMm }, signal });
  }
};

export default landslideApi;
