import React, { useRef } from 'react';

// Sáu ô nhập mã OTP: tự nhảy ô, Backspace lùi ô, dán cả mã một lần.
export default function OtpBoxes({ value, onChange, disabled }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  const setAt = (i, ch) => {
    const next = digits.slice();
    next[i] = ch;
    onChange(next.join('').slice(0, 6));
  };
  const handleChange = (i, raw) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) { setAt(i, ''); return; }
    if (clean.length > 1) { // dán nhiều số
      onChange((value.slice(0, i) + clean).slice(0, 6));
      refs.current[Math.min(i + clean.length, 5)]?.focus();
      return;
    }
    setAt(i, clean);
    if (i < 5) refs.current[i + 1]?.focus();
  };
  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  };

  return (
    <div className="lg-otp" role="group" aria-label="Mã OTP gồm 6 chữ số">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className="lg-otp-box"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={6}
          value={d}
          disabled={disabled}
          autoFocus={i === 0}
          aria-label={`Chữ số ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
