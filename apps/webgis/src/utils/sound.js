// Web Audio API siren / beep - phát âm báo thật trực tiếp trên trình duyệt mà không cần tệp âm thanh bên ngoài
let _audioCtx = null;

function getAudioCtx() {
  if (!_audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      _audioCtx = new AudioContextClass();
    }
  }
  return _audioCtx;
}

/**
 * Phát âm bíp thông báo thật (hai âm kép 880Hz -> 660Hz).
 */
export function playAlertBeep() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    // Beep 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Beep 2 (hơi cao hơn)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.18);
    gain2.gain.setValueAtTime(0.25, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.35);
  } catch (err) {
    console.warn('Không thể phát âm báo (trình duyệt chặn trước tương tác):', err);
  }
}

let _sirenUntil = 0;

/**
 * Còi báo động kiểu phòng không: tiếng hú lên xuống 600 ↔ 1300 Hz, mỗi chu kỳ 1,5 giây.
 * Hai dao động răng cưa lệch nhau vài cent cho tiếng dày như còi thật, qua bộ lọc thông thấp để bớt chói.
 * Gọi lại khi còi đang kêu thì bỏ qua, để các cảnh báo dồn dập không chồng tiếng lên nhau.
 */
export function playAlertSiren(seconds = 4.5) {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime, end = now + seconds;
    if (now < _sirenUntil) return;
    _sirenUntil = end;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.15);
    gain.gain.setValueAtTime(0.16, end - 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    filter.connect(gain);
    gain.connect(ctx.destination);

    for (const detune of [0, 9]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.detune.setValueAtTime(detune, now);
      osc.frequency.setValueAtTime(600, now);
      for (let t = now; t < end; t += 1.5) {
        osc.frequency.linearRampToValueAtTime(1300, Math.min(t + 0.9, end)); // lên chậm
        osc.frequency.linearRampToValueAtTime(600, Math.min(t + 1.5, end)); // xuống nhanh hơn
      }
      osc.connect(filter);
      osc.start(now);
      osc.stop(end);
    }
  } catch (err) {
    console.warn('Không thể phát còi báo động (trình duyệt chặn trước tương tác):', err);
  }
}

