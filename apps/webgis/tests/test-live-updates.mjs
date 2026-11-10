import assert from 'node:assert/strict';
import { parseSse, reconnectDelay, connectLiveUpdates } from '../src/api/liveUpdates.js';

// Story 4.35: luồng sự kiện của dashboard - bóc tách, nối lại, dừng khi hết quyền.
const enc = new TextEncoder();

function streamOf(chunks) {
  return new ReadableStream({
    start(c) { chunks.forEach(x => c.enqueue(enc.encode(x))); c.close(); }
  });
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

export async function testLiveUpdates() {
  console.log('\n▶ testLiveUpdates');

  let p = parseSse('event: hello\ndata: {}\n\nevent: update\ndata: {"type":"queue"}\n\nevent: upd');
  assert.deepEqual(p.events, [{ name: 'hello', data: '{}' }, { name: 'update', data: '{"type":"queue"}' }]);
  assert.equal(p.rest, 'event: upd');
  p = parseSse(p.rest + 'ate\ndata: {"type":"broadcasts"}\n\n');
  assert.deepEqual(p.events, [{ name: 'update', data: '{"type":"broadcasts"}' }]);
  assert.equal(parseSse(':ping\n\n').events.length, 0);
  assert.equal(parseSse('event:update\r\ndata:{"type":"x"}\r\n\r\n').events[0].data, '{"type":"x"}');
  console.log('  ✓ bóc tách: sự kiện trọn vẹn, phần dở dang giữ lại, bỏ dòng :ping, hỗ trợ CRLF');

  assert.deepEqual([0, 1, 2, 3, 4, 10].map(reconnectDelay), [2000, 4000, 8000, 16000, 30000, 30000]);
  console.log('  ✓ nối lại: 2 s, 4 s, 8 s ... tối đa 30 s');

  const got = []; const status = [];
  const stop = connectLiveUpdates({
    url: 'http://x/stream', getToken: () => 't',
    onUpdate: (t) => got.push(t), onStatus: (s) => status.push(s),
    fetchImpl: async (url, init) => {
      assert.equal(init.headers.Authorization, 'Bearer t');
      assert.ok(!url.includes('t=') && !url.includes('token'), 'token never goes in the URL');
      return { ok: true, status: 200, body: streamOf(['event: hello\ndata: {}\n\n', 'event: update\ndata: {"type":"queue"}\n\n']) };
    }
  });
  await wait(60);
  stop();
  assert.deepEqual(got, ['queue']);
  assert.equal(status[0], true);
  assert.equal(status.at(-1), false);
  console.log('  ✓ kết nối: hello báo đã nối, update chuyển đúng loại, token nằm ở header');

  let calls = 0;
  const stop401 = connectLiveUpdates({
    url: 'http://x/stream', getToken: () => 'expired',
    fetchImpl: async () => { calls++; return { ok: false, status: 401, body: null }; }
  });
  await wait(60);
  stop401();
  assert.equal(calls, 1, 'a 401 is not retried');
  console.log('  ✓ 401/403: dừng hẳn, không thử lại');
  console.log('✅ testLiveUpdates PASSED!');
}
