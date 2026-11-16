import React, { useEffect, useRef, useState } from 'react';
import { CloudRain, Play, Square, X } from 'lucide-react';
import landslideApi from '../api/landslideApi';
import { scoreText } from '../utils/weather';
import { playAlertBeep } from '../utils/sound';

// Demo: mưa giả lập đi qua đúng mô hình GRU thật (GET /gis/rainfall/simulate). Không lưu, không gửi SMS/FCM.
export const PAST_LEVELS = [['Khô ráo', 0], ['Bình thường', 30], ['Ẩm ướt', 120], ['Mưa kéo dài', 300], ['Mưa cực đoan', 600]];
// Mưa 24 giờ tới theo QĐ 18/2021/QĐ-TTg: nhỏ < 16, vừa 16–50, to > 50–100, rất to > 100 mm.
export const NEXT_LEVELS = [['Không mưa', 0], ['Mưa nhỏ', 10], ['Mưa vừa', 35], ['Mưa to', 80], ['Mưa rất to', 150]];
// Kịch bản tự chạy: đất khô gặp mưa rất to vẫn thấp, rồi mưa tích lũy dần đẩy điểm lên.
const SCRIPT = [[0, 0], [0, 4], [1, 2], [2, 2], [2, 3], [3, 3], [4, 4]];
const STEP_MS = 2500;
const errText = (e, fallback) => e.response?.data?.detail || `${fallback} (${e.message})`;

// shortcut: ngưỡng minh họa cho buổi demo, chưa hiệu chỉnh; thay bằng ngưỡng đã thẩm định khi có.
export function simLevel(hazard) {
  if (hazard >= 0.3) return { label: 'Nguy cơ sạt lở cao', color: '#b91c1c', bg: '#fef2f2', high: true };
  if (hazard >= 0.1) return { label: 'Cần theo dõi', color: '#b45309', bg: '#fffbeb' };
  return { label: 'Thấp', color: '#15803d', bg: '#f0fdf4' };
}

const slider = (id, label, levels, value, onChange, disabled) => (
  <label htmlFor={id} style={{ display: 'block', marginTop: 10, fontSize: 12, fontWeight: 600, color: '#334155' }}>
    {label}: <span style={{ color: '#1d4ed8' }}>{levels[value][0]} ({levels[value][1]} mm)</span>
    <input id={id} type="range" min={0} max={levels.length - 1} step={1} value={value} disabled={disabled}
      onChange={e => onChange(Number(e.target.value))} style={{ width: '100%' }}
      aria-valuetext={`${levels[value][0]}, ${levels[value][1]} mm`} />
    <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 400, color: '#64748b' }}>
      <span>{levels[0][0]}</span><span>{levels[levels.length - 1][0]}</span>
    </span>
  </label>
);

export default function RainSimulatorPanel({ onResult, onClose, hideLive, setHideLive, soundEnabled }) {
  const [locations, setLocations] = useState([]);
  const [key, setKey] = useState('');
  const [pastIdx, setPastIdx] = useState(0), [nextIdx, setNextIdx] = useState(0);
  const [result, setResult] = useState(null), [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const wasHigh = useRef(false);

  useEffect(() => {
    landslideApi.getSimulationLocations()
      .then(d => { setLocations(d.items); setKey(k => k || d.items[0]?.key || ''); })
      .catch(e => setError(errText(e, 'Không tải được danh sách điểm mô phỏng')));
  }, []);

  useEffect(() => {
    const loc = locations.find(l => l.key === key);
    if (!loc) return undefined;
    const controller = new AbortController();
    const [past, next] = [PAST_LEVELS[pastIdx][1], NEXT_LEVELS[nextIdx][1]];
    landslideApi.simulateRain(key, past, next, controller.signal).then(r => {
      setResult(r); setError('');
      onResult({ ...loc, past_7d_mm: past, next_24h_mm: next, result: r });
      const high = !!simLevel(r.hazard_score).high;
      if (high && !wasHigh.current && soundEnabled) playAlertBeep();
      wasHigh.current = high;
    }).catch(e => { if (!controller.signal.aborted) setError(errText(e, 'Mô phỏng thất bại')); });
    return () => controller.abort();
  }, [key, pastIdx, nextIdx, locations]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) return undefined;
    let i = 0;
    const step = () => {
      if (i >= SCRIPT.length) { setPlaying(false); return; }
      setPastIdx(SCRIPT[i][0]); setNextIdx(SCRIPT[i][1]); i += 1;
    };
    step();
    const timer = setInterval(step, STEP_MS);
    return () => clearInterval(timer);
  }, [playing]);

  const level = result && simLevel(result.hazard_score);
  const name = locations.find(l => l.key === key)?.name;

  return (
    <aside aria-label="Mô phỏng mưa (demo)" style={{
      position: 'fixed', top: 120, right: 16, zIndex: 60, width: 'min(340px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 140px)',
      overflowY: 'auto', background: '#fff', border: '2px solid #1d4ed8', borderRadius: 12, padding: 14,
      boxShadow: '0 8px 24px rgba(15,23,42,0.18)', fontSize: 12, color: '#172524'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CloudRain size={16} color="#1d4ed8" />
        <strong style={{ fontSize: 14 }}>Mô phỏng mưa</strong>
        <span style={{ background: '#1d4ed8', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>MÔ PHỎNG</span>
        <button type="button" onClick={onClose} aria-label="Tắt mô phỏng, quay về mưa thật" title="Tắt mô phỏng"
          style={{ marginLeft: 'auto', border: 0, background: 'none', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
      </div>
      <p style={{ margin: '6px 0 0', color: '#64748b' }}>Mưa là giả lập; mô hình GRU, đất và độ dốc là thật. Không lưu và không gửi SMS/FCM.</p>

      <label htmlFor="sim-loc" style={{ display: 'block', marginTop: 10, fontWeight: 600, color: '#334155' }}>Điểm
        <select id="sim-loc" value={key} onChange={e => setKey(e.target.value)} disabled={playing}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1' }}>
          {locations.map(l => <option key={l.key} value={l.key}>{l.name}</option>)}
        </select>
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <input type="checkbox" checked={hideLive} onChange={e => setHideLive(e.target.checked)} />
        Tắt mưa thật trên bản đồ (chỉ hiện điểm mô phỏng)
      </label>

      {slider('sim-past', 'Mưa 7 ngày qua', PAST_LEVELS, pastIdx, setPastIdx, playing)}
      {slider('sim-next', 'Mưa 24 giờ tới', NEXT_LEVELS, nextIdx, setNextIdx, playing)}

      <button type="button" onClick={() => setPlaying(p => !p)} disabled={!key}
        style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '7px 10px', borderRadius: 8, border: 0, cursor: 'pointer', fontWeight: 600,
          background: playing ? '#475569' : '#1d4ed8', color: '#fff' }}>
        {playing ? <><Square size={14} /> Dừng kịch bản</> : <><Play size={14} /> Chạy kịch bản 7 bước</>}
      </button>

      {error && <p role="alert" style={{ color: '#b91c1c', marginTop: 8 }}>{error}</p>}

      {result && level && (
        <div aria-live="polite" style={{ marginTop: 12, padding: 10, borderRadius: 8, background: level.bg, border: `1px solid ${level.color}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div><strong style={{ fontSize: 16 }}>{scoreText(result.temporal_score)}</strong><div>Mưa · GRU</div></div><b>×</b>
            <div><strong style={{ fontSize: 16 }}>{scoreText(result.spatial_score)}</strong><div>Đất · độ dốc</div></div><b>=</b>
            <div><strong style={{ fontSize: 16, color: level.color }}>{scoreText(result.hazard_score)}</strong><div>Điểm nguy cơ</div></div>
          </div>
          <div style={{ marginTop: 8, fontWeight: 700, color: level.color }}>{level.label}</div>
          {level.high && <p role="alert" style={{ margin: '6px 0 0', color: level.color }}>
            Cảnh báo mô phỏng tại {name}: mưa tích lũy đã làm đất bão hòa. Hệ thống thật sẽ đưa vào hàng đợi thẩm định; bản demo không gửi tin.
          </p>}
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 10 }}>Ngưỡng 0,1 / 0,3 chỉ để minh họa; điểm không phải xác suất.</p>
        </div>
      )}
    </aside>
  );
}
