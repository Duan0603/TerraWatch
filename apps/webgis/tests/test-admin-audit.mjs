import assert from 'node:assert/strict';
import { actionLabel, describeEntry, ADMIN_AUDIT_COLUMNS } from '../src/utils/adminAudit.js';

// Story 4.27: nhật ký thao tác quản trị - nhãn hành động, câu mô tả và cột xuất CSV.
export async function testAdminAudit() {
  console.log('\n▶ testAdminAudit');

  assert.equal(actionLabel('USER_LOCK'), 'Khóa tài khoản');
  assert.equal(actionLabel('BROADCAST_REVOKE'), 'Thu hồi cảnh báo');
  assert.equal(actionLabel('SOMETHING_NEW'), 'SOMETHING_NEW'); // mã lạ vẫn hiện, không mất dòng
  console.log('  ✓ nhãn hành động, mã lạ giữ nguyên');

  assert.equal(describeEntry({ action: 'USER_ROLE', detail: 'role=officer' }), 'Vai trò mới: Cán bộ');
  assert.equal(describeEntry({ action: 'BROADCAST_SEND', detail: 'status=PARTIAL, area=3, risk=high' }), 'Kết quả: gửi được một phần');
  assert.equal(describeEntry({ action: 'USER_LOCK', detail: null }), '');
  console.log('  ✓ câu mô tả cho đổi vai trò, phát cảnh báo, không có chi tiết');

  const cols = ADMIN_AUDIT_COLUMNS((v) => `T(${v})`);
  const row = { at: '2026-11-09T01:00:00Z', actor: 'a@x.vn', action: 'OFFICER_APPROVE', targetLabel: 'b@x.vn', targetId: 'u1', detail: null };
  assert.deepEqual(cols.map((c) => c.value(row)), ['T(2026-11-09T01:00:00Z)', 'a@x.vn', 'Duyệt cán bộ', 'b@x.vn', '']);
  assert.equal(cols[3].value({ ...row, targetLabel: null }), 'u1'); // phát cảnh báo không có nhãn: dùng mã
  console.log('  ✓ cột CSV');
  console.log('✅ testAdminAudit PASSED!');
}
