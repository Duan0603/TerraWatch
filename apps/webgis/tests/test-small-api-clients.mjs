import assert from 'node:assert/strict';
import { importSrc } from './helpers/load-src.mjs';

// HTTP layer = stub axiosClient (tests/helpers/stub-loader.mjs): records calls, replies from `reply`.
function recorder(reply = async () => ({ ok: true })) {
  const calls = [];
  globalThis.__tw = { http: async (method, url, ...rest) => { calls.push({ method, url, args: rest }); return reply(method, url, ...rest); } };
  return calls;
}

async function testAdminApi() {
  console.log('\n▶ testAdminApi');
  const { adminApi } = await importSrc('api/adminApi.js');
  try {
    let calls = recorder(async () => ({ items: [1] }));
    assert.deepEqual(await adminApi.getUsers(), { items: [1] });
    assert.deepEqual(calls[0], { method: 'get', url: '/admin/users', args: [{ params: {} }] });
    calls = recorder();
    await adminApi.getUsers({ search: 'an', status: 'active' });
    assert.deepEqual(calls[0].args, [{ params: { search: 'an', status: 'active' } }]);
    console.log('  ✓ getUsers: GET /admin/users, params mặc định {} hoặc truyền nguyên');

    calls = recorder();
    await adminApi.updateUserStatus('u-1', false);
    await adminApi.updateUserRole('u-1', 'officer');
    assert.deepEqual(calls, [
      { method: 'patch', url: '/admin/users/u-1/status', args: [{ isActive: false }] },
      { method: 'patch', url: '/admin/users/u-1/role', args: [{ role: 'officer' }] }
    ]);
    console.log('  ✓ updateUserStatus / updateUserRole: PATCH đúng path và body');

    calls = recorder();
    await adminApi.getAudit();
    await adminApi.getAudit(25);
    assert.deepEqual(calls.map((c) => c.args), [[{ params: { limit: 200 } }], [{ params: { limit: 25 } }]]);
    assert.ok(calls.every((c) => c.method === 'get' && c.url === '/admin/audit'));
    console.log('  ✓ getAudit: limit mặc định 200');

    calls = recorder();
    await adminApi.getSystemHealth();
    await adminApi.approveOfficer('u-2');
    await adminApi.rejectOfficer('u-3');
    assert.deepEqual(calls, [
      { method: 'get', url: '/admin/system-health', args: [] },
      { method: 'post', url: '/admin/users/u-2/approve', args: [] },
      { method: 'post', url: '/admin/users/u-3/reject', args: [] }
    ]);
    console.log('  ✓ getSystemHealth / approveOfficer / rejectOfficer: method và path');

    // adminApi không bắt lỗi: UI nhận đúng lỗi gốc để tự hiển thị.
    const err = Object.assign(new Error('x'), { response: { status: 403 } });
    recorder(async () => { throw err; });
    for (const fn of [() => adminApi.getUsers(), () => adminApi.updateUserRole('u', 'admin'), () => adminApi.approveOfficer('u')]) {
      await assert.rejects(fn, (e) => e === err);
    }
    console.log('  ✓ lỗi HTTP được ném lại nguyên vẹn');
  } finally { delete globalThis.__tw; }
  console.log('✅ testAdminApi PASSED!');
}

async function testLandslideAndRainWarningApi() {
  console.log('\n▶ testLandslideAndRainWarningApi');
  const landslideApi = (await importSrc('api/landslideApi.js')).default;
  const rainWarningApi = (await importSrc('api/rainWarningApi.js')).default;
  try {
    let calls = recorder(async () => ({ type: 'FeatureCollection', features: [] }));
    assert.deepEqual(await landslideApi.getConfirmed(), { type: 'FeatureCollection', features: [] });
    await landslideApi.getExperimentalRisk();
    assert.deepEqual(calls, [
      { method: 'get', url: '/landslides/active', args: [] },
      { method: 'get', url: '/gis/rainfall/live/map', args: [] }
    ]);
    console.log('  ✓ landslideApi: getConfirmed / getExperimentalRisk gọi đúng path và trả dữ liệu');

    calls = recorder();
    await rainWarningApi.getSites();
    await rainWarningApi.getLive(21.03, 105.85);
    assert.deepEqual(calls, [
      { method: 'get', url: '/gis/rainfall/warning/sites', args: [] },
      { method: 'get', url: '/gis/rainfall/live', args: [{ params: { latitude: 21.03, longitude: 105.85 } }] }
    ]);
    console.log('  ✓ rainWarningApi: getSites, getLive đổi (lat, lon) thành params latitude/longitude');

    calls = recorder();
    await rainWarningApi.getReplay('site 1/α?x=1');
    assert.equal(calls[0].url, '/gis/rainfall/warning/replay/site%201%2F%CE%B1%3Fx%3D1');
    await rainWarningApi.getReplay('plain-7');
    assert.equal(calls[1].url, '/gis/rainfall/warning/replay/plain-7');
    console.log('  ✓ getReplay: id được encodeURIComponent (không phá path)');

    const err = Object.assign(new Error('x'), { response: { status: 503 } });
    recorder(async () => { throw err; });
    await assert.rejects(() => landslideApi.getConfirmed(), (e) => e === err);
    await assert.rejects(() => rainWarningApi.getSites(), (e) => e === err);
    console.log('  ✓ lỗi HTTP được ném lại nguyên vẹn');
  } finally { delete globalThis.__tw; }
  console.log('✅ testLandslideAndRainWarningApi PASSED!');
}

async function testModelCardApi() {
  console.log('\n▶ testModelCardApi');
  const mod = await importSrc('api/modelCardApi.js');
  try {
    const card = { segmentation: { ready: true }, gru: { ready: false } };
    const calls = recorder(async () => card);
    assert.equal(await mod.getModelCard(), card);
    assert.equal(await mod.default.getModelCard(), card);
    assert.deepEqual(calls.map((c) => [c.method, c.url, c.args.length]), [['get', '/model-card', 0], ['get', '/model-card', 0]]);
    const err = Object.assign(new Error('x'), { response: { status: 403 } });
    recorder(async () => { throw err; });
    await assert.rejects(() => mod.getModelCard(), (e) => e === err);
    console.log('  ✓ getModelCard: GET /model-card, trả dữ liệu, ném lại lỗi gốc');
  } finally { delete globalThis.__tw; }
  console.log('✅ testModelCardApi PASSED!');
}

export async function testSmallApiClients() {
  await testAdminApi();
  await testLandslideAndRainWarningApi();
  await testModelCardApi();
}
