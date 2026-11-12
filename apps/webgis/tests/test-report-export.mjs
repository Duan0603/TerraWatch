import assert from 'node:assert/strict';
import { toCsv } from '../src/utils/csv.js';
import { FORECAST_COLUMNS, AUDIT_COLUMNS, HISTORY_COLUMNS } from '../src/utils/reportExport.js';

export async function testReportExport() {
  console.log('\n▶ testReportExport');

  // 1. Coordinate float-noise stripping & null coordinate handling in FORECAST_COLUMNS
  const forecastRow = {
    location: 'Bát Xát',
    risk: 'high',
    probability: 0.72,
    status: 'approved',
    expired: false,
    issuedAt: '2026-11-12T01:00:00Z',
    validFrom: '2026-11-12T01:00:00Z',
    validUntil: '2026-11-13T01:00:00Z',
    modelVersion: 'gru-v1',
    lat: 22.543210000000003,
    lng: null,
  };
  const forecastCsv = toCsv(FORECAST_COLUMNS, [forecastRow]).split('\r\n')[1];
  assert.ok(forecastCsv.includes(',22.54321,'), `expected rounded lat in ${forecastCsv}`);
  assert.ok(forecastCsv.endsWith(',22.54321,'), `expected empty trailing lng in ${forecastCsv}`);

  // 2. AUDIT_COLUMNS mapping
  const auditRow = {
    reviewedAt: '2026-11-12T02:30:00Z',
    unitId: 'VN-LC-01',
    hazardLevel: 'extreme',
    decision: 'approved',
    reviewerName: 'Nguyễn Tú',
    reviewerEmail: 'tu@terrawatch.vn',
    reasonNotes: 'Mưa vượt ngưỡng 80mm/24h',
    runId: 'RUN-20261112-01',
  };
  const auditCsv = toCsv(AUDIT_COLUMNS, [auditRow]).split('\r\n');
  assert.equal(auditCsv.length, 2);
  assert.ok(auditCsv[1].includes(',VN-LC-01,Cực nguy hiểm,Phê duyệt,Nguyễn Tú,tu@terrawatch.vn,'));

  // 3. HISTORY_COLUMNS mapping + formula injection guard in message field
  const historyRow = {
    id: 'BC-09',
    timestamp: '09:30 12/11/2026 (UTC+7)',
    location: 'Sa Pa',
    urgency: 'CRITICAL',
    status: 'ĐÃ GỬI',
    recipientsTotal: 150,
    deliveredCount: 148,
    failedCount: 2,
    issuedBy: 'Admin',
    message: '=ALERT("test")',
  };
  const historyCsv = toCsv(HISTORY_COLUMNS, [historyRow]).split('\r\n')[1];
  assert.ok(historyCsv.includes(',150,148,2,Admin,"\'=ALERT(""test"")"'));
  console.log('  ✓ FORECAST_COLUMNS, AUDIT_COLUMNS, HISTORY_COLUMNS CSV exports validated');

  console.log('✅ testReportExport PASSED!');
}
