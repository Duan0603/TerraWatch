import React, { useEffect, useRef } from 'react';

// Nền đăng nhập: mây trôi (CSS) + mưa rơi (canvas) + hai dãy núi tĩnh.
// Thuần trang trí (aria-hidden). Theo UX: UX/ux-TerraWatch-2026-11-07 (DESIGN.md, EXPERIENCE.md).
const WIND = 0.22;

export default function LoginBackdrop() {
  const canvasRef = useRef(null);

  useEffect(() => {
    // Người dùng chọn giảm chuyển động: không vẽ mưa (CSS cũng dừng mây).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let drops = [];
    let raf = 0;
    let last = performance.now();

    const make = () => {
      const z = Math.random(); // độ sâu: hạt xa nhỏ, chậm, mờ; hạt gần dài, nhanh
      return { x: Math.random() * (w + 200) - 100, y: Math.random() * h, len: 10 + z * 18, v: 380 + z * 520, a: 0.12 + z * 0.3, wd: 0.6 + z * 0.8 };
    };
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // shortcut: số hạt theo diện tích, chặn 70-220 để máy yếu vẫn mượt; tăng nếu cần mưa dày hơn.
      const n = Math.round(Math.min(220, Math.max(70, (w * h) / 9000)));
      drops = Array.from({ length: n }, make);
    };
    const tick = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';
      for (const d of drops) {
        d.y += d.v * dt;
        d.x += d.v * WIND * dt;
        if (d.y > h + 30 || d.x > w + 60) { d.y = -30; d.x = Math.random() * (w + 200) - 140; }
        ctx.strokeStyle = `rgba(190,215,235,${d.a})`;
        ctx.lineWidth = d.wd;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len * WIND, d.y - d.len);
        ctx.stroke();
      }
      raf = requestAnimationFrame(tick); // trình duyệt tự tạm dừng khi tab bị ẩn
    };

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="lg-backdrop" aria-hidden="true">
      <div className="lg-cloud lg-c1" />
      <div className="lg-cloud lg-c2" />
      <div className="lg-cloud lg-c3" />
      <canvas ref={canvasRef} className="lg-rain" />
      <svg className="lg-ridge" viewBox="0 0 1440 300" preserveAspectRatio="none">
        <path d="M0 210 L120 150 L230 190 L360 110 L470 170 L610 90 L740 160 L860 120 L990 180 L1120 100 L1250 160 L1360 130 L1440 170 L1440 300 L0 300Z" fill="#0A1626" opacity=".85" />
        <path d="M0 250 L140 205 L300 240 L470 195 L640 245 L800 210 L980 250 L1150 205 L1300 240 L1440 215 L1440 300 L0 300Z" fill="#060C18" />
      </svg>
    </div>
  );
}
