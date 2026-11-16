import assert from 'node:assert/strict';
import { importSrc, setGlobal } from './helpers/load-src.mjs';

// Fake Web Audio: records oscillator/gain scheduling.
function fakeAudioContext({ state = 'running', throwOn } = {}) {
  const log = { oscillators: [], gains: [], filters: [], resumed: 0, created: 0 };
  class Ctx {
    constructor() { log.created++; this.state = state; this.currentTime = 10; this.destination = { dest: true }; }
    resume() { log.resumed++; }
    createOscillator() {
      if (throwOn === 'osc') throw new Error('blocked');
      const o = { connected: [], frequencyCalls: [], ramps: [], detuneCalls: [], connect(n) { this.connected.push(n); }, start(t) { this.startAt = t; }, stop(t) { this.stopAt = t; }, frequency: { setValueAtTime: (...a) => o.frequencyCalls.push(a), linearRampToValueAtTime: (...a) => o.ramps.push(a) }, detune: { setValueAtTime: (...a) => o.detuneCalls.push(a) } };
      log.oscillators.push(o); return o;
    }
    createBiquadFilter() {
      const f = { connected: [], connect(n) { this.connected.push(n); }, frequency: { setValueAtTime: (...a) => { f.cutoff = a; } } };
      log.filters.push(f); return f;
    }
    createGain() {
      const g = { connected: [], gainCalls: [], ramps: [], connect(n) { this.connected.push(n); }, gain: { setValueAtTime: (...a) => g.gainCalls.push(a), exponentialRampToValueAtTime: (...a) => g.ramps.push(a) } };
      log.gains.push(g); return g;
    }
  }
  return { Ctx, log };
}

export async function testSound() {
  console.log('\n▶ testSound');
  const warns = [];
  const origWarn = console.warn; console.warn = (...a) => warns.push(a);
  const restore = [];
  try {
    // Không có Web Audio API: không ném lỗi, không cảnh báo.
    restore.push(setGlobal('window', {}));
    let mod = await importSrc('utils/sound.js', { fresh: true });
    assert.equal(mod.playAlertBeep(), undefined);
    assert.equal(warns.length, 0);
    console.log('  ✓ thiếu AudioContext: im lặng, không ném lỗi');

    // Chỉ có webkitAudioContext (Safari cũ): vẫn phát.
    const wk = fakeAudioContext();
    restore.push(setGlobal('window', { webkitAudioContext: wk.Ctx }));
    mod = await importSrc('utils/sound.js', { fresh: true });
    mod.playAlertBeep();
    assert.equal(wk.log.oscillators.length, 2);
    console.log('  ✓ webkitAudioContext được dùng khi không có AudioContext');

    // Đường chính: 2 bíp, đúng tần số/thời điểm, chuỗi nối osc -> gain -> destination.
    const ok = fakeAudioContext();
    restore.push(setGlobal('window', { AudioContext: ok.Ctx, webkitAudioContext: fakeAudioContext().Ctx }));
    mod = await importSrc('utils/sound.js', { fresh: true });
    mod.playAlertBeep();
    const [o1, o2] = ok.log.oscillators; const [g1, g2] = ok.log.gains;
    assert.equal(ok.log.created, 1);
    assert.deepEqual(o1.frequencyCalls, [[880, 10]]);
    assert.deepEqual(o2.frequencyCalls, [[1174.66, 10.18]]);
    assert.equal(o1.type, 'sine'); assert.equal(o2.type, 'sine');
    assert.deepEqual([o1.startAt, o1.stopAt], [10, 10.15]);
    assert.deepEqual([o2.startAt, o2.stopAt], [10.18, 10.35]);
    assert.deepEqual(o1.connected, [g1]); assert.deepEqual(g1.connected, [{ dest: true }]);
    assert.deepEqual(o2.connected, [g2]); assert.deepEqual(g2.connected, [{ dest: true }]);
    assert.deepEqual(g1.gainCalls, [[0.2, 10]]); assert.deepEqual(g2.gainCalls, [[0.25, 10.18]]);
    assert.equal(g1.ramps[0][0], 0.001); assert.equal(g2.ramps[0][0], 0.001);
    assert.equal(ok.log.resumed, 0);
    console.log('  ✓ playAlertBeep: hai bíp 880 Hz và 1174.66 Hz, đúng thời điểm, nối đúng chuỗi');

    // Dùng lại một AudioContext cho các lần gọi sau.
    mod.playAlertBeep();
    assert.equal(ok.log.created, 1);
    assert.equal(ok.log.oscillators.length, 4);
    console.log('  ✓ AudioContext chỉ tạo một lần');

    // Trình duyệt chặn trước tương tác (suspended): gọi resume().
    const sus = fakeAudioContext({ state: 'suspended' });
    restore.push(setGlobal('window', { AudioContext: sus.Ctx }));
    mod = await importSrc('utils/sound.js', { fresh: true });
    mod.playAlertBeep();
    assert.equal(sus.log.resumed, 1);
    assert.equal(sus.log.oscillators.length, 2);
    console.log('  ✓ context suspended: resume() rồi vẫn phát');

    // Còi báo động: 2 dao động răng cưa lệch 9 cent, hú 600 <-> 1300 Hz, osc -> lọc -> gain -> loa; không chồng tiếng.
    const sir = fakeAudioContext();
    restore.push(setGlobal('window', { AudioContext: sir.Ctx }));
    mod = await importSrc('utils/sound.js', { fresh: true });
    mod.playAlertSiren();
    const [s1, s2] = sir.log.oscillators; const [flt] = sir.log.filters; const [sg] = sir.log.gains;
    assert.equal(sir.log.oscillators.length, 2);
    assert.equal(s1.type, 'sawtooth'); assert.equal(s2.type, 'sawtooth');
    assert.deepEqual([s1.detuneCalls, s2.detuneCalls], [[[0, 10]], [[9, 10]]]);
    assert.deepEqual(s1.frequencyCalls, [[600, 10]]);
    assert.deepEqual(s1.ramps.map(r => r[0]), [1300, 600, 1300, 600, 1300, 600]);
    assert.deepEqual(s1.ramps.at(-1), [600, 14.5]);
    assert.ok(s1.ramps.every(r => r[1] <= 14.5));
    assert.deepEqual([s1.startAt, s1.stopAt], [10, 14.5]);
    assert.equal(flt.type, 'lowpass');
    assert.deepEqual(s1.connected, [flt]); assert.deepEqual(flt.connected, [sg]); assert.deepEqual(sg.connected, [{ dest: true }]);
    assert.equal(sg.ramps.at(-1)[0], 0.0001);
    mod.playAlertSiren(); // còn đang kêu: bỏ qua
    assert.equal(sir.log.oscillators.length, 2);
    console.log('  ✓ playAlertSiren: hai dao động răng cưa hú 600 ↔ 1300 Hz trong 4,5 giây, không chồng tiếng');

    // Web Audio ném lỗi: nuốt lỗi, chỉ console.warn.
    const bad = fakeAudioContext({ throwOn: 'osc' });
    restore.push(setGlobal('window', { AudioContext: bad.Ctx }));
    mod = await importSrc('utils/sound.js', { fresh: true });
    assert.doesNotThrow(() => mod.playAlertBeep());
    assert.equal(warns.length, 1);
    assert.match(warns[0][0], /Không thể phát âm báo/);
    assert.equal(warns[0][1].message, 'blocked');
    // constructor ném lỗi cũng được nuốt
    restore.push(setGlobal('window', { AudioContext: class { constructor() { throw new Error('no audio device'); } } }));
    mod = await importSrc('utils/sound.js', { fresh: true });
    assert.doesNotThrow(() => mod.playAlertBeep());
    assert.equal(warns.length, 2);
    console.log('  ✓ Web Audio ném lỗi: không ném ra ngoài, ghi console.warn kèm lỗi gốc');
  } finally {
    console.warn = origWarn;
    restore.reverse().forEach((r) => r());
  }
  console.log('✅ testSound PASSED!');
}
