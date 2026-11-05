import React, { useState, useEffect, useRef } from 'react';
import { Zap, ChevronDown, ChevronUp, X } from 'lucide-react';

const SCENARIOS = [
  { key: 'dry',      label: 'Khô hạn',   mm: '~4 mm',   color: '#6b7280' },
  { key: 'moderate', label: 'Trung bình', mm: '~113 mm', color: '#2563eb' },
  { key: 'heavy',    label: 'Mưa to',     mm: '~450 mm', color: '#d97706' },
  { key: 'extreme',  label: 'Cực đoan',   mm: '~860 mm', color: '#dc2626' },
];

const BADGE = {
  SAFE:    { label: 'An toàn',           bg: '#dcfce7', color: '#15803d' },
  LOW:     { label: 'Nguy cơ thấp',      bg: '#dcfce7', color: '#15803d' },
  MEDIUM:  { label: 'Trung bình',        bg: '#fef9c3', color: '#854d0e' },
  HIGH:    { label: 'Nguy cơ cao',       bg: '#fed7aa', color: '#9a3412' },
  EXTREME: { label: 'Cực kỳ nguy hiểm', bg: '#fecdd3', color: '#9f1239' },
};

export default function MapInjectPanel({ mapCenter, selectedEvent, clickedPoint, onInjectResult }) {
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState('heavy');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const panelRef = useRef(null);

  // Đóng khi click ra ngoài
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Lấy tọa độ: ưu tiên clickedPoint (ping trên map) > selectedEvent > mapCenter
  const lat = clickedPoint?.lat ?? selectedEvent?.lat ?? mapCenter?.lat;
  const lng = clickedPoint?.lng ?? selectedEvent?.lng ?? mapCenter?.lng;
  const unitId = selectedEvent?.unit?.unit_id ?? null;
  const locationLabel = clickedPoint
    ? `📍 Điểm đã pin: ${lat?.toFixed(4)}°N, ${lng?.toFixed(4)}°E`
    : selectedEvent?.location || (lat != null ? `${lat.toFixed(4)}°N, ${lng?.toFixed(4)}°E` : null);

  const inject = async () => {
    if (lat == null || lng == null) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const configured = import.meta.env.VITE_API_BASE_URL;
      const base = configured || (['5173', '5174'].includes(window.location.port)
        ? `${window.location.protocol}//${window.location.hostname}:8080`
        : window.location.origin);
      const res = await fetch(`${base}/api/v1/ai/simulate/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: unitId, lat, lng, scenario,
          slope_deg: 25, clay_pct: 30, sand_pct: 32, bulk_density_g_cm3: 1.12 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Lỗi inject');
      setResult(json);
      if (json.forecast_in_queue) {
        window.dispatchEvent(new CustomEvent('tw:queue-refresh'));
      }
      onInjectResult?.(lat, lng, json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const badge = result ? BADGE[result.alert_level] : null;

  return (
    <div ref={panelRef} style={{ position: 'absolute', top: 70, left: 16, zIndex: 20 }}>
      {/* Toggle button */}
      <button onClick={() => { setOpen(v => !v); setResult(null); setError(''); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
          background: open ? '#7c3aed' : '#fff', color: open ? '#fff' : '#7c3aed',
          border: '2px solid #7c3aed', borderRadius: 10, cursor: 'pointer',
          fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
          boxShadow: '0 2px 10px rgba(0,0,0,0.15)', transition: 'all .15s',
        }}>
        <Zap size={15} />
        <span>Inject Mưa</span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div style={{
          marginTop: 8, background: '#fff', borderRadius: 12, padding: 16, width: 300,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)', border: '1px solid #e5e7eb',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>⚡ Inject Mưa tại vị trí này</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 2 }}><X size={15} /></button>
          </div>

          {/* Location / hint */}
          {lat == null ? (
            <div style={{ fontSize: 11, color: '#7c3aed', background: '#f5f3ff', borderRadius: 7, padding: '8px 10px', marginBottom: 12, lineHeight: 1.6, border: '1px dashed #c4b5fd', textAlign: 'center' }}>
              👆 <strong>Nhấn vào bản đồ</strong> để chọn điểm inject lượng mưa
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#6b7280', background: clickedPoint ? '#f5f3ff' : '#f9fafb', borderRadius: 7, padding: '6px 10px', marginBottom: 12, lineHeight: 1.6, border: clickedPoint ? '1px solid #c4b5fd' : 'none' }}>
              <strong style={{ color: '#374151' }}>Vị trí:</strong> {locationLabel || `${lat.toFixed(4)}°N, ${lng?.toFixed(4)}°E`}
              {clickedPoint && <><br /><span style={{ color: '#7c3aed', fontSize: 10 }}>← Điểm bạn vừa pin trên bản đồ</span></>}
            </div>
          )}

          {/* Scenario picker */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            {SCENARIOS.map(s => (
              <button key={s.key} onClick={() => { setScenario(s.key); setResult(null); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: 2, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'inherit', border: `2px solid ${scenario === s.key ? s.color : '#e5e7eb'}`,
                  background: scenario === s.key ? `${s.color}12` : '#f9fafb',
                  transition: 'all .12s',
                }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.label}</span>
                <span style={{ fontSize: 10, color: '#6b7280' }}>{s.mm} / 7 ngày</span>
              </button>
            ))}
          </div>

          {/* Inject button */}
          <button onClick={inject} disabled={loading || lat == null}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 9, border: 'none',
              background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 13,
              fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? .7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
            {loading
              ? <><span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'inj-spin .7s linear infinite' }} /> Đang tính toán…</>
              : <><Zap size={14} /> Inject &amp; tạo cảnh báo</>}
          </button>

          {error && <div style={{ marginTop: 10, fontSize: 11, color: '#b91c1c', background: '#fef2f2', borderRadius: 7, padding: '7px 10px' }}>{error}</div>}

          {/* Result */}
          {result && (
            <div style={{ marginTop: 12, borderRadius: 10, padding: '10px 12px', background: badge?.bg || '#f9fafb', border: `1.5px solid ${badge?.color || '#d1d5db'}20` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: badge?.bg, color: badge?.color }}>{badge?.label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>{result.hazard_score.toFixed(4)}</span>
              </div>
              <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.7 }}>
                Mưa 7 ngày: <strong>{result.rain_7d_mm} mm</strong><br />
                Dự báo 24h: <strong>{result.forecast_24h_mm} mm</strong><br />
                Temporal × Spatial: <strong>{result.temporal_score.toFixed(3)} × {result.spatial_score.toFixed(3)}</strong>
              </div>
              {result.forecast_in_queue ? (
                <div style={{ marginTop: 9, fontSize: 11, color: '#166534', background: '#dcfce7', borderRadius: 7, padding: '7px 10px', fontWeight: 600 }}>
                  ✓ Đã tạo #{result.run_id.slice(0, 8)} · Xuất hiện trong hàng đợi thẩm định
                  <div style={{ fontWeight: 400, marginTop: 2 }}>Hàng đợi vừa tự làm mới.</div>
                </div>
              ) : (
                <div style={{ marginTop: 9, fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>
                  {result.alert_level === 'SAFE' ? 'Kịch bản này không tạo cảnh báo (ngưỡng an toàn).' : `Lỗi DB: ${result.db_error}`}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
