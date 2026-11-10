import { axiosClient } from './axiosClient';

// Story 4.38: satellite-detected landslides that an officer has verified (GeoJSON FeatureCollection from Core API).
const landslideApi = {
  getConfirmed() {
    return axiosClient.get('/landslides/active');
  }
};

export default landslideApi;
