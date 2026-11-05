import assert from 'node:assert/strict';
import {
  VIETNAM_LANDSLIDE_GEOJSON,
  LANDSLIDE_RISK_ZONES,
  getLandslideZoneById,
  getZonesByProvince,
  getZonesBySusceptibilityTier,
  getCriticalRiskZones,
  calculateDistanceKm,
  findNearestRiskZone,
  evaluateRainfallAlertLevel,
  getNationalLandslideRiskSummary
} from '../src/data/mountainLocations.js';

export async function testRiskZonesSpatial() {
  console.log('\n--- 1. Testing Vietnam Landslide Susceptibility Geospatial Data ---');

  // 1.1 Verify GeoJSON structure
  assert.equal(VIETNAM_LANDSLIDE_GEOJSON.type, 'FeatureCollection', 'Must be a FeatureCollection');
  assert.ok(Array.isArray(VIETNAM_LANDSLIDE_GEOJSON.features), 'Features must be an array');
  assert.ok(VIETNAM_LANDSLIDE_GEOJSON.features.length >= 100, `Expected >= 100 features, got ${VIETNAM_LANDSLIDE_GEOJSON.features.length}`);
  console.log(`  ✓ GeoJSON FeatureCollection contains ${VIETNAM_LANDSLIDE_GEOJSON.features.length} zones`);

  // 1.2 Verify Metadata properties
  const meta = VIETNAM_LANDSLIDE_GEOJSON.metadata;
  assert.ok(meta, 'Metadata object must exist');
  assert.equal(meta.crs, 'EPSG:4326 (WGS84)', 'CRS must be standard WGS84');
  assert.equal(meta.version, '2.4.0');
  console.log(`  ✓ Dataset metadata verified: version ${meta.version}, CRS: ${meta.crs}`);

  // 1.3 Verify every single feature
  let verifiedPolygons = 0;
  for (const feature of VIETNAM_LANDSLIDE_GEOJSON.features) {
    assert.equal(feature.type, 'Feature');
    assert.ok(feature.id, 'Feature must have an id');
    assert.equal(feature.geometry.type, 'Polygon', 'Geometry must be a Polygon');
    
    const ring = feature.geometry.coordinates[0];
    assert.ok(ring.length >= 30, `Polygon ring for ${feature.id} must have >= 30 points`);
    
    // Check polygon closure: first point === last point
    const first = ring[0];
    const last = ring[ring.length - 1];
    assert.equal(first[0], last[0], `Polygon ${feature.id} must close longitude`);
    assert.equal(first[1], last[1], `Polygon ${feature.id} must close latitude`);

    // Coordinate bounds inside Vietnam: Lng 102.0 to 110.0, Lat 8.0 to 24.0
    for (const [lng, lat] of ring) {
      assert.ok(lng >= 101.5 && lng <= 110.5, `Lng ${lng} in ${feature.id} out of bounds`);
      assert.ok(lat >= 8.0 && lat <= 24.0, `Lat ${lat} in ${feature.id} out of bounds`);
    }

    // Properties check
    const p = feature.properties;
    assert.equal(p.zone_id, feature.id);
    assert.ok(p.name_vi && p.name_vi.length > 0);
    assert.ok(p.province_vi && p.province_vi.length > 0);
    assert.ok(['CRITICAL', 'HIGH', 'MODERATE', 'LOW'].includes(p.susceptibility_tier));
    assert.ok(p.topography.mean_elevation_m > 0);
    assert.ok(p.topography.mean_slope_degrees > 0);
    assert.ok(p.hydrology.critical_rainfall_threshold_24h_mm > 0);
    assert.ok(p.monitoring_telemetry.station_code.startsWith('TW-'));

    verifiedPolygons++;
  }
  console.log(`  ✓ All ${verifiedPolygons} polygons and attribute schemas passed spatial validation`);

  // 1.4 Test Query API: getLandslideZoneById
  const sapa = getLandslideZoneById('LC-SP');
  assert.ok(sapa, 'Sa Pa zone LC-SP must exist');
  assert.equal(sapa.name_vi, 'Sa Pa');
  assert.equal(sapa.susceptibility_tier, 'CRITICAL');
  assert.equal(sapa.topography.dominant_aspect, 'North-East');
  console.log(`  ✓ Lookup by ID verified: Sa Pa (Tier: ${sapa.susceptibility_tier})`);

  // 1.5 Test Query API: getZonesByProvince
  const yenBaiZones = getZonesByProvince('Yên Bái');
  assert.ok(Array.isArray(yenBaiZones));
  assert.ok(yenBaiZones.length >= 6, `Yên Bái should have at least 6 zones, got ${yenBaiZones.length}`);
  assert.ok(yenBaiZones.some(z => z.name_vi === 'Mù Cang Chải'));
  console.log(`  ✓ Lookup by Province verified: Yên Bái (${yenBaiZones.length} districts found)`);

  // 1.6 Test Query API: getZonesBySusceptibilityTier & getCriticalRiskZones
  const criticals = getCriticalRiskZones();
  assert.ok(criticals.length > 0, 'Critical zones must not be empty');
  criticals.forEach(z => assert.equal(z.susceptibility_tier, 'CRITICAL'));
  console.log(`  ✓ Critical susceptibility tier verified (${criticals.length} priority critical zones identified)`);

  // 1.7 Test Distance calculation (Haversine formula)
  // Distance between Sa Pa (103.8438, 22.3364) and Mù Cang Chải (104.0850, 21.8540) is ~59 km
  const dist = calculateDistanceKm([103.8438, 22.3364], [104.0850, 21.8540]);
  assert.ok(dist >= 50 && dist <= 70, `Expected distance ~59km, got ${dist}km`);
  console.log(`  ✓ Haversine distance formula validated: Sa Pa to Mù Cang Chải = ${dist} km`);

  // 1.8 Test Nearest Risk Zone finder
  const nearestToHanoi = findNearestRiskZone([105.85, 21.03]); // Hanoi center
  assert.ok(nearestToHanoi, 'Nearest zone search must return a result');
  assert.ok(nearestToHanoi.distanceKm > 0);
  console.log(`  ✓ Nearest zone finder validated: Nearest to Hanoi is ${nearestToHanoi.zone.name_vi} (${nearestToHanoi.zone.province_vi}) at ${nearestToHanoi.distanceKm} km`);

  // 1.9 Test Rainfall alert level evaluation
  assert.equal(evaluateRainfallAlertLevel('LC-SP', 30), 'SAFE');
  assert.equal(evaluateRainfallAlertLevel('LC-SP', 70), 'ADVISORY');
  assert.equal(evaluateRainfallAlertLevel('LC-SP', 130), 'WATCH');
  assert.equal(evaluateRainfallAlertLevel('LC-SP', 190), 'WARNING');
  console.log('  ✓ Early warning rainfall threshold evaluation matrix passed (SAFE/ADVISORY/WATCH/WARNING)');

  // 1.10 Test National Summary Statistics
  const summary = getNationalLandslideRiskSummary();
  assert.equal(summary.totalZones, LANDSLIDE_RISK_ZONES.length);
  assert.ok(summary.criticalCount > 0);
  assert.ok(summary.highCount > 0);
  assert.ok(summary.totalProvinces >= 12);
  console.log(`  ✓ National Summary: ${summary.totalZones} zones across ${summary.totalProvinces} provinces (Critical: ${summary.criticalCount}, High: ${summary.highCount})`);

  console.log('✅ testRiskZonesSpatial PASSED!\n');
}

if (process.argv[1]?.endsWith('test-risk-zones-spatial.mjs')) {
  testRiskZonesSpatial();
}
