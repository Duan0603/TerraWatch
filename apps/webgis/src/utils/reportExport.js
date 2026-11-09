import { toCsv, downloadCsv } from './csv.js';
import { fmtVN } from './time.js';

// Cột của ba báo cáo CSV: hàng đợi dự báo, nhật ký thẩm định, lịch sử phát lệnh.

const RISK = { extreme: 'Cực nguy hiểm', high: 'Cao', medium: 'Trung bình', low: 'Thấp', unavailable: 'Không có dự báo' };
const STATUS = { pending: 'Chờ thẩm định', approved: 'Đã phê duyệt', rejected: 'Đã từ chối', superseded: 'Đã bị thay thế' };
const DECISION = { approved: 'Phê duyệt', rejected: 'Từ chối' };

const coord = (v) => (v == null ? '' : Number(v.toFixed(5))); // bỏ nhiễu số thực kiểu 21.845000000000002

export const FORECAST_COLUMNS = [
  { label: 'Khu vực', value: e => e.location },
  { label: 'Mức nguy cơ', value: e => RISK[e.risk] ?? e.risk },
  { label: 'Xác suất', value: e => e.probability },
  { label: 'Trạng thái thẩm định', value: e => STATUS[e.status] ?? e.status },
  { label: 'Hết hạn', value: e => (e.expired ? 'Có' : 'Không') },
  { label: 'Phát hành', value: e => fmtVN(e.issuedAt) },
  { label: 'Hiệu lực từ', value: e => fmtVN(e.validFrom) },
  { label: 'Hiệu lực đến', value: e => fmtVN(e.validUntil) },
  { label: 'Mô hình', value: e => e.modelVersion },
  { label: 'Vĩ độ', value: e => coord(e.lat) },
  { label: 'Kinh độ', value: e => coord(e.lng) },
];

export const AUDIT_COLUMNS = [
  { label: 'Thời điểm', value: r => fmtVN(r.reviewedAt) },
  { label: 'Khu vực (unit)', value: r => r.unitId },
  { label: 'Mức nguy cơ', value: r => RISK[r.hazardLevel] ?? r.hazardLevel },
  { label: 'Quyết định', value: r => DECISION[r.decision] ?? r.decision },
  { label: 'Người thẩm định', value: r => r.reviewerName },
  { label: 'Email', value: r => r.reviewerEmail },
  { label: 'Lý do', value: r => r.reasonNotes },
  { label: 'Mã dự báo', value: r => r.runId },
];

export const HISTORY_COLUMNS = [
  { label: 'Mã lệnh', value: h => h.id },
  { label: 'Thời điểm', value: h => h.timestamp },
  { label: 'Khu vực', value: h => h.location },
  { label: 'Mức khẩn', value: h => h.urgency },
  { label: 'Trạng thái', value: h => h.status },
  { label: 'Số người nhận', value: h => h.recipientsTotal },
  { label: 'Đã gửi', value: h => h.deliveredCount },
  { label: 'Thất bại', value: h => h.failedCount },
  { label: 'Người phát', value: h => h.issuedBy },
  { label: 'Nội dung', value: h => h.message },
];

const today = () => new Date().toISOString().slice(0, 10);

// Xuất các hàng đang hiển thị thành tệp terrawatch-<tên>-<ngày>.csv
export const exportReport = (name, columns, rows) =>
  downloadCsv(`terrawatch-${name}-${today()}.csv`, toCsv(columns, rows));
