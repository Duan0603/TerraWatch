import assert from 'node:assert/strict';

const REQUIRED_FEATURE_KEYS = [
  'rain_1h_mm',
  'rain_24h_acc_mm',
  'rain_72h_acc_mm',
  'rain_7d_acc_mm',
  'forecast_next_24h_mm',
  'slope_avg',
  'slope_max',
  'elevation_avg',
  'relief_m',
];

const VALID_QUALITY_FLAGS = new Set(['good', 'stale', 'missing']);

function validateSnapshotContract(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object') return ['Snapshot payload must be an object'];
  if (!snapshot.unit_id) errors.push('Missing unit_id');
  if (snapshot.schema_version !== 'rainfall-terrain-24h.v1') errors.push('Unsupported schema_version');
  if (!VALID_QUALITY_FLAGS.has(snapshot.coverage_quality)) errors.push('Invalid coverage_quality');
  if (!snapshot.as_of_time || Number.isNaN(Date.parse(snapshot.as_of_time))) errors.push('Invalid as_of_time');

  const f = snapshot.features || {};
  for (const key of REQUIRED_FEATURE_KEYS) {
    if (!(key in f)) errors.push(`Missing feature key: ${key}`);
    if (f[key] !== null && (typeof f[key] !== 'number' || Number.isNaN(f[key]))) {
      errors.push(`Invalid numeric feature ${key}`);
    }
  }
  return errors;
}

export async function testSnapshotContracts() {
  console.log('\n▶ testSnapshotContracts');

  const validSnapshot = {
    unit_id: 'VN_LC_BATXAT_0001',
    unit_version: 'v1',
    schema_version: 'rainfall-terrain-24h.v1',
    as_of_time: '2026-11-12T04:00:00+00:00',
    coverage_quality: 'good',
    features: {
      rain_1h_mm: 4.2,
      rain_24h_acc_mm: 52.0,
      rain_72h_acc_mm: 88.5,
      rain_7d_acc_mm: 120.0,
      forecast_next_24h_mm: 36.5,
      slope_avg: 26.4,
      slope_max: 41.2,
      elevation_avg: 1120.0,
      relief_m: 185.0,
    },
  };
  assert.deepEqual(validateSnapshotContract(validSnapshot), []);

  // Null values remain valid when coverage_quality is missing (never fabricated as 0)
  const missingSnapshot = {
    ...validSnapshot,
    coverage_quality: 'missing',
    features: {
      ...validSnapshot.features,
      rain_1h_mm: null,
      rain_24h_acc_mm: null,
      forecast_next_24h_mm: null,
    },
  };
  assert.deepEqual(validateSnapshotContract(missingSnapshot), []);

  const invalidSnapshot = {
    unit_id: '',
    schema_version: 'legacy-v0',
    coverage_quality: 'unknown',
    as_of_time: 'bad-date',
    features: {},
  };
  assert.ok(validateSnapshotContract(invalidSnapshot).length >= 5);
  console.log('  ✓ Snapshot schema rainfall-terrain-24h.v1 & null-preservation validated');

  console.log('✅ testSnapshotContracts PASSED!');
}
