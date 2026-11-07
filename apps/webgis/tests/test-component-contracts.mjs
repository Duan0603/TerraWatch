import assert from 'node:assert/strict';

export async function testComponentContracts() {
  console.log('\n--- 3. Testing WebGIS Component Interfaces & Broadcast Contracts ---');

  // 3.1 Test Alert Broadcast Payload Schema Validator
  const validateBroadcastPayload = (payload) => {
    const errors = [];
    if (!payload.title || typeof payload.title !== 'string' || payload.title.trim().length === 0) {
      errors.push('Title is required and must be non-empty string');
    }
    if (!payload.message || typeof payload.message !== 'string' || payload.message.trim().length < 10) {
      errors.push('Message must be at least 10 characters');
    }
    const validLevels = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'];
    if (!payload.severity || !validLevels.includes(payload.severity)) {
      errors.push(`Severity must be one of: ${validLevels.join(', ')}`);
    }
    if (!payload.targetProvince || typeof payload.targetProvince !== 'string') {
      errors.push('Target province is required');
    }
    if (typeof payload.enableSiren !== 'boolean') {
      errors.push('enableSiren must be a boolean');
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const sampleValidBroadcast = {
    title: 'CẢNH BÁO SẠT LỞ ĐẤT ĐẶC BIỆT NGUY HIỂM',
    message: 'Mưa lớn kéo dài gây nguy cơ sạt trượt sườn đồi tại Sa Pa và Bát Xát. Người dân sơ tán khẩn cấp.',
    severity: 'CRITICAL',
    targetProvince: 'Lào Cai',
    enableSiren: true,
    affectedDistricts: ['Sa Pa', 'Bát Xát'],
    validUntil: new Date(Date.now() + 86400000).toISOString()
  };

  const validationResult = validateBroadcastPayload(sampleValidBroadcast);
  assert.equal(validationResult.isValid, true);
  assert.equal(validationResult.errors.length, 0);
  console.log('  ✓ Alert Broadcast schema validation passed for emergency dispatch');

  // Test invalid payload rejection
  const invalidPayload = { title: '', message: 'Short', severity: 'EXTREME', enableSiren: 'yes' };
  const invalidResult = validateBroadcastPayload(invalidPayload);
  assert.equal(invalidResult.isValid, false);
  assert.ok(invalidResult.errors.length >= 3);
  console.log(`  ✓ Invalid broadcast payload correctly caught ${invalidResult.errors.length} validation faults`);

  // 3.2 Test Location Selector Contract
  const simulateLocationSelection = (locationId, availableLocations) => {
    if (!locationId) return availableLocations[0];
    const match = availableLocations.find(l => l.id === locationId);
    return match || availableLocations[0];
  };

  const mockLocations = [
    { id: 'vietnam', name: 'Toàn Việt Nam', center: [106.0, 16.0], zoom: 5.2 },
    { id: 'lao-cai', name: 'Lào Cai', center: [103.97, 22.48], zoom: 9.8 }
  ];

  const selectedLoc = simulateLocationSelection('lao-cai', mockLocations);
  assert.equal(selectedLoc.id, 'lao-cai');
  const fallbackLoc = simulateLocationSelection('unknown-id', mockLocations);
  assert.equal(fallbackLoc.id, 'vietnam');
  console.log('  ✓ LocationSelector fallback & selection contract verified');

  // 3.3 Test Verification Queue Action Payload Contract
  const validateVerificationAction = (action) => {
    const validActions = ['APPROVE', 'REJECT', 'ESCALATE', 'REQUEST_INFO'];
    if (!validActions.includes(action.type)) return false;
    if (!action.reportId || typeof action.reportId !== 'string') return false;
    if (!action.officerId || typeof action.officerId !== 'string') return false;
    return true;
  };

  const validAction = {
    type: 'APPROVE',
    reportId: 'REP-2026-0042',
    officerId: 'OFFICER-007',
    notes: 'Verified via Sentinel-2 SAR image'
  };
  assert.equal(validateVerificationAction(validAction), true);
  console.log('  ✓ VerificationQueue action dispatch contract verified');

  console.log('✅ testComponentContracts PASSED!\n');
}

if (process.argv[1]?.endsWith('test-component-contracts.mjs')) {
  testComponentContracts();
}
