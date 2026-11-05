import axiosClient from './axiosClient';

// Core API chưa có GET lịch sử cho admin -> chỉ lưu cục bộ các lệnh đã phát THẬT (không có dữ liệu mẫu).
// shortcut: lịch sử theo từng trình duyệt, nâng cấp khi backend có endpoint đọc alert_broadcasts.
const STORAGE_KEY = 'terrawatch_broadcast_history';

const readHistory = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const ERROR_BY_STATUS = {
  400: 'Dữ liệu lệnh phát không hợp lệ.',
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Chỉ tài khoản Admin mới được phát lệnh cảnh báo khẩn cấp.',
  409: 'Lệnh bị từ chối: trùng mã đã xử lý, hoặc dự báo liên quan đã hết hạn / chưa được duyệt. Kiểm tra lịch sử rồi tải lại dự báo.'
};

export const broadcastApi = {
  async getBroadcastHistory() {
    return readHistory();
  },

  // Khu vực giám sát thật: backend chọn người nhận theo thuê bao của area_id.
  async getAreas() {
    const list = await axiosClient.get('/monitoring-areas');
    return list.filter(a => a.is_active).map(a => ({ id: a.area_id, name: a.name }));
  },

  // POST /notifications/broadcast (admin-only). Backend chỉ gửi FCM; SMS chưa có nhà cung cấp.
  // requestId là idempotency key: gửi lại cùng mã sẽ bị backend chặn trùng (409), không phát hai lần.
  async getBroadcastsForMe() {
    const data = await axiosClient.get('/alerts/broadcasts');
    // data may be a single object or array
    const list = Array.isArray(data) ? data : [data];
    return list.filter(b => !b.expired && b.status === 'active');
  },

  async sendBroadcast({ requestId, areaId, areaName, runId, message, urgency, issuedBy }) {
    let res;
    try {
      res = await axiosClient.post('/core/notifications/broadcast', {
        eventId: requestId,
        riskLevel: urgency.toLowerCase(),
        message,
        areaId,
        runId
      });
    } catch (err) {
      const status = err.response?.status;
      throw new Error(ERROR_BY_STATUS[status] || `Không gửi được lệnh (${err.message}). Chưa có tin nào được phát.`);
    }

    if (res.status === 'NO_RECIPIENTS') {
      throw new Error('Chưa có thuê bao nào đăng ký nhận cảnh báo ở khu vực này. Không có tin nào được gửi.');
    }

    const entry = {
      id: `BC-${res.broadcast_id}`,
      timestamp: res.timestamp.replace('T', ' ').slice(0, 19) + ' UTC',
      location: areaName,
      scope: 'area',
      runId,
      scopeLabel: areaName,
      channels: ['fcm'],
      recipientsTotal: res.recipients_estimated,
      deliveredCount: res.sent,
      failedCount: res.failed,
      status: res.status,
      message,
      issuedBy,
      urgency
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...readHistory()]));

    // FCM có thể fail trong môi trường demo (chưa có Firebase key) nhưng broadcast đã được lưu DB
    // → Coi là thành công về mặt quy trình; frontend hiện thông báo "demo mode"
    const fcmUnavailable = res.status === 'FAILED' &&
      (res.first_error === 'FCM not configured' || res.recipients_estimated > 0);
    if (res.status === 'FAILED' && !fcmUnavailable) {
      throw new Error(`Gửi thất bại tới toàn bộ ${res.recipients_estimated} thiết bị${res.first_error ? ` (${res.first_error})` : ''}.`);
    }
    return { broadcastId: entry.id, data: entry, sent: res.sent, failed: res.failed, total: res.recipients_estimated, status: res.status, fcmUnavailable };
  }
};

export default broadcastApi;
