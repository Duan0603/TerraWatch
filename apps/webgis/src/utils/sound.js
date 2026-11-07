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

