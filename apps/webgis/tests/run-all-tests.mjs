import { testRiskZonesSpatial } from './test-risk-zones-spatial.mjs';
import { testMapConfigAndLayers } from './test-map-config-and-layers.mjs';
import { testComponentContracts } from './test-component-contracts.mjs';
import { testAuthAndRoleContracts } from './test-auth-and-role-contracts.mjs';
import { testResponsiveUtilities } from './test-responsive-utilities.mjs';
import { testBroadcastHistory } from './test-broadcast-history.mjs';
import { testRegisterErrors } from './test-register-errors.mjs';
import { testAoiCsvKpi } from './test-aoi-csv-kpi.mjs';
import { testAdminAudit } from './test-admin-audit.mjs';
import { testSystemHealth } from './test-system-health.mjs';
import { testModelCard } from './test-model-card.mjs';
import { testReviewKpi } from './test-review-kpi.mjs';
import { testLiveUpdates } from './test-live-updates.mjs';
import { testConfirmedLandslides } from './test-confirmed-landslides.mjs';
import { testTerrainAssessmentContracts } from './test-terrain-assessment-contracts.mjs';

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
    await testResponsiveUtilities();
    await testBroadcastHistory();
    await testRegisterErrors();
    await testAoiCsvKpi();
    await testAdminAudit();
    await testSystemHealth();
    await testModelCard();
    await testReviewKpi();
    await testLiveUpdates();
    await testConfirmedLandslides();
    await testTerrainAssessmentContracts();

    const elapsed = Date.now() - startTime;
    console.log('===============================================================');
    console.log(`🎉 ALL WEBGIS TESTS PASSED SUCCESSFULLY in ${elapsed}ms!`);
    console.log('   - 103 Landslide Susceptibility Zones Verified');
    console.log('   - MapLibre GL 3D Terrain Configuration Verified');
    console.log('   - Emergency Broadcast & Verification Contracts Verified');
    console.log('   - RBAC Security & Authentication Contracts Verified');
    console.log('   - Responsive Breakpoints & Viewport Contracts Verified');
    console.log('   - Server-side Broadcast History Mapping Verified');
    console.log('   - Registration Error Messages Verified');
    console.log('   - AOI Drawing Ring, CSV Export & KPI Strip Verified');
    console.log('===============================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ WEBGIS TEST FAILED:');
    console.error(error);
    process.exit(1);
  }
}

runAllWebGisTests();
