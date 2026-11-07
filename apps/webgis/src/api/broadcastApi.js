import axiosClient from './axiosClient';
import { toHistoryEntry } from './broadcastHistory.js';

const ERROR_BY_STATUS = {
  400: 'Dữ liệu lệnh phát không hợp lệ.',
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Chỉ tài khoản Admin mới được phát lệnh và xem lịch sử phát lệnh.',
  404: 'Không tìm thấy khu vực giám sát này.',
  409: 'Lệnh bị từ chối: trùng mã đã xử lý, hoặc dự báo liên quan đã hết hạn / chưa được duyệt. Kiểm tra lịch sử rồi tải lại dự báo.'
};

const failWith = (err, fallback) => {
  throw new Error(ERROR_BY_STATUS[err.response?.status] || `${fallback} (${err.message}).`);
};

export const broadcastApi = {
  // Lịch sử lưu ở máy chủ (alert_broadcasts): mọi admin, mọi máy đều thấy như nhau.
  async getBroadcastHistory() {
    try {
      const rows = await axiosClient.get('/notifications/broadcasts');
      return rows.map(toHistoryEntry);
    } catch (err) {
      return failWith(err, 'Không tải được lịch sử phát lệnh');
    }
  },

  // Số thuê bao Push và thiết bị sẽ nhận nếu phát tới khu vực này (cùng quy tắc chọn người nhận của backend).
  async getPreview(areaId) {
    try {
      return await axiosClient.get('/notifications/broadcast/preview', { params: { areaId } });
    } catch (err) {
      return failWith(err, 'Không xem trước được người nhận');
    }
  },

  // Khu vực giám sát thật: backend chọn người nhận theo thuê bao của area_id.
  async getAreas() {
    const list = await axiosClient.get('/monitoring-areas');
    return list.filter(a => a.is_active).map(a => ({ id: a.area_id, name: a.name }));
  },

  // POST /notifications/broadcast (admin-only). Backend chỉ gửi FCM; SMS chưa có nhà cung cấp.
  // requestId là idempotency key: gửi lại cùng mã sẽ bị backend chặn trùng (409), không phát hai lần.
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

    const entry = toHistoryEntry({
      broadcastId: res.broadcast_id,
      sentAt: res.timestamp,
      areaId,
      areaName,
      runId,
      recipients: res.recipients_estimated,
      sent: res.sent,
      failed: res.failed,
      status: 'active',
      message,
      senderName: issuedBy,
      severity: urgency
    });

    if (res.status === 'FAILED') {
      // Không thiết bị nào nhận được: backend đã dùng mã chống trùng này, nên gửi lại phải dùng mã mới.
      throw Object.assign(
        new Error(`Gửi thất bại tới toàn bộ ${res.recipients_estimated} thiết bị${res.first_error ? ` (${res.first_error})` : ''}.`),
        { retryWithNewKey: true });
    }
    return { broadcastId: entry.id, data: entry, sent: res.sent, failed: res.failed, total: res.recipients_estimated, status: res.status };
  },

  // GET /notifications/broadcast/{id}/deliveries - Chi tiết từng người nhận và trạng thái chuyển phát
  async getDeliveries(broadcastId) {
    try {
      return await axiosClient.get(`/notifications/broadcast/${broadcastId}/deliveries`);
    } catch (err) {
      return failWith(err, 'Không tải được danh sách người nhận');
    }
  },

  // POST /notifications/broadcast/{id}/revoke - Thu hồi lệnh khẩn cấp đã phát
  async revokeBroadcast(broadcastId) {
    try {
      await axiosClient.post(`/notifications/broadcast/${broadcastId}/revoke`);
    } catch (err) {
      return failWith(err, 'Không thể thu hồi lệnh cảnh báo');
    }
  }
};

export default broadcastApi;
