import { axiosClient } from './axiosClient';

// Story 4.42: a citizen's alert areas (same endpoints as the mobile app, Story 5.7).
const alertSubscriptionApi = {
  areas: () => axiosClient.get('/monitoring-areas'),
  list: () => axiosClient.get('/alerts/subscriptions'),
  subscribe: (areaId, alertChannels, phoneNumber) =>
    axiosClient.post('/alerts/subscriptions', { areaId, alertChannels, ...(phoneNumber ? { phoneNumber } : {}) }),
  remove: (subscriptionId) => axiosClient.delete(`/alerts/subscriptions/${encodeURIComponent(subscriptionId)}`),
  me: () => axiosClient.get('/auth/me'),
  updateMe: (profile) => axiosClient.put('/auth/me', profile)
};

export default alertSubscriptionApi;
