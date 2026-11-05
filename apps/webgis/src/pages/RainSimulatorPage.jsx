import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, RefreshCw } from 'lucide-react';
import { simulateRainfall } from '../api/simulateApi';
import './RainSimulatorPage.css';

const SCENARIOS = [
  { id: 'dry',      icon: '☀️',  label: 'Khô hạn',    sub: '< 10 mm / 7 ngày' },
  { id: 'moderate', icon: '🌦️', label: 'Trung bình',  sub: '80 – 120 mm / 7 ngày' },
  { id: 'heavy',    icon: '🌧️', label: 'Mưa to',      sub: '400 – 500 mm / 7 ngày' },
  { id: 'extreme',  icon: '⛈️', label: 'Cực đoan',    sub: '800+ mm / 7 ngày · tái hiện Làng Nủ' },
];

const TERRAINS = [
  { id: 'batxat',     icon: '⛰️', label: 'Bát Xát, Lào Cai',         stats: 'Dốc 28°, sét cao' },
  { id: 'sapa',       icon: '🌿', label: 'Sa Pa, Lào Cai',            stats: 'Dốc 22°, rừng' },
  { id: 'thuongxuan', icon: '🏞️', label: 'Thường Xuân, Thanh Hóa',   stats: 'Dốc 20°, đất pha' },
  { id: 'thoai',      icon: '🌾', label: 'Địa hình thoải (tham chiếu)', stats: 'Dốc 7°, an toàn' },
];

const ALERT_CONFIG = {
  SAFE:    { cls: 'rsim-alert-safe',    icon: '✅', label: 'AN TOÀN',      sub: 'Nguy cơ sạt lở thấp' },
  LOW:     { cls: 'rsim-alert-low',     icon: '🟢', label: 'NGUY CƠ THẤP', sub: 'Theo dõi thêm' },
  MEDIUM:  { cls: 'rsim-alert-medium',  icon: '🟡', label: 'NGUY CƠ TRUNG BÌNH', sub: 'Chú ý diễn biến mưa' },
  HIGH:    { cls: 'rsim-alert-high',    icon: '🟠', label: 'NGUY CƠ CAO',  sub: 'Cảnh báo — theo dõi chặt' },
  EXTREME: { cls: 'rsim-alert-extreme', icon: '🔴', label: 'CỰC NGUY HIỂM', sub: '⚠️ Cảnh báo khẩn — sơ tán nếu cần' },
};

const BAR_COLORS = ['#60a5fa', '#38bdf8', '#34d399', '#fbbf24', '#f97316', '#ef4444', '#dc2626'];

function scoreColor(v) {
  if (v < 0.25) return '#22c55e';
  if (v < 0.50) return '#eab308';
  if (v < 0.70) return '#f97316';
  return '#ef4444';
}

function RainGauge({ value }) {
  const R = 70, cx = 90, cy = 90;
  const startAngle = -210, endAngle = 30; // 240 deg sweep
  const sweep = endAngle - startAngle;
  const circumference = (Math.PI / 180) * sweep * R;
  const filled = circumference * Math.min(value, 1);
  const gap = circumference - filled;

  const toXY = (deg) => {
    const rad = (deg - 90) * Math.PI / 180;
    return [cx + R * Math.cos(rad), cy + R * Math.sin(rad)];
  };
  const [sx, sy] = toXY(startAngle);
  const [ex, ey] = toXY(endAngle);
  const large = sweep > 180 ? 1 : 0;

  return (
    <svg viewBox="0 0 180 110" width={180} height={110} className="rsim-gauge-svg" aria-label={`Điểm nguy cơ ${(value * 100).toFixed(1)}%`}>
      <path className="rsim-gauge-track" fill="none"
        d={`M${sx},${sy} A${R},${R} 0 ${large},1 ${ex},${ey}`} />
      <path className="rsim-gauge-fill" fill="none"
        stroke={scoreColor(value)}
        strokeDasharray={`${filled} ${gap + 0.01}`}
        d={`M${sx},${sy} A${R},${R} 0 ${large},1 ${ex},${ey}`} />
      <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle"
        className="rsim-gauge-label" fill={scoreColor(value)}>
        {(value * 100).toFixed(1)}%
      </text>
      <text x={cx} y={cy + 24} textAnchor="middle" className="rsim-gauge-sub">Điểm nguy cơ</text>
    </svg>
  );
}

function RainChart({ daily, forecast, maxPossible = 220 }) {
  if (!daily || !daily.length) return null;
  const max = Math.max(...daily, maxPossible * 0.1, 1);
  const peakIdx = daily.indexOf(Math.max(...daily));
  const totalForecastMax = maxPossible;

  return (
    <div>
      <div className="rsim-bars" role="img" aria-label="Biểu đồ mưa 7 ngày">
        {daily.map((val, i) => {
          const h = Math.max((val / max) * 130, val > 0 ? 2 : 0);
          return (
            <div key={i} className="rsim-bar-wrap">
              <span className="rsim-bar-val">{Math.round(val)}</span>
              <div className="rsim-bar" title={`Ngày T-${7 - i}: ${val.toFixed(1)} mm`}
                style={{ height: h, background: BAR_COLORS[Math.min(i, BAR_COLORS.length - 1)] }}
                data-peak={i === peakIdx ? '' : undefined} />
              <span className="rsim-bar-day">T-{7 - i}</span>
            </div>
          );
        })}
      </div>
      <div className="rsim-forecast-row">
        <span className="rsim-forecast-label">📅 Dự báo +24h</span>
        <div className="rsim-forecast-bar-wrap">
          <div className="rsim-forecast-bar" style={{ width: `${Math.min(100, forecast / totalForecastMax * 100)}%` }} />
        </div>
        <span className="rsim-forecast-val">{forecast.toFixed(0)} mm</span>
      </div>
    </div>
  );
}

export default function RainSimulatorPage() {
  const [scenario, setScenario] = useState('heavy');
  const [terrain, setTerrain] = useState('batxat');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = useCallback(async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await simulateRainfall({ scenario, terrain });
      setResult(data);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Lỗi kết nối AI service');
    } finally {
      setLoading(false);
    }
  }, [scenario, terrain]);

  const alert = result ? ALERT_CONFIG[result.alert_level] ?? ALERT_CONFIG.MEDIUM : null;
  const selectedTerrain = TERRAINS.find(t => t.id === terrain);
  const hasData = !!result;

  return (
    <div className="rsim-page">
      <header className="rsim-header">
        <Link to="/" className="rsim-back"><ArrowLeft size={17} /><span>TerraWatch</span></Link>
        <div className="rsim-title">
          <h1>Mô phỏng mưa – Phát hiện sạt lở</h1>
          <span>GRU hai nhánh · Mưa 168 giờ + địa hình · Thời gian thực</span>
        </div>
        <Link to="/auto-sim" className="rsim-autosim-btn" title="Chạy kiểm thử 16 kịch bản tự động">⚡ Kiểm thử tự động</Link>
        <div className="rsim-live-badge"><span className="rsim-dot" /><span>LIVE AI</span></div>
      </header>

      <div className="rsim-notice">
        <ShieldCheck size={15} />
        Mô hình nghiên cứu, chưa dùng để cảnh báo thực tế. Điểm nguy cơ không phải xác suất sạt lở đã hiệu chỉnh.
      </div>

      <main className="rsim-layout">
        {/* Left: Controls */}
        <aside className="rsim-left">
          <p className="rsim-section-title">Kịch bản mưa</p>
          <div className="rsim-scenarios">
            {SCENARIOS.map(s => (
              <button key={s.id} type="button"
                className={`rsim-scenario-btn${scenario === s.id ? ' active' : ''}`}
                onClick={() => setScenario(s.id)}>
                <span className="rsim-scen-icon">{s.icon}</span>
                <span>
                  <span className="rsim-scen-label">{s.label}</span>
                  <span className="rsim-scen-sub">{s.sub}</span>
                </span>
              </button>
            ))}
          </div>

          <p className="rsim-section-title">Địa hình</p>
          <div className="rsim-terrains">
            {TERRAINS.map(t => (
              <button key={t.id} type="button"
                className={`rsim-terrain-btn${terrain === t.id ? ' active' : ''}`}
                onClick={() => setTerrain(t.id)}>
                <span className="rsim-terrain-icon">{t.icon}</span>
                <span>
                  <span>{t.label}</span>
                  <span className="rsim-terrain-stats">{t.stats}</span>
                </span>
              </button>
            ))}
          </div>

          <button type="button" className="rsim-run-btn" onClick={run} disabled={loading}>
            {loading
              ? <><span className="rsim-spin"><RefreshCw size={16} /></span> Đang chạy AI…</>
              : <><span>⚡</span> Chạy mô phỏng</>}
          </button>

          {error && (
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--risk-extreme)', background: 'var(--risk-extreme-bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--risk-extreme-border)' }}>
              ⚠️ {error}
            </p>
          )}
        </aside>

        {/* Center: Chart */}
        <section className="rsim-center">
          <div className="rsim-chart-card">
            <div className="rsim-chart-header">
              <div>
                <h2>Lượng mưa 7 ngày trước mốc dự báo</h2>
                <p>{SCENARIOS.find(s => s.id === scenario)?.label} · {selectedTerrain?.label}</p>
              </div>
              {hasData && (
                <div className="rsim-chart-meta">
                  <strong>{result.rain_7d_mm} mm</strong>
                  tổng 7 ngày
                </div>
              )}
            </div>
            {hasData
              ? <RainChart daily={result.daily_totals_mm} forecast={result.forecast_24h_mm} />
              : <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', fontSize: 13 }}>
                  Nhấn <strong style={{ margin: '0 6px' }}>⚡ Chạy mô phỏng</strong> để xem biểu đồ mưa
                </div>
            }
          </div>

          {hasData && (
            <div className="rsim-stats-row">
              <div className="rsim-stat-box">
                <div className="rsim-stat-val" style={{ color: scoreColor(result.rain_24h_mm / 220) }}>
                  {result.rain_24h_mm} mm
                </div>
                <div className="rsim-stat-label">Mưa 24h qua</div>
              </div>
              <div className="rsim-stat-box">
                <div className="rsim-stat-val" style={{ color: scoreColor(result.rain_72h_mm / 450) }}>
                  {result.rain_72h_mm} mm
                </div>
                <div className="rsim-stat-label">Mưa 72h qua</div>
              </div>
              <div className="rsim-stat-box">
                <div className="rsim-stat-val">
                  {result.forecast_24h_mm} mm
                </div>
                <div className="rsim-stat-label">Dự báo +24h (GFS)</div>
              </div>
            </div>
          )}
        </section>

        {/* Right: Result */}
        <aside className="rsim-right">
          {!hasData ? (
            <div className="rsim-result-placeholder">
              <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z"/>
                <path d="M12 7v5l3 3"/>
              </svg>
              <p>Chọn kịch bản mưa và địa hình, nhấn <strong>⚡ Chạy mô phỏng</strong> để xem mô hình AI đánh giá nguy cơ sạt lở theo thời gian thực.</p>
            </div>
          ) : (
            <>
              <div className={`rsim-alert-badge ${alert.cls}`}>
                <div className="rsim-alert-icon">{alert.icon}</div>
                <div className="rsim-alert-label">{alert.label}</div>
                <div className="rsim-alert-sub">{alert.sub}</div>
              </div>

              <div className="rsim-gauge-wrap">
                <RainGauge value={result.hazard_score} />
              </div>

              <div className="rsim-score-breakdown">
                {[
                  { label: 'Điểm mưa (GRU)', value: result.temporal_score, color: '#3b82f6' },
                  { label: 'Điểm địa hình', value: result.spatial_score, color: '#8b5cf6' },
                  { label: 'Điểm nguy cơ tổng', value: result.hazard_score, color: scoreColor(result.hazard_score) },
                ].map(r => (
                  <div key={r.label} className="rsim-score-row">
                    <span className="rsim-score-label">{r.label}</span>
                    <div className="rsim-score-bar-wrap">
                      <div className="rsim-score-bar" style={{ width: `${r.value * 100}%`, background: r.color }} />
                    </div>
                    <span className="rsim-score-val" style={{ color: r.color }}>
                      {(r.value * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>

              <div className="rsim-terrain-info">
                <strong>{selectedTerrain?.label}</strong>
                <dl className="rsim-terrain-params">
                  <dt>Độ dốc</dt><dd>{result.terrain.slope_deg}°</dd>
                  <dt>Tỷ lệ sét</dt><dd>{result.terrain.clay_pct}%</dd>
                  <dt>Tỷ lệ cát</dt><dd>{result.terrain.sand_pct}%</dd>
                  <dt>Khối lượng thể tích</dt><dd>{result.terrain.bulk_density_g_cm3} g/cm³</dd>
                </dl>
              </div>

              <p className="rsim-footnote">
                Model: {result.model_id} · Seed: {result.seed} · Điểm nguy cơ = temporal × spatial chưa hiệu chỉnh xác suất.
                Ngưỡng thử 0.50 (experimental_flag={String(result.experimental_flag)}).
              </p>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
