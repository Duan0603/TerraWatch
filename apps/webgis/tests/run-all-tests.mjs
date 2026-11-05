import { testRiskZonesSpatial } from './test-risk-zones-spatial.mjs';
import { testMapConfigAndLayers } from './test-map-config-and-layers.mjs';
import { testComponentContracts } from './test-component-contracts.mjs';
import { testAuthAndRoleContracts } from './test-auth-and-role-contracts.mjs';

async function runAllWebGisTests() {
  console.log('===============================================================');
  console.log('   TerraWatch WebGIS Automated Test & Geospatial Verification  ');
  console.log('===============================================================');
  const startTime = Date.now();

  try {
    await testRiskZonesSpatial();
    await testMapConfigAndLayers();
    await testComponentContracts();
    await testAuthAndRoleContracts();

    const elapsed = Date.now() - startTime;
    console.log('===============================================================');
    console.log(`🎉 ALL WEBGIS TESTS PASSED SUCCESSFULLY in ${elapsed}ms!`);
    console.log('   - 103 Landslide Susceptibility Zones Verified');
    console.log('   - MapLibre GL 3D Terrain Configuration Verified');
    console.log('   - Emergency Broadcast & Verification Contracts Verified');
    console.log('   - RBAC Security & Authentication Contracts Verified');
    console.log('===============================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ WEBGIS TEST FAILED:');
    console.error(error);
    process.exit(1);
  }
}

runAllWebGisTests();
