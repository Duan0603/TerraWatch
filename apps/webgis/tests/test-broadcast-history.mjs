import assert from 'node:assert/strict';
import { toHistoryEntry } from '../src/api/broadcastHistory.js';

// Story 4.5: lịch sử phát lệnh đọc từ máy chủ (GET /notifications/broadcasts), không còn từ localStorage.
export async function testBroadcastHistory() {
  console.log('\n▶ testBroadcastHistory');
  const base = {
    broadcastId: '67136a62-ac18-4124-b36e-bc9319d6f916',
    sentAt: '2026-11-07T08:00:00Z',
    areaId: 1,
    areaName: 'Vùng trọng điểm 1: Mù Cang Chải (Yên Bái)',
    severity: 'extreme',
    message: 'Sơ tán ngay',
    senderName: 'Demo Admin',
    runId: null,
    recipients: 3,
    sent: 3,
    failed: 0,
    status: 'active'
  };

  const ok = toHistoryEntry(base);
  assert.equal(ok.id, 'BC-67136a62');
  assert.equal(ok.broadcastId, base.broadcastId);
  assert.equal(ok.location, base.areaName);
  assert.equal(ok.issuedBy, 'Demo Admin');
  assert.equal(ok.urgency, 'EXTREME');
  assert.equal(ok.recipientsTotal, 3);
  assert.equal(ok.deliveredCount, 3);
  assert.equal(ok.status, 'ĐÃ GỬI');
  assert.equal(ok.timestamp, '15:00 07/11/2026 (UTC+7)'); // 08:00 UTC hiển thị theo giờ Việt Nam
  console.log('  ✓ server row maps to the history view in Vietnam time');

  assert.equal(toHistoryEntry({ ...base, sent: 0, failed: 3 }).status, 'GỬI THẤT BẠI');
  assert.equal(toHistoryEntry({ ...base, sent: 2, failed: 1 }).status, 'GỬI MỘT PHẦN');
  assert.equal(toHistoryEntry({ ...base, status: 'revoked' }).status, 'ĐÃ THU HỒI');
  console.log('  ✓ delivery status: sent / failed / partial / revoked');

  const noArea = toHistoryEntry({ ...base, areaName: null, areaId: 7, senderName: null });
  assert.equal(noArea.location, 'Khu vực #7');
  assert.equal(noArea.issuedBy, 'Không rõ');
  console.log('  ✓ missing area or sender is labelled, not left blank');
  console.log('✅ testBroadcastHistory PASSED!');
}
