import assert from 'node:assert/strict';
import {
  STYLE_URL,
  FALLBACK_STYLE_URL,
  TERRAIN_CONFIG,
  DEFAULT_CAMERA,
  INCIDENT_CAMERA,
  ERROR_MESSAGE,
  ATTRIBUTIONS
} from '../src/config/mapConfig.js';

export async function testMapConfigAndLayers() {
  console.log('\n--- 2. Testing MapLibre GL Configuration & 3D Terrain Presets ---');

  // 2.1 Verify Style URLs
  assert.ok(typeof STYLE_URL === 'string' && STYLE_URL.length > 0, 'STYLE_URL must be defined');
  assert.ok(STYLE_URL.startsWith('http://') || STYLE_URL.startsWith('https://'), 'STYLE_URL must be a valid URL');
  assert.ok(typeof FALLBACK_STYLE_URL === 'string' && FALLBACK_STYLE_URL.startsWith('https://'), 'FALLBACK_STYLE_URL must be valid HTTPS');
  console.log(`  ✓ Primary base style URL: ${STYLE_URL}`);
  console.log(`  ✓ Fallback style URL: ${FALLBACK_STYLE_URL}`);

  // 2.2 Verify 3D Terrain Configuration
  assert.ok(TERRAIN_CONFIG, 'TERRAIN_CONFIG must exist');
  assert.ok(['maptiler-terrain-rgb', 'terrarium-dem'].includes(TERRAIN_CONFIG.sourceId), 'Valid DEM source ID');
  assert.equal(TERRAIN_CONFIG.source.type, 'raster-dem', 'Source type must be raster-dem');
  assert.ok(TERRAIN_CONFIG.exaggeration >= 1.0 && TERRAIN_CONFIG.exaggeration <= 3.0, 'Terrain vertical exaggeration in reasonable range');
  console.log(`  ✓ 3D Terrain configured: Source ID "${TERRAIN_CONFIG.sourceId}", Encoding: "${TERRAIN_CONFIG.source.encoding}", Exaggeration: ${TERRAIN_CONFIG.exaggeration}x`);

  // 2.3 Verify Camera Presets
  assert.ok(Array.isArray(DEFAULT_CAMERA.center) && DEFAULT_CAMERA.center.length === 2);
  const [cLng, cLat] = DEFAULT_CAMERA.center;
  assert.ok(cLng >= 102 && cLng <= 110, 'Default camera lng must center Vietnam');
  assert.ok(cLat >= 8 && cLat <= 24, 'Default camera lat must center Vietnam');
  assert.equal(DEFAULT_CAMERA.zoom, 5.2);
  assert.equal(DEFAULT_CAMERA.pitch, 35);
  console.log(`  ✓ Default Camera Preset verified: Center [${cLng}, ${cLat}], Zoom: ${DEFAULT_CAMERA.zoom}, Pitch: ${DEFAULT_CAMERA.pitch}°`);

  // 2.4 Verify Incident Focus Camera Preset
  assert.equal(INCIDENT_CAMERA.zoom, 13);
  assert.equal(INCIDENT_CAMERA.pitch, 60);
  assert.equal(INCIDENT_CAMERA.duration, 1800);
  console.log(`  ✓ Incident Camera Preset verified: High-tilt Zoom: ${INCIDENT_CAMERA.zoom}, Pitch: ${INCIDENT_CAMERA.pitch}°, Duration: ${INCIDENT_CAMERA.duration}ms`);

  // 2.5 Verify Error Messages and Legal Attributions
  assert.ok(ERROR_MESSAGE.includes('Không thể tải lớp bản đồ'));
  assert.ok(Array.isArray(ATTRIBUTIONS) && ATTRIBUTIONS.length >= 2);
  console.log(`  ✓ Legal map attributions verified (${ATTRIBUTIONS.length} attribution entries)`);

  console.log('✅ testMapConfigAndLayers PASSED!\n');
}

if (process.argv[1]?.endsWith('test-map-config-and-layers.mjs')) {
  testMapConfigAndLayers();
}
