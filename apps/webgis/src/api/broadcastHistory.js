import { fmtVN } from '../utils/time.js';

// Không phụ thuộc axios/Vite để kiểm thử được bằng Node (tests/test-broadcast-history.mjs).
const deliveryStatus = (b) => {
  if (b.status === 'revoked') return 'ĐÃ THU HỒI';
  if (b.recipients > 0 && b.sent === 0) return 'GỬI THẤT BẠI';
  if (b.failed > 0) return 'GỬI MỘT PHẦN';
  return 'ĐÃ GỬI';
};

// Một bản ghi lịch sử từ GET /notifications/broadcasts -> dạng hiển thị của BroadcastHistoryModal.
export const toHistoryEntry = (b) => ({
  id: `BC-${b.broadcastId.slice(0, 8)}`,
  broadcastId: b.broadcastId,
  timestamp: fmtVN(b.sentAt),
  location: b.areaName || `Khu vực #${b.areaId ?? '?'}`,
  scope: 'area',
  scopeLabel: b.areaName || '',
  runId: b.runId,
  channels: ['fcm'],
  recipientsTotal: b.recipients,
  deliveredCount: b.sent,
  failedCount: b.failed,
  status: deliveryStatus(b),
  message: b.message,
  issuedBy: b.senderName || 'Không rõ',
  urgency: (b.severity || '').toUpperCase()
});
