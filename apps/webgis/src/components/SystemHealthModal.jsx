import React, { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, X, AlertCircle } from 'lucide-react';
import adminApi from '../api/adminApi';
import { ageLabel, ageTone } from '../utils/health';
import { fmtVN } from '../utils/time';

const STATUS = {
  ok: { label: 'Hoạt động', color: '#34d399' },
  degraded: { label: 'Chạy nhưng chưa đủ', color: '#fbbf24' },
  down: { label: 'Mất kết nối', color: '#f87171' }
};
const TONE = { ok: '#34d399', warn: '#fbbf24', bad: '#f87171' };

const row = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };
const dot = (color) => ({ width: 10, height: 10, borderRadius: '50%', background: color, flex: '0 0 auto' });

// Story 4.26: admin-only panel - which services answer and how old the latest data is.
export default function SystemHealthModal({ isOpen, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminApi.getSystemHealth());
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không tải được tình trạng hệ thống');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 12, 26, 0.82)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16
    }}>
      <div role="dialog" aria-modal="true" aria-label="Tình trạng hệ thống" onClick={(e) => e.stopPropagation()} style={{
        backgroundColor: '#0B1528', border: '1px solid #1E293B', borderRadius: 12, width: '100%', maxWidth: 640,
        maxHeight: '90vh', overflow: 'auto', color: '#F1F5F9', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.65)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid #1E293B' }}>
          <Activity size={18} aria-hidden="true" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Tình trạng hệ thống</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {data ? `Kiểm tra lúc ${fmtVN(data.checkedAt)}` : 'Đang kiểm tra…'}
            </div>
          </div>
          <button type="button" className="btn-ghost" onClick={load} disabled={loading} title="Kiểm tra lại">
            <RefreshCw size={14} style={{ opacity: loading ? 0.5 : 1 }} /> <span className="btn-label">Làm mới</span>
          </button>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Đóng"><X size={16} /></button>
        </div>

        <div style={{ padding: 20, display: 'grid', gap: 18 }}>
          {error && (
            <div role="alert" style={{ ...row, color: '#fca5a5' }}><AlertCircle size={16} /> {error}</div>
          )}

          {data && (
            <>
              <section aria-label="Các thành phần">
                <h3 style={{ margin: '0 0 8px', fontSize: 12, color: '#94a3b8', letterSpacing: 0.4 }}>CÁC THÀNH PHẦN</h3>
                <div style={{ display: 'grid', gap: 8 }}>
                  {data.components.map((c) => {
                    const s = STATUS[c.status] || STATUS.down;
                    return (
                      <div key={c.key} style={row}>
                        <span style={dot(s.color)} aria-hidden="true" />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.status === 'ok' ? 'Phản hồi bình thường' : c.detail}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.label}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.latencyMs} ms</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section aria-label="Độ tươi dữ liệu">
                <h3 style={{ margin: '0 0 8px', fontSize: 12, color: '#94a3b8', letterSpacing: 0.4 }}>ĐỘ TƯƠI CỦA DỮ LIỆU</h3>
                <div style={{ display: 'grid', gap: 8 }}>
                  {data.freshness.map((f) => {
                    const color = TONE[ageTone(f.ageMinutes)];
                    return (
                      <div key={f.key} style={row}>
                        <span style={dot(color)} aria-hidden="true" />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{f.latest ? fmtVN(f.latest) : 'Chưa có bản ghi nào'}</div>
                        </div>
                        <div style={{ fontSize: 12, color, fontWeight: 600 }}>{ageLabel(f.ageMinutes)}</div>
                      </div>
                    );
                  })}
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94a3b8' }}>
                  Màu vàng khi dữ liệu cũ hơn 6 giờ, đỏ khi cũ hơn 24 giờ hoặc chưa có dữ liệu.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
