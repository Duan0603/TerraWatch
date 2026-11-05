import React, { useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Square, RotateCcw, Bell, AlertTriangle, Zap, Map } from 'lucide-react';
import { simulateRainfall } from '../api/simulateApi';
import { saveSimResults, clearSimResults } from '../api/simBus';
import './AutoSimPage.css';

const SCENARIOS = [
  { id: 'dry',      icon: '☀️',  label: 'Khô hạn',   desc: '< 10 mm / 7 ngày' },
  { id: 'moderate', icon: '🌦️', label: 'Trung bình', desc: '80–120 mm / 7 ngày' },
  { id: 'heavy',    icon: '🌧️', label: 'Mưa to',     desc: '400–500 mm / 7 ngày' },
  { id: 'extreme',  icon: '⛈️', label: 'Cực đoan',   desc: '800+ mm · tái hiện Làng Nủ' },
];

const TERRAINS = [
  { id: 'batxat',     icon: '⛰️', label: 'Bát Xát',       loc: 'Lào Cai',    slope: '28°' },
  { id: 'sapa',       icon: '🌿', label: 'Sa Pa',          loc: 'Lào Cai',    slope: '22°' },
  { id: 'thuongxuan', icon: '🏞️', label: 'Thường Xuân',   loc: 'Thanh Hóa',  slope: '20°' },
  { id: 'thoai',      icon: '🌾', label: 'Địa hình thoải', loc: 'Tham chiếu', slope: '7°' },
];

const ALERT_CFG = {
  SAFE:    { cls: 'as-safe',    icon: '✅', label: 'AN TOÀN',        badge: 'as-badge-safe',    action: 'Không cần hành động' },
  LOW:     { cls: 'as-low',     icon: '🟢', label: 'THẤP',           badge: 'as-badge-low',     action: 'Theo dõi thêm' },
  MEDIUM:  { cls: 'as-medium',  icon: '🟡', label: 'TRUNG BÌNH',     badge: 'as-badge-medium',  action: '👁️ Theo dõi chặt diễn biến thời tiết' },
  HIGH:    { cls: 'as-high',    icon: '🟠', label: 'CAO',            badge: 'as-badge-high',    action: '⚠️ Cảnh báo — chuẩn bị sơ tán khi cần' },
  EXTREME: { cls: 'as-extreme', icon: '🔴', label: 'CỰC NGUY HIỂM', badge: 'as-badge-extreme', action: '🚨 SƠ TÁN NGAY nếu ở gần khu vực nguy hiểm' },
};

const SPEED_OPTIONS = [
  { id: 'fast',   label: '⚡ Nhanh',       ms: 200 },
  { id: 'normal', label: '▶ Bình thường', ms: 700 },
  { id: 'slow',   label: '🐢 Chậm',        ms: 1500 },
];

// 16 combinations: 4 scenarios × 4 terrains
const ALL_RUNS = SCENARIOS.flatMap(s =>
  TERRAINS.map(t => ({ id: `${s.id}/${t.id}`, scenario: s, terrain: t }))
);

const delay = ms => new Promise(res => setTimeout(res, ms));

function scoreColor(v) {
  if (v < 0.25) return '#22c55e';
  if (v < 0.50) return '#eab308';
  if (v < 0.70) return '#f97316';
  return '#ef4444';
}

function MiniBar({ value, color }) {
  return (
    <div className="as-score-cell">
      <div className="as-mini-bar-wrap">
        <div className="as-mini-bar" style={{ width: `${Math.max(value * 100, 0)}%`, background: color }} />
      </div>
      <span style={{ color }}>{(value * 100).toFixed(1)}%</span>
    </div>
  );
}

export default function AutoSimPage() {
  const navigate = useNavigate();
  const [status, setStatus]       = useState('idle');
  const [results, setResults]     = useState({});
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [speed, setSpeed]         = useState('normal');
  const stopRef = useRef(false);

  const startAuto = useCallback(async () => {
    stopRef.current = false;
    setStatus('running');
    setResults({});
    setCurrentIdx(-1);
    const speedMs = SPEED_OPTIONS.find(s => s.id === speed)?.ms ?? 700;
    const accumulated = {};

    for (let i = 0; i < ALL_RUNS.length; i++) {
      if (stopRef.current) break;
      const run = ALL_RUNS[i];
      setCurrentIdx(i);
      setResults(prev => ({ ...prev, [run.id]: { status: 'running' } }));
      try {
        const data = await simulateRainfall({ scenario: run.scenario.id, terrain: run.terrain.id });
        accumulated[run.id] = { status: 'done', ...data };
        setResults(prev => ({ ...prev, [run.id]: accumulated[run.id] }));
      } catch (e) {
        accumulated[run.id] = { status: 'error', error: e?.response?.data?.detail || e.message };
        setResults(prev => ({ ...prev, [run.id]: accumulated[run.id] }));
      }
      if (i < ALL_RUNS.length - 1) await delay(speedMs);
    }

    const done = !stopRef.current;
    if (done) saveSimResults(accumulated);
    setStatus(done ? 'done' : 'idle');
    setCurrentIdx(-1);
    stopRef.current = false;
  }, [speed]);

  const stopAuto = useCallback(() => { stopRef.current = true; }, []);

  const reset = useCallback(() => {
    stopRef.current = true;
    clearSimResults();
    setStatus('idle');
    setResults({});
    setCurrentIdx(-1);
  }, []);

  // Computed summary
  const doneResults = ALL_RUNS.map(r => results[r.id]).filter(r => r?.status === 'done');
  const alertCounts = { EXTREME: 0, HIGH: 0, MEDIUM: 0, LOW: 0, SAFE: 0 };
  doneResults.forEach(r => { if (r.alert_level && r.alert_level in alertCounts) alertCounts[r.alert_level]++; });
  const dangerRuns = ALL_RUNS.filter(r => {
    const res = results[r.id];
    return res?.status === 'done' && (res.alert_level === 'HIGH' || res.alert_level === 'EXTREME');
  });
  const progressPct = ALL_RUNS.length > 0 ? (doneResults.length / ALL_RUNS.length) * 100 : 0;
  const hasData = Object.keys(results).length > 0;
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div className="asim-page">
      {/* Header */}
      <header className="asim-header">
        <Link to="/rain-simulator" className="asim-back"><ArrowLeft size={16} /><span>Mô phỏng mưa</span></Link>
        <div className="asim-title">
          <h1>Kiểm thử AI tự động – Phát hiện sạt lở</h1>
          <span>16 kịch bản · GRU hai nhánh · 4 địa hình × 4 mức mưa</span>
        </div>
        <div className={`asim-status-pill${status === 'running' ? ' running' : status === 'done' ? ' done' : ''}`}>
          <span className="asim-dot" />
          {status === 'idle' ? 'Chờ bắt đầu' :
           status === 'running' ? `Đang kiểm thử ${currentIdx + 1}/16` :
           `Hoàn thành — ${dangerRuns.length} nguy hiểm`}
        </div>
      </header>

      {/* Controls */}
      <div className="asim-controls">
        <div className="asim-speed-row">
          <span className="asim-ctrl-label">Tốc độ:</span>
          {SPEED_OPTIONS.map(opt => (
            <button key={opt.id} type="button"
              className={`asim-speed-btn${speed === opt.id ? ' active' : ''}`}
              onClick={() => setSpeed(opt.id)}
              disabled={status === 'running'}>
              {opt.label}
            </button>
          ))}
        </div>
        <div className="asim-ctrl-btns">
          {status !== 'running' ? (
            <button type="button" className="asim-btn-start" onClick={startAuto}>
              <Play size={15} />
              {status === 'done' ? 'Chạy lại' : 'Bắt đầu kiểm thử tự động'}
            </button>
          ) : (
            <button type="button" className="asim-btn-stop" onClick={stopAuto}>
              <Square size={15} /> Dừng
            </button>
          )}
          {hasData && status !== 'running' && (
            <button type="button" className="asim-btn-reset" onClick={reset}>
              <RotateCcw size={14} /> Reset
            </button>
          )}
          {status === 'done' && dangerRuns.length > 0 && (
            <button type="button" className="asim-btn-map" onClick={() => navigate('/')}>
              <Map size={15} /> Xem trên bản đồ chính
            </button>
          )}
        </div>
        {status === 'running' && (
          <div className="asim-progress-track">
            <div className="asim-progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
        )}
      </div>

      <main className="asim-layout">
        {/* Left: results table */}
        <section className="asim-feed">
          <div className="asim-feed-header">
            <h2 className="asim-section-label">Kết quả phân tích theo thời gian thực</h2>
            {doneResults.length > 0 && (
              <span className="asim-done-count">{doneResults.length} / {ALL_RUNS.length} hoàn thành</span>
            )}
          </div>
          <div className="asim-table-wrap">
            <table className="asim-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Kịch bản mưa</th>
                  <th>Địa hình</th>
                  <th>Điểm mưa</th>
                  <th>Điểm địa hình</th>
                  <th>Nguy cơ</th>
                  <th>Cảnh báo AI</th>
                </tr>
              </thead>
              <tbody>
                {ALL_RUNS.map((run, idx) => {
                  const r = results[run.id];
                  const isCurrent = idx === currentIdx && status === 'running';
                  const isDone = r?.status === 'done';
                  const isError = r?.status === 'error';
                  const isRunning = r?.status === 'running';
                  const alert = isDone ? (ALERT_CFG[r.alert_level] ?? ALERT_CFG.MEDIUM) : null;

                  return (
                    <tr key={run.id}
                      className={`asim-row${isCurrent || isRunning ? ' asim-row-active' : ''}${isDone ? ' asim-row-done' : ''}${isError ? ' asim-row-error' : ''}`}>
                      <td className="asim-idx">{idx + 1}</td>
                      <td className="asim-col-scenario">
                        <span className="asim-icon">{run.scenario.icon}</span>
                        <div>
                          <div className="asim-scen-label">{run.scenario.label}</div>
                          <div className="asim-scen-desc">{run.scenario.desc}</div>
                        </div>
                      </td>
                      <td className="asim-col-terrain">
                        <span className="asim-icon">{run.terrain.icon}</span>
                        <div>
                          <div>{run.terrain.label}</div>
                          <div className="asim-terrain-loc">{run.terrain.loc} · {run.terrain.slope}</div>
                        </div>
                      </td>
                      <td>
                        {isDone ? <MiniBar value={r.temporal_score} color="#3b82f6" />
                          : (isRunning || isCurrent) ? <span className="asim-pulse">···</span>
                          : <span className="asim-dash">—</span>}
                      </td>
                      <td>
                        {isDone ? <MiniBar value={r.spatial_score} color="#8b5cf6" />
                          : (isRunning || isCurrent) ? <span className="asim-pulse">···</span>
                          : <span className="asim-dash">—</span>}
                      </td>
                      <td>
                        {isDone ? (
                          <span className="asim-hazard-score" style={{ color: scoreColor(r.hazard_score) }}>
                            {(r.hazard_score * 100).toFixed(1)}%
                          </span>
                        ) : (isRunning || isCurrent) ? <span className="asim-pulse">···</span>
                          : <span className="asim-dash">—</span>}
                      </td>
                      <td>
                        {isDone ? (
                          <span className={`asim-badge ${alert.badge}`}>{alert.icon} {alert.label}</span>
                        ) : (isRunning || isCurrent) ? (
                          <span className="asim-analyzing"><Zap size={12} /> Phân tích…</span>
                        ) : isError ? (
                          <span className="asim-err-badge">⚠ Lỗi</span>
                        ) : (
                          <span className="asim-dash">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right: summary + notification flow */}
        <aside className="asim-summary">
          {!hasData ? (
            <div className="asim-summary-placeholder">
              <Bell size={36} />
              <p>Nhấn <strong>Bắt đầu kiểm thử tự động</strong> — AI sẽ phân tích toàn bộ 16 kịch bản và hiển thị luồng cảnh báo khi phát hiện nguy cơ sạt lở.</p>
            </div>
          ) : (
            <>
              {/* Alert count grid */}
              <h2 className="asim-section-label">Phân loại nguy cơ</h2>
              <div className="asim-count-grid">
                {Object.entries(alertCounts).map(([level, count]) => (
                  count > 0 && (
                    <div key={level} className={`asim-count-box ${ALERT_CFG[level].badge}`}>
                      <div className="asim-count-num">{count}</div>
                      <div className="asim-count-label">{ALERT_CFG[level].icon} {ALERT_CFG[level].label}</div>
                    </div>
                  )
                ))}
                {doneResults.length < ALL_RUNS.length && (
                  <div className="asim-count-box as-badge-pending">
                    <div className="asim-count-num">{ALL_RUNS.length - doneResults.length}</div>
                    <div className="asim-count-label">⏳ Chờ</div>
                  </div>
                )}
              </div>

              {/* Dangerous cases */}
              {dangerRuns.length > 0 && (
                <div className="asim-danger-section">
                  <div className="asim-danger-title">
                    <AlertTriangle size={14} />
                    {dangerRuns.length} trường hợp cần cảnh báo
                  </div>
                  {dangerRuns.map(run => {
                    const r = results[run.id];
                    const alert = ALERT_CFG[r.alert_level];
                    return (
                      <div key={run.id} className={`asim-danger-item ${alert.cls}`}>
                        <div className="asim-danger-loc">
                          {run.terrain.icon} <strong>{run.terrain.label}</strong> + {run.scenario.icon} {run.scenario.label}
                        </div>
                        <div className="asim-danger-score">
                          <span style={{ color: scoreColor(r.hazard_score) }}>
                            {(r.hazard_score * 100).toFixed(1)}%
                          </span>
                          <span className={`asim-badge ${alert.badge}`}>{alert.icon} {alert.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Notification flow */}
              {dangerRuns.length > 0 && (
                <div className="asim-notif-section">
                  <div className="asim-notif-header-row">
                    <span>📢</span>
                    <strong>Luồng cảnh báo sẽ được phát đến người dùng</strong>
                  </div>
                  {dangerRuns.slice(0, 4).map(run => {
                    const r = results[run.id];
                    const alert = ALERT_CFG[r.alert_level];
                    return (
                      <div key={run.id} className={`asim-notif-card ${alert.cls}`}>
                        <div className="asim-notif-top">
                          <span className="asim-notif-title-row">
                            {alert.icon} <strong>CẢNH BÁO SẠT LỞ ĐẤT</strong>
                          </span>
                          <span className="asim-notif-time">{timeStr}</span>
                        </div>
                        <div className="asim-notif-body">
                          <div>📍 <strong>{run.terrain.label}, {run.terrain.loc}</strong></div>
                          <div>⚠️ Mức độ: <strong>{alert.label}</strong></div>
                          <div>🌧️ Mưa 7 ngày: <strong>{r.rain_7d_mm} mm</strong> · Dự báo: <strong>{r.forecast_24h_mm} mm</strong></div>
                          <div>🤖 Điểm AI: <strong style={{ color: scoreColor(r.hazard_score) }}>{(r.hazard_score * 100).toFixed(1)}%</strong>
                            {r.experimental_flag && <span className="asim-flag"> ⚑ flag</span>}
                          </div>
                        </div>
                        <div className="asim-notif-action">{alert.action}</div>
                      </div>
                    );
                  })}
                  {dangerRuns.length > 4 && (
                    <div className="asim-notif-more">+{dangerRuns.length - 4} cảnh báo khác</div>
                  )}
                </div>
              )}

              {dangerRuns.length === 0 && doneResults.length === ALL_RUNS.length && (
                <div className="asim-all-safe">
                  <div style={{ fontSize: 32 }}>✅</div>
                  <strong>Không phát hiện nguy cơ cao</strong>
                  <p>Tất cả 16 kịch bản kiểm thử đều ở mức an toàn hoặc nguy cơ thấp.</p>
                </div>
              )}
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
