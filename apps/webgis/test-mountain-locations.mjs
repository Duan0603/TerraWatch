import assert from 'node:assert/strict';

// Test import of mountainLocations (should fail before file exists or if invalid)
async function runTests() {
  console.log('Testing mountainLocations.js...');
  
  let module;
  try {
    module = await import('./src/data/mountainLocations.js');
  } catch (err) {
    console.error('Failed to import mountainLocations.js:', err.message);
    process.exit(1);
  }

  const { MOUNTAIN_LOCATIONS, DEFAULT_LOCATION_ID, getLocationById } = module;

  assert.ok(Array.isArray(MOUNTAIN_LOCATIONS), 'MOUNTAIN_LOCATIONS must be an array');
  assert.equal(MOUNTAIN_LOCATIONS.length, 8, 'MOUNTAIN_LOCATIONS must have exactly 8 items');
  assert.equal(DEFAULT_LOCATION_ID, 'vietnam', 'DEFAULT_LOCATION_ID must be "vietnam"');
  assert.equal(typeof getLocationById, 'function', 'getLocationById must be a function');

  const requiredIds = [
    'vietnam',
    'lao-cai',
    'ha-giang',
    'yen-bai',
    'son-la',
    'dien-bien',
    'cao-bang',
    'lai-chau'
  ];

  requiredIds.forEach(id => {
    const loc = getLocationById(id);
    assert.ok(loc, `Location "${id}" must exist`);
    assert.equal(loc.id, id, `Location id must match "${id}"`);
    assert.ok(typeof loc.name === 'string' && loc.name.length > 0, `Location "${id}" must have a name`);
    assert.ok(Array.isArray(loc.center) && loc.center.length === 2, `Location "${id}" center must be [lng, lat]`);
    
    const [lng, lat] = loc.center;
    // MapLibre longitude first: Vietnam lng ~ 102 to 110, lat ~ 8 to 24
    assert.ok(lng >= 102 && lng <= 110, `Location "${id}" lng ${lng} out of Vietnam bounds [102, 110]`);
    assert.ok(lat >= 8 && lat <= 24, `Location "${id}" lat ${lat} out of Vietnam bounds [8, 24]`);
    assert.equal(loc.lng, lng, `Location "${id}" lng must match center[0]`);
    assert.equal(loc.lat, lat, `Location "${id}" lat must match center[1]`);
    
    assert.ok(typeof loc.zoom === 'number' && loc.zoom >= 4 && loc.zoom <= 18, `Location "${id}" zoom must be valid`);
    assert.ok(typeof loc.pitch === 'number' && loc.pitch >= 0 && loc.pitch <= 85, `Location "${id}" pitch must be valid`);
    assert.ok(typeof loc.bearing === 'number', `Location "${id}" bearing must be a number`);
  });

  // Test unknown id
  assert.equal(getLocationById('unknown-province'), undefined, 'Unknown ID should return undefined');

  console.log('✅ All mountainLocations unit tests passed successfully!');
}

runTests();
