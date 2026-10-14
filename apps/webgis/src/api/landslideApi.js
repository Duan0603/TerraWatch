import axiosClient from './axiosClient';
import { INITIAL_EVENTS } from '../data/mockEvents';

// Bộ nhớ đệm cục bộ (localStorage) để lưu trạng thái thẩm định khi chạy dev offline
const STORAGE_KEY = 'terrawatch_events_state';

const getStoredEvents = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge với INITIAL_EVENTS để đảm bảo luôn có lng, lat, polygon, rainfall24h
        return parsed.map(ev => {
          const base = INITIAL_EVENTS.find(i => i.id === ev.id) || {};
          return {
            ...base,
            ...ev,
            lng: typeof ev.lng === 'number' ? ev.lng : (base.lng || 104.085),
            lat: typeof ev.lat === 'number' ? ev.lat : (base.lat || 21.845),
            polygon: ev.polygon || base.polygon,
            rainfall24h: ev.rainfall24h || base.rainfall24h,
            forecastWindow: ev.forecastWindow || base.forecastWindow
          };
        });
      }
    } catch (e) { /* ignore */ }
  }
  return INITIAL_EVENTS;
};

const saveStoredEvents = (events) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
};

export const landslideApi = {
  // Lấy danh sách sự cố sạt lở (lọc theo pending / verified / all)
  async getLandslides(params = {}) {
    try {
      const data = await axiosClient.get('/core/landslides', { params });
      return data;
    } catch (err) {
      console.warn('Backend Core API chưa kết nối, sử dụng dữ liệu cục bộ:', err.message);
      const events = getStoredEvents();
      if (params.status) {
        return events.filter(e => e.status === params.status);
      }
      return events;
    }
  },

  // Thẩm định 1-click (Phê duyệt hoặc Bác bỏ)
  async verifyLandslide(id, { status = 'verified', risk_level, verified_notes = '' } = {}) {
    try {
      const data = await axiosClient.post(`/core/landslides/${id}/verify`, {
        status,
        risk_level,
        verified_notes
      });
      return data;
    } catch (err) {
      console.warn(`Lưu trạng thái thẩm định [${status}] cục bộ cho sự cố ${id}:`, err.message);
      const events = getStoredEvents();
      const updated = events.map(ev => {
        if (ev.id === id) {
          return {
            ...ev,
            status,
            risk: risk_level || ev.risk,
            verifiedAt: new Date().toISOString(),
          };
        }
        return ev;
      });
      saveStoredEvents(updated);
      return { success: true, id, status, updatedEvent: updated.find(e => e.id === id) };
    }
  },

  // Đặt lại dữ liệu mẫu về ban đầu (tiện cho demo)
  resetMockData() {
    localStorage.removeItem(STORAGE_KEY);
    return INITIAL_EVENTS;
  }
};

export default landslideApi;
