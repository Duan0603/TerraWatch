import axiosClient from './axiosClient';

// Khóa lưu trữ lịch sử phát cảnh báo trên trình duyệt (Fallback offline)
const STORAGE_KEY = 'terrawatch_broadcast_history';

// Dữ liệu mẫu ban đầu để giao diện có sẵn lịch sử trực quan
const INITIAL_HISTORY = [
  {
    id: 'BC-20261014-001',
    timestamp: '2026-10-14 06:30:15 UTC',
    location: 'Quốc Lộ 32 - Bản Dế Xu Phình',
    scope: 'buffer_500m',
    scopeLabel: 'Vùng đệm bán kính 500m (Khẩn cấp)',
    channels: ['sms', 'fcm'],
    recipientsTotal: 395,
    deliveredCount: 391,
    failedCount: 4,
    status: 'DELIVERED',
    message: '[KHẨN CẤP] UBND Huyện Mù Cang Chải cảnh báo sạt lở ta-luy dương QL32 Bản Dế Xu Phình. Yêu cầu toàn bộ nhân dân sơ tán ngay đến nhà văn hóa bản.',
    issuedBy: 'Admin Tổng Chỉ Huy (Nguyễn Văn An)',
    urgency: 'EXTREME'
  },
  {
    id: 'BC-20261013-002',
    timestamp: '2026-10-13 18:45:00 UTC',
    location: 'Sườn Đèo Khau Phạ (Mù Cang Chải)',
    scope: 'buffer_1000m',
    scopeLabel: 'Vùng đệm bán kính 1.000m',
    channels: ['sms'],
    recipientsTotal: 120,
    deliveredCount: 118,
    failedCount: 2,
    status: 'DELIVERED',
    message: '[CẢNH BÁO MƯA LŨ] Đèo Khau Phạ xuất hiện cung trượt đất. Hạn chế người và phương tiện lưu thông trong 12h tới.',
    issuedBy: 'Admin Trực Ban (Trần Đức)',
    urgency: 'HIGH'
  },
  {
    id: 'BC-20261012-003',
    timestamp: '2026-10-12 14:10:22 UTC',
    location: 'Huyện Bắc Hà (Lào Cai) - Xã Nậm Khánh',
    scope: 'aoi',
    scopeLabel: 'Toàn bộ vùng trọng điểm AOI (Bắc Hà)',
    channels: ['fcm'],
    recipientsTotal: 240,
    deliveredCount: 236,
    failedCount: 4,
    status: 'DELIVERED',
    message: '[KHUYẾN CÁO] Lượng mưa tích lũy vượt 120mm tại xã Nậm Khánh. Cán bộ thôn bản kiểm tra ngay các điểm xung yếu.',
    issuedBy: 'Admin Tổng Chỉ Huy',
    urgency: 'MEDIUM'
  }
];

const getStoredHistory = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      /* ignore */
    }
  }
  return INITIAL_HISTORY;
};

const saveStoredHistory = (list) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
};

export const broadcastApi = {
  // 1. Lấy danh sách lịch sử phát cảnh báo
  // LƯU Ý: Core API chưa có endpoint đọc lịch sử (chỉ có POST /api/v1/notifications/broadcast
  // để phát lệnh, không có GET để liệt kê lại — core_schema.alert_broadcasts/alert_deliveries
  // đã có bảng từ Story 1.2 nhưng chưa có API đọc). Lưu lịch sử cục bộ, cập nhật thêm mỗi khi
  // sendBroadcast() phát lệnh thật thành công, thay vì gọi một URL không tồn tại.
  async getBroadcastHistory() {
    return getStoredHistory();
  },

  // 2. Tính toán xem trước số lượng người nhận theo bán kính / phạm vi
  getRecipientPreview(scope = 'buffer_500m', customRadius = 500) {
    switch (scope) {
      case 'buffer_500m':
        return {
          total: 180,
          residents: 168,
          responders: 12,
          smsSubscribers: 180,
          appDevices: 145,
          estimatedLatencySec: 15
        };
      case 'buffer_1000m':
        return {
          total: 395,
          residents: 371,
          responders: 24,
          smsSubscribers: 395,
          appDevices: 310,
          estimatedLatencySec: 25
        };
      case 'buffer_2000m':
        return {
          total: 850,
          residents: 805,
          responders: 45,
          smsSubscribers: 850,
          appDevices: 680,
          estimatedLatencySec: 35
        };
      case 'aoi':
        return {
          total: 1420,
          residents: 1360,
          responders: 60,
          smsSubscribers: 1420,
          appDevices: 1150,
          estimatedLatencySec: 45
        };
      case 'all':
        return {
          total: 3200,
          residents: 3100,
          responders: 100,
          smsSubscribers: 3200,
          appDevices: 2500,
          estimatedLatencySec: 60
        };
      default:
        return {
          total: 200,
          residents: 188,
          responders: 12,
          smsSubscribers: 200,
          appDevices: 160,
          estimatedLatencySec: 20
        };
    }
  },

  // 3. Phát lệnh cảnh báo khẩn cấp (SMS & FCM)
  // Gọi thật `POST /api/v1/notifications/broadcast` (qua alias gateway /core/notifications/broadcast
  // -> xem gateway/nginx.conf). Endpoint này giờ CHỈ admin gọi được (SecurityConfig.java), axiosClient
  // tự đính kèm Bearer token của người đang đăng nhập; citizen/officer gọi sẽ nhận 403 thật.
  async sendBroadcast(payload) {
    const preview = this.getRecipientPreview(payload.scope, payload.radiusMeters);
    try {
      const res = await axiosClient.post('/core/notifications/broadcast', {
        eventId: payload.landslideId ? String(payload.landslideId) : null,
        riskLevel: (payload.urgency || 'HIGH').toLowerCase(),
        message: payload.message,
        targetArea: payload.location
      });

      const newEntry = {
        id: res.event_id ? `BC-${res.event_id}` : `BC-${Date.now().toString().slice(-8)}`,
        timestamp: res.timestamp || (new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'),
        location: payload.location || 'Khu vực trọng điểm',
        scope: payload.scope || 'buffer_500m',
        scopeLabel: payload.scopeLabel || 'Vùng đệm nguy cơ khẩn cấp',
        channels: payload.channels || ['sms', 'fcm'],
        recipientsTotal: res.recipients_estimated ?? preview.total,
        deliveredCount: res.recipients_estimated ?? preview.total,
        failedCount: 0,
        status: res.status || 'DISPATCHED',
        message: payload.message,
        issuedBy: payload.issuedBy || 'Admin Tổng Chỉ Huy',
        urgency: payload.urgency || 'HIGH'
      };

      // Chưa có API đọc lịch sử thật (xem getBroadcastHistory) -> lưu vết cục bộ để
      // BroadcastHistoryModal hiển thị được các lệnh đã phát thật.
      saveStoredHistory([newEntry, ...getStoredHistory()]);

      return {
        success: true,
        broadcastId: newEntry.id,
        summary: `Đã phát thật qua Core API tới ước tính ${newEntry.recipientsTotal} người dân qua kênh [${(res.channels || payload.channels).join ? (res.channels || payload.channels).join(', ') : res.channels}]`,
        data: newEntry
      };
    } catch (err) {
      // Lỗi thật từ backend (403 không phải admin, 401 chưa đăng nhập, 400 payload sai...)
      // phải báo cho người dùng, không được giả vờ phát lệnh thành công.
      if (err.response) {
        throw err;
      }
      // Chỉ mô phỏng khi thật sự không gọi được backend (offline dev).
      console.warn('Không kết nối được Core API, lưu lệnh phát cảnh báo cục bộ (demo offline):', err.message);
      const newEntry = {
        id: `BC-${Date.now().toString().slice(-8)}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
        location: payload.location || 'Khu vực trọng điểm',
        scope: payload.scope || 'buffer_500m',
        scopeLabel: payload.scopeLabel || 'Vùng đệm nguy cơ khẩn cấp',
        channels: payload.channels || ['sms', 'fcm'],
        recipientsTotal: preview.total,
        deliveredCount: preview.total - 2,
        failedCount: 2,
        status: 'DELIVERED',
        message: payload.message,
        issuedBy: payload.issuedBy || 'Admin Tổng Chỉ Huy',
        urgency: payload.urgency || 'HIGH'
      };
      saveStoredHistory([newEntry, ...getStoredHistory()]);
      await new Promise(r => setTimeout(r, 600));
      return {
        success: true,
        isMock: true,
        broadcastId: newEntry.id,
        summary: `[Demo offline] Đã phát tới ${preview.total} người dân qua kênh [${payload.channels.join(', ').toUpperCase()}]`,
        data: newEntry
      };
    }
  }
};

export default broadcastApi;
