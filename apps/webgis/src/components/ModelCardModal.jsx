import React, { useState, useEffect, useCallback } from 'react';
import { Cpu, RefreshCw, X, AlertTriangle } from 'lucide-react';
import { getModelCard } from '../api/modelCardApi';
import { buildModelCardView } from '../utils/modelCard';
import EmptyState from './EmptyState';

const box = { padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };
const h = { fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: '#94a3b8', margin: '18px 0 8px' };
const tag = (c) => ({ fontSize: 10.5, fontWeight: 600, letterSpacing: 0, textTransform: 'none', color: c,
  background: `${c}1f`, border: `1px solid ${c}55`, borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap' });

function Rows({ rows }) {
  return (
    <div style={box}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '4px 0', fontSize: 12.5 }}>
          <span style={{ color: '#94a3b8' }}>{r.label}</span>
          <span style={{ textAlign: 'right', fontWeight: 600, wordBreak: 'break-word' }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// Story 4.29: what the models are, what they were tested on and what they must not be used for.
export default function ModelCardModal({ isOpen, onClose }) {
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setView(buildModelCardView(await getModelCard()));
    } catch (err) {
      setView(null);
      setError(err.response?.data?.message || err.message || 'Không tải được thẻ mô hình');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  if (!isOpen) return null;
  const seg = view?.segmentation;
  const gru = view?.gru;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 12, 26, 0.82)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16
    }}>
      <div role="dialog" aria-modal="true" aria-label="Thẻ mô hình" onClick={(e) => e.stopPropagation()} style={{
        backgroundColor: '#0B1528', border: '1px solid #1E293B', borderRadius: 12, width: '100%', maxWidth: 720,
        maxHeight: '90vh', overflow: 'auto', color: '#F1F5F9', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.65)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid #1E293B', background: 'rgba(255,255,255,0.02)' }}>
          <div aria-hidden="true" style={{ background: 'rgba(167,139,250,0.15)', padding: 8, borderRadius: 8, display: 'flex' }}>
            <Cpu size={20} color="#a78bfa" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>THẺ MÔ HÌNH AI</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Số liệu lấy nguyên từ thẻ của AI service, không ước lượng thêm</div>
          </div>
          <button type="button" className="btn-ghost" onClick={load} disabled={loading} title="Tải lại" aria-label="Tải lại">
            <RefreshCw size={14} style={{ opacity: loading ? 0.5 : 1 }} /> <span className="btn-label">Làm mới</span>
          </button>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Đóng"><X size={14} /></button>
        </div>

        <div style={{ padding: '4px 20px 20px' }}>
          {error && <div role="alert" style={{ ...box, marginTop: 16, color: '#fca5a5' }}>{error}</div>}
          {loading && !view && !error && <div style={{ ...box, marginTop: 16 }}>Đang tải…</div>}

          {view && !view.available && (
            <div role="alert">
              <EmptyState icon={AlertTriangle} tone="#fbbf24" title="AI service chưa trả lời"
                hint="Chưa có thẻ mô hình. Không hiển thị số liệu nào. Bấm Làm mới sau khi AI service chạy lại." />
            </div>
          )}

          {(seg || gru) && (
            <div style={{ ...box, marginTop: 16, display: 'flex', gap: 10, alignItems: 'flex-start', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.4)' }}>
              <AlertTriangle size={16} style={{ flex: '0 0 auto', marginTop: 2 }} aria-hidden="true" />
              <span style={{ fontSize: 12.5 }}>
                Mô hình đang ở mức thử nghiệm: kết quả chỉ là ứng viên cần cán bộ xác minh, không phải xác suất sạt lở và không phải xác nhận có sạt lở.
              </span>
            </div>
          )}

          {seg && (
            <>
              <div style={h}>Mô hình phân đoạn ảnh vệ tinh</div>
              <Rows rows={seg.identity} />

              <div style={h}>Ba chế độ vận hành (ngưỡng)</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {seg.modes.map((m) => (
                  <div key={m.key} style={{ ...box, flex: '1 1 140px', borderColor: m.isDefault ? '#38bdf8' : undefined }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{m.label}{m.isDefault ? ' (mặc định)' : ''}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>ngưỡng {m.threshold}</div>
                  </div>
                ))}
              </div>

              {seg.metrics.length > 0 && (
                <>
                  <div style={h}>Kết quả kiểm tra</div>
                  <Rows rows={seg.metrics} />
                </>
              )}
              {seg.vn013.length > 0 && (
                <>
                  <div style={h}>{seg.vn013Label}</div>
                  <Rows rows={seg.vn013} />
                </>
              )}
              {seg.notes.length > 0 && (
                <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 12, color: '#94a3b8' }}>
                  {seg.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              )}
            </>
          )}

          {gru && (
            <>
              <div style={{ ...h, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>Mô hình GRU (mưa theo giờ)</span>
                <span style={tag('#22c55e')}>Đang chạy</span>
                {gru.experimental && <span style={tag('#fbbf24')}>Thử nghiệm</span>}
                {!gru.calibrated && <span style={tag('#94a3b8')}>Chưa hiệu chuẩn xác suất</span>}
              </div>
              <Rows rows={gru.rows} />
              <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.6, color: '#94a3b8' }}>
                Đầu vào: 168 giờ mưa đã qua và dự báo 24 giờ tới, nhân với hệ số đất và độ dốc của từng điểm.
                {!gru.calibrated && ' Điểm ra là thang tương đối, chưa phải xác suất sạt lở.'}
              </p>
            </>
          )}

          {view?.available && !seg && (
            <>
              <div style={h}>Mô hình phân đoạn ảnh vệ tinh</div>
              <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'center', color: '#94a3b8', fontSize: 12.5 }}>
                <span style={tag('#94a3b8')}>Chưa cài</span>
                Máy chủ này chưa có tệp mô hình ảnh vệ tinh nên không có số liệu để hiển thị.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
