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
  //
  // LƯU Ý: Backend thật (`GET /api/v1/landslides/queue`) chỉ trả các cột SQL thô
  // (event_id, risk_level, confidence_score, geometry_geojson...) cho riêng trạng thái
  // 'pending' — không có endpoint nào trả về TẤT CẢ trạng thái theo đúng hình dạng dữ liệu
  // mà Dashboard/EventCard ở đây cần (lng/lat số, polygon, tên địa danh, rainfall24h...).
  // Gọi thẳng endpoint đó sẽ hiển thị sai hoặc vỡ giao diện, không phải lỗi mạng để bắt bằng
  // try/catch. Dùng dữ liệu cục bộ cho tới khi có một bước map hình dạng dữ liệu rõ ràng
  // (việc đó thuộc phạm vi hoàn thiện Story 4.2/4.3, không phải sửa lỗi đăng nhập/role).
  async getLandslides(params = {}) {
    const events = getStoredEvents();
    if (params.status) {
      return events.filter(e => e.status === params.status);
    }
    return events;
  },

  // Thẩm định 1-click (Phê duyệt hoặc Bác bỏ) — xem lý do dùng dữ liệu cục bộ ở getLandslides().
  // (Cũng không thể gọi PATCH /api/v1/landslides/{id}/verify thật ở đây vì id trong dữ liệu
  // demo không phải UUID thật tồn tại trong core_schema.landslide_events.)
  async verifyLandslide(id, { status = 'verified', risk_level, verified_notes = '' } = {}) {
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
  },

  // Đặt lại dữ liệu mẫu về ban đầu (tiện cho demo)
  resetMockData() {
    localStorage.removeItem(STORAGE_KEY);
    return INITIAL_EVENTS;
  }
};

export default landslideApi;
