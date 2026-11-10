import React, { useEffect, useRef } from 'react';

// Nền đăng nhập: mây trôi (CSS) + mưa và sấm sét (canvas) + núi nhiều lớp có vụ sạt lở (SVG + CSS).
// Thuần trang trí (aria-hidden). Theo UX: UX/ux-TerraWatch-2026-11-07 (DESIGN.md, EXPERIENCE.md).
const WIND = 0.22;

// ── Địa hình và vụ sạt lở dựng bằng code, dùng số ngẫu nhiên có hạt giống để mỗi lần tải trang giống hệt nhau ──
const rng = (seed) => {
  let s = seed;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const f = (n) => n.toFixed(1);
const pathOf = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('');
const solid = (pts) => `${pathOf(pts)}L1440 300L0 300Z`;

// Sống núi tự nhiên: giữ nguyên các đỉnh chính, chia đôi mỗi đoạn và lệch điểm giữa (nhỏ dần qua mỗi vòng).
function ridge(points, rough, seed) {
  const r = rng(seed);
  let pts = points;
  for (let i = 0; i < 4; i++) {
    const amp = rough / 2 ** i;
    const next = [];
    pts.forEach((p, j) => {
      next.push(p);
      const q = pts[j + 1];
      if (q) next.push([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + (r() - 0.5) * 2 * amp]);
    });
    pts = next;
  }
  return pts;
}

// Rừng thông trên sườn núi gần: răng cưa nhọn dọc sống núi, cao thấp ngẫu nhiên.
function treeline(pts, seed) {
  const r = rng(seed);
  const yAt = (x) => {
    const i = pts.findIndex((p) => p[0] >= x);
    if (i <= 0) return pts[0][1];
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
  };
  const out = [];
  for (let x = 0; x <= 1440; x += 8) {
    const y = yAt(x);
    out.push([x, y], [x + 4, y - 3 - r() * 8]);
  }
  return out;
}

// Khe nứt: đa giác mỏng quanh đường gấp khúc, thon dần (both = thon cả hai đầu, như vết rạn hình cung).
function fissure(pts, width, both) {
  const n = pts.length - 1;
  const L = [];
  const R = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const t = i / n;
    const k = (width / 2) * (both ? Math.sin(Math.PI * t) ** 0.6 : (1 - t) ** 0.8);
    L.push([p[0] - ((b[1] - a[1]) / len) * k, p[1] + ((b[0] - a[0]) / len) * k]);
    R.push([p[0] + ((b[1] - a[1]) / len) * k, p[1] - ((b[0] - a[0]) / len) * k]);
  });
  return `${pathOf([...L, ...R.reverse()])}Z`;
}

// Một vụ sạt lở nằm trên sườn núi, chảy theo đường dốc. Hệ toạ độ riêng: (0,0) là vách trượt, trục y là hướng chảy xuống ~140 đơn vị,
// được xoay theo độ nghiêng sườn (rot, độ) khi đặt lên núi. Hẹp ở vách, loe rộng ở chân dốc như vết sạt thật.
// scar = mảng đất lộ ra; streaks = vệt dòng chảy; cracks = khe nứt; rocks = đá nảy; dust = bụi quanh chân dốc (không xoay, luôn bay lên trời).
function slide(seed, { x, y, k, rot }) {
  const r = rng(seed);
  const j = (n) => (r() - 0.5) * n;
  const jit = (pts, n = 2.5) => pts.map(([px, py]) => [px + j(n), py + j(n)]);
  // Đường tâm cong nhẹ theo địa hình, bề rộng nở dần từ ~10 ở vách lên ~60 ở chân dốc, mép lởm chởm.
  const phase = j(3);
  const cx = (t) => 12 * Math.sin(t * 2.6 + phase);
  const hw = (t) => 5 + 26 * t ** 0.85;
  const L = [];
  const R = [];
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    L.push([cx(t) - hw(t) * (1 + j(0.4)), t * 138 + j(3)]);
    R.push([cx(t) + hw(t) * (1 + j(0.4)), t * 138 + j(3)]);
  }
  const lobes = [[L[N][0] - 6, 146], [cx(1) - 8, 141], [cx(1) + 8, 151], [R[N][0] + 4, 144]]; // chân dốc loe thành quạt đất đá
  const scar = `${pathOf([...L, ...lobes, ...R.reverse()])}Z`;
  const streak = (t0, t1, off) => pathOf(Array.from({ length: 5 }, (_, i) => {
    const t = t0 + ((t1 - t0) * i) / 4;
    return [cx(t) + off * hw(t) + j(2.5), t * 138];
  }));
  const streaks = [streak(0.12, 0.6, -0.45), streak(0.3, 0.85, 0.1), streak(0.5, 0.95, 0.5)];
  const debris = Array.from({ length: 12 }, () => {
    const s = 1.2 + r() * 1.5;
    const x0 = cx(1) + j(2 * hw(1));
    const y0 = 124 + r() * 24;
    return `M${f(x0)} ${f(y0)}l${f(s * 2)} ${f(-s * 0.4)}l${f(s)} ${f(s * 1.3)}l${f(-s * 1.6)} ${f(s)}Z`;
  }).join('');
  const cracks = [
    fissure(jit([[-12, 8], [-6, 3], [0, 0], [6, 3], [12, 8]], 1), 2.2, true), // vách trượt
    fissure(jit([[-12, 9], [-16, 20], [-15, 32]], 1), 1.1, false), // khe nứt hai bên đầu sườn trượt
    fissure(jit([[13, 9], [18, 20], [17, 32]], 1), 1.1, false)
  ];
  const rocks = Array.from({ length: 7 }, (_, i) => {
    const s = 0.7 + r() * 0.9;
    return { d: `M0 0L${f(4 * s)} ${f(-s)}L${f(6 * s)} ${f(3 * s)}L${f(2 * s)} ${f(5 * s)}L${f(-2 * s)} ${f(2 * s)}Z`, x: -6 + r() * 12, y: 8 + r() * 36, dx: j(24), dy: 80 + r() * 40, rd: i * 0.35 };
  });
  const rad = (rot * Math.PI) / 180;
  const toe = [x - k * 125 * Math.sin(rad), y + k * 125 * Math.cos(rad)];
  const dust = Array.from({ length: 6 }, (_, i) => ({ x: -26 + i * 10.4 + j(6), y: -8 + j(10), r: 12 + r() * 9, dx: j(30), dd: i * 0.5 }));
  return { x, y, k, rot, toe, scar, streaks, debris, cracks, rocks, dust };
}

const FAR = ridge([[0, 150], [140, 110], [300, 140], [470, 95], [640, 130], [820, 85], [1000, 125], [1180, 90], [1320, 120], [1440, 100]], 12, 11);
const MID = ridge([[0, 210], [120, 150], [230, 190], [360, 110], [470, 170], [610, 90], [740, 160], [860, 120], [990, 180], [1120, 100], [1250, 160], [1360, 130], [1440, 170]], 8, 23);
const NEAR = treeline(ridge([[0, 250], [140, 205], [300, 240], [470, 195], [640, 245], [800, 210], [980, 250], [1150, 205], [1300, 240], [1440, 215]], 8, 37), 41);
// Hai vụ sạt lở trên sườn các đỉnh không bị thẻ đăng nhập che (một sườn phải, một sườn trái); cycle/delay (giây) lệch nhau để không xảy ra cùng lúc.
const SLIDES = [
  { cycle: 24, delay: 3, ...slide(5, { x: 645, y: 118, k: 1, rot: -35 }) },
  { cycle: 24, delay: 15, ...slide(9, { x: 335, y: 138, k: 0.85, rot: 35 }) }
];

// ── Sấm sét ──
// Tia sét: chia đôi đoạn thẳng, lệch điểm giữa một chút, lặp lại cho đến khi đủ gấp khúc.
function bolt(x0, y0, x1, y1, spread) {
  const pts = [[x0, y0]];
  const split = (a, b, d) => {
    if (d < 5) { pts.push(b); return; }
    const m = [(a[0] + b[0]) / 2 + (Math.random() - 0.5) * d, (a[1] + b[1]) / 2 + (Math.random() - 0.5) * d * 0.3];
    split(a, m, d / 2);
    split(m, b, d / 2);
  };
  split([x0, y0], [x1, y1], spread);
  return pts;
}

// Một cú sét: thân chính từ mép trên xuống gần sườn núi (dãy núi che phần chân tia sét) kèm 3 nhánh.
function strike(w, h) {
  const x = w * (0.1 + Math.random() * 0.6); // lệch về bên trái để không bị thẻ đăng nhập che hết
  const main = bolt(x, -10, x + (Math.random() - 0.5) * 160, h * (0.62 + Math.random() * 0.14), 140);
  const branches = Array.from({ length: 3 }, () => {
    const p = main[Math.floor(main.length * (0.3 + Math.random() * 0.4))];
    const dir = Math.random() < 0.5 ? -1 : 1;
    return bolt(p[0], p[1], p[0] + dir * (50 + Math.random() * 110), p[1] + 70 + Math.random() * 110, 60);
  });
  return { x, main, branches };
}

// Độ sáng theo thời gian: hai nháy liên tiếp rồi tắt dần, giống sét thật.
const flashAt = (ms) => (ms < 70 ? 1 : ms < 130 ? 0.15 : ms < 260 ? 0.9 : ms < 800 ? 0.9 * (1 - (ms - 260) / 540) : 0);

export default function LoginBackdrop() {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    // Người dùng chọn giảm chuyển động: không vẽ mưa và sét (CSS cũng dừng mây, vụ sạt lở đứng yên).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let drops = [];
    let raf = 0;
    let last = performance.now();
    let nextStrike = last + 2500; // cú sét đầu tiên sau ~2,5 s để người dùng thấy ngay
    let cur = null;
    let born = 0;

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
    const path = (pts) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    };
    const drawBolt = (s, k) => {
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(140,185,255,1)';
      ctx.shadowBlur = 22;
      ctx.strokeStyle = `rgba(190,215,255,${0.45 * k})`; // quầng sáng
      ctx.lineWidth = 6;
      path(s.main);
      ctx.strokeStyle = `rgba(245,250,255,${k})`;
      ctx.lineWidth = 2;
      path(s.main);
      ctx.lineWidth = 1;
      s.branches.forEach(path);
      ctx.shadowBlur = 0;
    };
    const tick = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      ctx.clearRect(0, 0, w, h);

      if (!cur && t >= nextStrike) { cur = strike(w, h); born = t; }
      const k = cur ? flashAt(t - born) : 0;
      if (cur && k === 0 && t - born > 800) { cur = null; nextStrike = t + 5000 + Math.random() * 8000; }
      // Class lg-strike (login.css) làm mây, sống núi và vết nứt sáng lên đúng nhịp chớp của tia sét.
      root.classList.toggle('lg-strike', k > 0.5);
      if (cur && k > 0) { // trời loé sáng quanh chân tia sét
        const g = ctx.createRadialGradient(cur.x, 0, 0, cur.x, 0, Math.max(w, h));
        g.addColorStop(0, `rgba(190,215,255,${0.28 * k})`);
        g.addColorStop(1, 'rgba(190,215,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

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
      if (cur && k > 0) drawBolt(cur, k);
      raf = requestAnimationFrame(tick); // trình duyệt tự tạm dừng khi tab bị ẩn
    };

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove('lg-strike');
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div ref={rootRef} className="lg-backdrop" aria-hidden="true">
      <div className="lg-cloud lg-c1" />
      <div className="lg-cloud lg-c2" />
      <div className="lg-cloud lg-c3" />
      <canvas ref={canvasRef} className="lg-rain" />
      <svg className="lg-ridge" viewBox="0 0 1440 300" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lg-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#24456A" stopOpacity=".7" />
            <stop offset="1" stopColor="#12263D" stopOpacity=".9" />
          </linearGradient>
          <linearGradient id="lg-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#10243D" />
            <stop offset="1" stopColor="#081322" />
          </linearGradient>
          <linearGradient id="lg-mist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7896B9" stopOpacity="0" />
            <stop offset=".5" stopColor="#7896B9" stopOpacity=".14" />
            <stop offset="1" stopColor="#7896B9" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lg-soil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5E4733" stopOpacity=".72" />
            <stop offset=".5" stopColor="#47362A" stopOpacity=".78" />
            <stop offset="1" stopColor="#2A2019" stopOpacity=".72" />
          </linearGradient>
          <linearGradient id="lg-soil-edge-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#04080F" stopOpacity=".6" />
            <stop offset=".3" stopColor="#04080F" stopOpacity="0" />
            <stop offset=".7" stopColor="#04080F" stopOpacity="0" />
            <stop offset="1" stopColor="#04080F" stopOpacity=".6" />
          </linearGradient>
          <radialGradient id="lg-dust-grad">
            <stop offset="0" stopColor="#A89A8A" stopOpacity=".6" />
            <stop offset="1" stopColor="#A89A8A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={solid(FAR)} fill="url(#lg-far)" />
        <path d={solid(MID)} fill="url(#lg-mid)" />
        <path className="lg-rim-crest" d={pathOf(MID)} />
        {SLIDES.map((s) => (
          <g key={s.x} style={{ '--d': `${s.cycle}s`, '--delay': `${s.delay}s` }}>
            <g transform={`translate(${s.x} ${s.y}) rotate(${s.rot}) scale(${s.k})`}>
              <g className="lg-slide-scar">
                <path className="lg-soil" d={s.scar} />
                <path className="lg-soil-edge" d={s.scar} />
                {s.streaks.map((d) => <path key={d} className="lg-streak" d={d} />)}
                <path className="lg-debris" d={s.debris} />
                <path className="lg-lit" d={s.scar} />
              </g>
              {s.cracks.map((d, i) => (
                <g key={d} className="lg-slide-crack" style={{ '--cd': `${i * 0.35}s` }}>
                  <path className="lg-fissure" d={d} />
                  <path className="lg-rim" d={d} />
                </g>
              ))}
              {s.rocks.map((p) => (
                <g key={`${p.x}-${p.y}`} transform={`translate(${f(p.x)} ${f(p.y)})`}>
                  <path className="lg-rock" d={p.d} style={{ '--dx': `${f(p.dx)}px`, '--dy': `${f(p.dy)}px`, '--rd': `${p.rd}s` }} />
                </g>
              ))}
            </g>
            <g transform={`translate(${f(s.toe[0])} ${f(s.toe[1])})`}>
              {s.dust.map((p) => (
                <circle key={`${p.x}-${p.y}`} className="lg-dust" cx={f(p.x)} cy={f(p.y)} r={f(p.r)} style={{ '--dx': `${f(p.dx)}px`, '--dd': `${p.dd}s` }} />
              ))}
            </g>
          </g>
        ))}
        <rect x="0" y="150" width="1440" height="100" fill="url(#lg-mist)" />
        <path d={solid(NEAR)} fill="#050A14" />
      </svg>
    </div>
  );
}
