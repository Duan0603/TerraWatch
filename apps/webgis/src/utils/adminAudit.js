// Story 4.27: how admin-console actions read in the audit log (the server sends a short action code).

export const ACTION_LABELS = {
  USER_LOCK: 'Khóa tài khoản',
  USER_UNLOCK: 'Mở khóa tài khoản',
  USER_ROLE: 'Đổi vai trò',
  OFFICER_APPROVE: 'Duyệt cán bộ',
  OFFICER_REJECT: 'Từ chối cán bộ',
  BROADCAST_SEND: 'Phát cảnh báo',
  BROADCAST_REVOKE: 'Thu hồi cảnh báo'
};

const ROLES = { admin: 'Quản trị', officer: 'Cán bộ', citizen: 'Công dân' };
const BROADCAST_STATUS = {
  DISPATCHED: 'đã gửi hết',
  PARTIAL: 'gửi được một phần',
  FAILED: 'gửi lỗi',
  NO_RECIPIENTS: 'không có người nhận'
};

export const actionLabel = (code) => ACTION_LABELS[code] ?? code;

/** One readable line for the "Chi tiết" column; unknown codes fall back to the raw text. */
export function describeEntry(row) {
  const d = row.detail || '';
  if (row.action === 'USER_ROLE') {
    const role = d.replace('role=', '');
    return `Vai trò mới: ${ROLES[role] ?? role}`;
  }
  if (row.action === 'BROADCAST_SEND') {
    const status = /status=([A-Z_]+)/.exec(d)?.[1];
    return status ? `Kết quả: ${BROADCAST_STATUS[status] ?? status}` : d;
  }
  return d;
}

export const ADMIN_AUDIT_COLUMNS = (fmt) => [
  { label: 'Thời điểm', value: (r) => fmt(r.at) },
  { label: 'Người thao tác', value: (r) => r.actor },
  { label: 'Thao tác', value: (r) => actionLabel(r.action) },
  { label: 'Đối tượng', value: (r) => r.targetLabel || r.targetId },
  { label: 'Chi tiết', value: (r) => describeEntry(r) }
];
