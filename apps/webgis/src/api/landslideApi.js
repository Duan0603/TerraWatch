import { axiosClient } from './axiosClient';

// Story 4.38: satellite-detected landslides that an officer has verified (GeoJSON FeatureCollection from Core API).
const landslideApi = {
  getConfirmed() {
    return axiosClient.get('/landslides/active');
  },

  // GeoJSON điểm GRU thử nghiệm (mưa Open-Meteo + đất/độ dốc) từ cache của GIS; chỉ dùng cho cán bộ.
  getExperimentalRisk() {
    return axiosClient.get('/gis/rainfall/live/map');
  }
};

export default landslideApi;
