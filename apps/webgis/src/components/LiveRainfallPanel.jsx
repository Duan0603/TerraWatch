import React, { useEffect, useState, useCallback } from 'react';
import { CloudRain, RefreshCw, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import './LiveRainfallPanel.css';

const valueText = value => value === null || value === undefined ? 'Chưa đủ dữ liệu' : `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value)} mm`;
const timeText = value => value ? new Date(value).toLocaleString('vi-VN', { hour12: false }) : 'Chưa có lần lấy thành công';

const INJECT_SCENARIOS = [
  { key: 'dry',      label: 'Khô hạn',   mm7d: '4 mm',   desc: 'Không ảnh hưởng nguy cơ',    color: '#6b7280' },
  { key: 'moderate', label: 'Trung bình', mm7d: '113 mm', desc: 'Mức cơ bản, nguy cơ thấp',   color: '#2563eb' },
  { key: 'heavy',    label: 'Mưa to',     mm7d: '450 mm', desc: 'Nguy cơ trung bình–cao',      color: '#d97706' },
  { key: 'extreme',  label: 'Cực đoan',   mm7d: '860 mm', desc: 'Mô phỏng như Làng Nủ 2024',  color: '#dc2626' },
];

const ALERT_BADGE = {
  SAFE:    { label: 'An toàn',          cls: 'inj-badge-safe'    },
  LOW:     { label: 'Nguy cơ thấp',     cls: 'inj-badge-low'     },
  MEDIUM:  { label: 'Nguy cơ trung bình', cls: 'inj-badge-medium' },
  HIGH:    { label: 'Nguy cơ cao',      cls: 'inj-badge-high'    },
  EXTREME: { label: 'Cực kỳ nguy hiểm', cls: 'inj-badge-extreme' },
};

export default function LiveRainfallPanel({ selectedEvent }) {
  const [snapshot, setSnapshot] = useState(null), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [reload, setReload] = useState(0), [collapsed, setCollapsed] = useState(false);
  const [injectOpen, setInjectOpen] = useState(false);
  const [injectScenario, setInjectScenario] = useState('heavy');
  const [injectLoading, setInjectLoading] = useState(false);
  const [injectResult, setInjectResult] = useState(null);
  const [injectError, setInjectError] = useState('');
  const latitude = selectedEvent?.lat, longitude = selectedEvent?.lng;
  useEffect(() => {
    let controller;
    let active = true;
    async function read() {
      controller?.abort(); controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const configured = import.meta.env.VITE_API_BASE_URL;
        const base = configured || (['5173', '5174'].includes(window.location.port)
          ? `${window.location.protocol}//${window.location.hostname}:8080` : window.location.origin);
        const params = new URLSearchParams({ latitude, longitude });
        const response = await fetch(`${base}/api/v1/gis/rainfall/live?${params}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.detail || 'Dịch vụ mưa chưa sẵn sàng.');
        if (active) { setSnapshot(body); setError(''); }
      } catch (e) {
        if (active) setError(e.name === 'AbortError' ? 'Dịch vụ mưa phản hồi chậm. Sẽ tự kiểm tra lại.' : e.message);
      } finally { clearTimeout(timer); if (active) setLoading(false); }
    }
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      read(); const interval = setInterval(read, 60000);
      return () => { active = false; controller?.abort(); clearInterval(interval); };
    }
    setError('Điểm đang xem chưa có tọa độ hợp lệ.'); setLoading(false);
    return () => { active = false; };
  }, [latitude, longitude, reload]);

  const data = snapshot?.data;
  const prediction = data?.gru_inference;
  const stale = error || snapshot?.stale;

  const handleInject = useCallback(async () => {
    if (!prediction?.ready || !prediction?.static_values) return;
    setInjectLoading(true); setInjectError(''); setInjectResult(null);
    try {
      const configured = import.meta.env.VITE_API_BASE_URL;
      const base = configured || (['5173', '5174'].includes(window.location.port)
        ? `${window.location.protocol}//${window.location.hostname}:8080` : window.location.origin);
      const body = {
        unit_id: selectedEvent?.unit?.unit_id || null,
        lat: selectedEvent?.lat ?? null,
        lng: selectedEvent?.lng ?? null,
        scenario: injectScenario,
        slope_deg: prediction.static_values.slope_deg,
        clay_pct: prediction.static_values.clay_pct,
        sand_pct: prediction.static_values.sand_pct,
        bulk_density_g_cm3: prediction.static_values.bulk_density_g_cm3,
      };
      const res = await fetch(`${base}/api/v1/ai/simulate/inject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Lỗi inject');
      setInjectResult(json);
      if (json.forecast_in_queue) window.dispatchEvent(new CustomEvent('tw:queue-refresh'));
    } catch (e) {
      setInjectError(e.message);
    } finally {
      setInjectLoading(false);
    }
  }, [prediction, selectedEvent, injectScenario]);
  const chart = data?.hourly.filter(h => {
    const delta = (new Date(h.interval_end)-new Date(data.as_of))/3600000;
    return delta > -12 && delta <= 12;
  }) || [];
  const max = Math.max(...chart.map(h => h.mm || 0), 1);
  return <section className="live-rain-panel" aria-label="Dữ liệu mưa cập nhật">
    <header><div><CloudRain size={18} /><h2>Mưa cập nhật theo khu vực</h2></div>
      <button type="button" onClick={() => setCollapsed(v => !v)} aria-expanded={!collapsed} aria-label={collapsed ? 'Mở bảng mưa' : 'Thu gọn bảng mưa'}>{collapsed ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button>
    </header>
    {!collapsed && <div className="live-rain-body">
      <p className="live-rain-location">{selectedEvent.location}<br />{latitude?.toFixed(4)}°N, {longitude?.toFixed(4)}°E</p>
      <p className="live-rain-source">Open-Meteo · Ước tính từ mô hình khí tượng, không phải số đo trạm.</p>
      <div className="live-rain-status" role="status">
        {loading ? 'Đang đọc dữ liệu cập nhật…' : data ? (stale ? 'Dữ liệu cũ / cập nhật chưa thành công' : data.quality === 'complete' ? 'Đã có dữ liệu cập nhật' : 'Dữ liệu chưa đủ giờ') : 'Chưa có dữ liệu mưa'}
      </div>
      {error && <p className="live-rain-error" role="alert">{error}</p>}
      {snapshot?.last_error && <p className="live-rain-error">Nguồn chưa cập nhật thành công: {snapshot.last_error}. Giữ lần lấy thành công gần nhất nếu có.</p>}
      {data && <>
        <dl className="live-rain-values">
          <div><dt>Mưa 24 giờ đã qua</dt><dd>{valueText(data.history['24'].mm)}</dd></div>
          <div><dt>Mưa 72 giờ đã qua</dt><dd>{valueText(data.history['72'].mm)}</dd></div>
          <div><dt>Dự báo 24 giờ tới</dt><dd>{valueText(data.forecast_24h.mm)}</dd></div>
        </dl>
        <p className="live-rain-coverage">Lịch sử: {data.history['168'].valid_hours}/168 giờ · Dự báo: {data.forecast_24h.valid_hours}/24 giờ. Khoảng thiếu được giữ trống.</p>
        <figure className="live-rain-chart"><figcaption>Mưa theo giờ · mm <span>12 giờ đã qua / 12 giờ tới</span></figcaption>
          <svg viewBox="0 0 312 90" role="img" aria-label="Mưa ước tính và dự báo theo giờ; khoảng trống biểu thị dữ liệu thiếu">
            {chart.map((h,i) => <g key={h.interval_end}>
              {h.mm !== null ? <rect x={i*13+2} y={65-Math.max(h.mm/max*48,1)} width={9} height={Math.max(h.mm/max*48,1)} fill={h.kind === 'forecast' ? '#b45b17' : '#087b70'}><title>{timeText(h.interval_end)}: {h.mm} mm ({h.kind === 'forecast' ? 'dự báo' : 'ước tính đã qua'})</title></rect> : <text x={i*13+3} y={63}>×</text>}
              {i%4===0 && <text x={i*13+5} y={84} textAnchor="middle">{new Date(h.interval_end).getHours()}h</text>}
            </g>)}
          </svg>
          <div className="live-rain-chart-key"><span>Đã qua: xanh</span><span>Dự báo: nâu</span></div>
        </figure>
        {prediction?.ready ? <section className="live-gru-result" aria-label="Dự báo tự động thử nghiệm">
          <h3>GRU · Dự báo tự động 24 giờ</h3>
          <p className="live-gru-equation"><span>{prediction.temporal_score.toFixed(3)} <small>Mưa</small></span><b>×</b>
            <span>{prediction.spatial_score.toFixed(3)} <small>Địa hình · đất</small></span><b>=</b>
            <span><strong>{prediction.hazard_score.toFixed(3)}</strong> <small>Điểm nguy cơ</small></span></p>
          <p className="live-gru-period">{timeText(prediction.issue_time)} → {timeText(prediction.valid_until)}<br />{prediction.unit_id}</p>
          {(stale || new Date(prediction.valid_until) <= new Date()) && <p className="live-rain-error">Kết quả cũ hoặc đầu vào chưa cập nhật. Không dùng như dự báo mới.</p>}
          <p className="live-rain-model-hold">Dự báo thử nghiệm: Open-Meteo khác nguồn IMERG + GFS khi train; mốc chạy là giờ cập nhật hiện tại. Điểm chưa phải xác suất và không tự phát cảnh báo.</p>
          <details><summary>Đất và độ dốc dùng cho ô này</summary><p className="live-gru-period">
            Dốc {prediction.static_values.slope_deg.toFixed(1)}° · Sét {prediction.static_values.clay_pct.toFixed(1)}% · Cát {prediction.static_values.sand_pct.toFixed(1)}% · Khối lượng thể tích {prediction.static_values.bulk_density_g_cm3.toFixed(2)} g/cm³.
          </p></details>

          {/* ── Inject Tool ──────────────────────────────────────── */}
          <div className="inj-wrap">
            <button type="button" className="inj-toggle" onClick={() => { setInjectOpen(v => !v); setInjectResult(null); setInjectError(''); }}>
              <Zap size={14} /> <span>Inject Mưa vào Hệ thống</span>
              {injectOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {injectOpen && <div className="inj-body">
              <p className="inj-desc">Chọn kịch bản mưa → inject vào GRU với địa hình ô này → tạo <strong>forecast_run thật</strong> trong hàng đợi thẩm định.</p>
              <div className="inj-scenarios">
                {INJECT_SCENARIOS.map(s => (
                  <button key={s.key} type="button"
                    className={`inj-scen-btn${injectScenario === s.key ? ' active' : ''}`}
                    style={{ '--scen-color': s.color }}
                    onClick={() => { setInjectScenario(s.key); setInjectResult(null); setInjectError(''); }}>
                    <span className="inj-scen-name">{s.label}</span>
                    <span className="inj-scen-mm">{s.mm7d} / 7 ngày</span>
                    <span className="inj-scen-desc">{s.desc}</span>
                  </button>
                ))}
              </div>
              <div className="inj-terrain-note">
                Địa hình dùng: dốc <strong>{prediction.static_values.slope_deg.toFixed(1)}°</strong> · sét <strong>{prediction.static_values.clay_pct.toFixed(1)}%</strong> · cát <strong>{prediction.static_values.sand_pct.toFixed(1)}%</strong>
              </div>
              <button type="button" className="inj-fire-btn" onClick={handleInject} disabled={injectLoading}>
                {injectLoading ? <><span className="inj-spin" /> Đang tính toán…</> : <><Zap size={14} /> Inject Lượng Mưa</>}
              </button>
              {injectError && <p className="inj-error">{injectError}</p>}
              {injectResult && (
                <div className={`inj-result inj-result-${injectResult.alert_level.toLowerCase()}`}>
                  <div className="inj-result-top">
                    <span className={`inj-badge ${ALERT_BADGE[injectResult.alert_level]?.cls}`}>
                      {ALERT_BADGE[injectResult.alert_level]?.label}
                    </span>
                    <span className="inj-result-score">Nguy cơ: <strong>{injectResult.hazard_score.toFixed(4)}</strong></span>
                  </div>
                  <div className="inj-result-row">
                    <span>{injectResult.temporal_score.toFixed(3)} <small>Mưa</small></span>
                    <b>×</b>
                    <span>{injectResult.spatial_score.toFixed(3)} <small>Địa hình</small></span>
                    <b>=</b>
                    <span><strong>{injectResult.hazard_score.toFixed(4)}</strong></span>
                  </div>
                  <div className="inj-result-rain">
                    Mưa 7 ngày: <strong>{injectResult.rain_7d_mm} mm</strong> · 24h tới: <strong>{injectResult.forecast_24h_mm} mm</strong>
                  </div>
                  {injectResult.forecast_in_queue ? (
                    <div className="inj-queue-ok">
                      ✓ Đã tạo forecast #{injectResult.run_id.slice(0, 8)} · <strong>Đang chờ thẩm định trong hàng đợi</strong>
                      <br /><span className="inj-queue-hint">Hàng đợi vừa tự làm mới — tìm mục mới trong danh sách bên trái.</span>
                    </div>
                  ) : injectResult.alert_level === 'SAFE' ? (
                    <div className="inj-queue-skip">Kịch bản này không tạo cảnh báo (ngưỡng an toàn).</div>
                  ) : (
                    <div className="inj-error">Không ghi vào DB: {injectResult.db_error}</div>
                  )}
                </div>
              )}
            </div>}
          </div>
        </section> : <p className="live-rain-model-hold">GRU chưa có kết quả: {prediction?.reason || 'đang chờ đầu vào và mô hình'}. Tác vụ sẽ tự thử lại; không tạo điểm giả.</p>}
      </>}
      <footer><span>Lấy thành công: {timeText(snapshot?.last_success_at)}<br />Server tự lấy mỗi {Math.round((snapshot?.refresh_interval_seconds || 3600)/60)} phút; web kiểm tra mỗi phút.</span>
        <button type="button" onClick={() => { setLoading(true); setReload(n => n+1); }} aria-label="Đọc lại dữ liệu mưa đã lưu"><RefreshCw size={15} /></button>
      </footer>
      <a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">Nguồn dữ liệu và phương pháp</a>
    </div>}
  </section>;
}
