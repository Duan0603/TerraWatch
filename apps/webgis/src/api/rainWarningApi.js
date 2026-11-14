import { axiosClient } from './axiosClient';

// Story 4.41: rain-threshold warning sites (GIS service, public GET through the gateway).
const rainWarningApi = {
  getSites: () => axiosClient.get('/gis/rainfall/warning/sites'),
  getLive: (lat, lon) => axiosClient.get('/gis/rainfall/live', { params: { latitude: lat, longitude: lon } }),
  getReplay: (id) => axiosClient.get(`/gis/rainfall/warning/replay/${encodeURIComponent(id)}`)
};

export default rainWarningApi;
