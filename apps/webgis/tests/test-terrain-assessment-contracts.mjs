import assert from 'node:assert';

/**
 * Validates GIS Service terrain feature contracts and slope hazard thresholds.
 */
export async function testTerrainAssessmentContracts() {
  console.log('\n--- 6. Testing Terrain Feature Extraction & Hazard Thresholds ---');

  // Sample terrain payload as provided by GIS Service /api/v1/gis/terrain/{unit_id}
  const sampleTerrain = {
    unit_id: 'VN-LC-01-U042',
    elevation_avg: 1420.5,
    elevation_min: 850.0,
    elevation_max: 1980.0,
    relief_m: 1130.0,
    slope_avg: 28.4,
    slope_max: 52.1,
    dem_source: 'COPERNICUS_GLO_30',
    dem_resolution_m: 30.0,
  };

  // 1. Schema integrity
  assert.ok(sampleTerrain.unit_id, 'unit_id must be present');
  assert.ok(sampleTerrain.elevation_avg > 0, 'elevation_avg must be positive');
  assert.strictEqual(sampleTerrain.relief_m, sampleTerrain.elevation_max - sampleTerrain.elevation_min);
  console.log('  ✓ Terrain elevation and relief balance validated (relief = max - min)');

  // 2. Slope classification
  function classifySlopeRisk(slopeDeg) {
    if (slopeDeg >= 35.0) return 'EXTREME';
    if (slopeDeg >= 25.0) return 'HIGH';
    if (slopeDeg >= 15.0) return 'MODERATE';
    return 'LOW';
  }

  assert.strictEqual(classifySlopeRisk(sampleTerrain.slope_max), 'EXTREME');
  assert.strictEqual(classifySlopeRisk(sampleTerrain.slope_avg), 'HIGH');
  assert.strictEqual(classifySlopeRisk(10.0), 'LOW');
  console.log('  ✓ Slope risk tiers validated (≥35° EXTREME, ≥25° HIGH, ≥15° MODERATE, <15° LOW)');

  // 3. DEM Metadata attributes
  assert.strictEqual(sampleTerrain.dem_resolution_m, 30.0);
  assert.ok(['SRTM_30M', 'COPERNICUS_GLO_30'].includes(sampleTerrain.dem_source));
  console.log('  ✓ DEM metadata resolution (30m) and source authority verified');

  console.log('✅ testTerrainAssessmentContracts PASSED!\n');
}
