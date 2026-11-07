import React from 'react';
import { 
  GitCompare, 
  X, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Clock, 
  CloudRain, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Calendar,
  Layers
} from 'lucide-react';
import { fmtVN, hourVN } from '../utils/time';

const HAZARD_COLORS = {
  extreme: { bg: 'rgba(239, 68, 68, 0.2)', border: '#f87171', text: '#fca5a5', label: 'CỰC KỲ NGUY HIỂM' },
  high: { bg: 'rgba(249, 115, 22, 0.2)', border: '#fb923c', text: '#fdba74', label: 'NGUY HIỂM CAO' },
  medium: { bg: 'rgba(234, 179, 8, 0.2)', border: '#facc15', text: '#fde047', label: 'TRUNG BÌNH' },
  low: { bg: 'rgba(56, 189, 248, 0.2)', border: '#38bdf8', text: '#7dd3fc', label: 'THẤP / AN TOÀN' },
  safe: { bg: 'rgba(34, 197, 94, 0.2)', border: '#4ade80', text: '#86efac', label: 'AN TOÀN' },
};

const REVIEW_LABELS = {
  approved: { label: 'Đã duyệt', color: '#4ade80', icon: CheckCircle2 },
  rejected: { label: 'Bác bỏ', color: '#f87171', icon: XCircle },
  pending: { label: 'Chờ duyệt', color: '#facc15', icon: Clock },
  superseded: { label: 'Đã thay thế', color: '#94a3b8', icon: Minus }
};

export default function ForecastComparisonModal({ isOpen, onClose, selectedEvent: ev }) {
  if (!isOpen || !ev) return null;

  const currentRun = {
    runId: ev.id,
    issuedAt: ev.issuedAt,
    hazardLevel: ev.risk || 'high',
    probability: ev.probability,
    reviewStatus: ev.status,
    isCurrent: true
  };

  const prior = ev.priorRuns || [];
  // Merge current and prior, sorted descending by issuedAt
  const allRuns = [currentRun, ...prior.map(p => ({ ...p, isCurrent: false }))];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 8, 16, 0.88)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20
    }}>
      <div style={{
        maxWidth: 880,
        width: '100%',
        background: 'rgba(13, 19, 34, 0.98)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: 16,
        boxShadow: '0 25px 70px rgba(0, 0, 0, 0.85)',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: 8, borderRadius: 8, display: 'flex' }}>
              <GitCompare size={20} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#fff' }}>
                SO SÁNH CÁC LẦN DỰ BÁO THEO THỜI GIAN
              </h3>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                Đối chiếu tiến trình dự báo & điểm nguy cơ qua các chu kỳ chạy cho ô: <strong style={{ color: '#38bdf8' }}>{ev.location}</strong> ({ev.unit?.unitId || ev.id})
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              padding: 6,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {/* Unit Highlights */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12
          }}>
            <div>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Khu Vực Quản Lý</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginTop: 3 }}>
                {ev.location}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Mã Ô Đánh Giá</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', marginTop: 3, fontFamily: 'monospace' }}>
                {ev.unit?.unitId || 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Độ Dốc Trung Bình / Max</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginTop: 3 }}>
                {ev.unit?.slopeAvg != null ? `${ev.unit.slopeAvg.toFixed(1)}°` : '—'} / {ev.unit?.slopeMax != null ? `${ev.unit.slopeMax.toFixed(1)}°` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Số Lần Chạy Đã Ghi Nhận</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', marginTop: 3 }}>
                {allRuns.length} chu kỳ dự báo
              </div>
            </div>
          </div>

          {/* Timeline Run Progression */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={14} color="#38bdf8" />
              <span>Tiến trình biến thiên cấp độ nguy cơ & điểm thử nghiệm (Mới nhất → Cũ hơn)</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {allRuns.map((run, index) => {
                const nextOlderRun = allRuns[index + 1];
                let delta = null;
                if (run.probability != null && nextOlderRun?.probability != null) {
                  delta = Math.round((run.probability - nextOlderRun.probability) * 100);
                }

                const hazardKey = (run.hazardLevel || 'high').toLowerCase();
                const hazardStyle = HAZARD_COLORS[hazardKey] || HAZARD_COLORS.high;
                const reviewKey = (run.reviewStatus || 'pending').toLowerCase();
                const reviewInfo = REVIEW_LABELS[reviewKey] || REVIEW_LABELS.pending;
                const ReviewIcon = reviewInfo.icon;

                return (
                  <div
                    key={run.runId}
                    style={{
                      background: run.isCurrent ? 'rgba(2, 132, 199, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${run.isCurrent ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                      borderRadius: 12,
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {run.isCurrent && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        background: '#0284c7',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderBottomRightRadius: 6,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5
                      }}>
                        ĐỢT DỰ BÁO HIỆN TẠI
                      </div>
                    )}

                    {/* Left: Time & Run metadata */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: run.isCurrent ? 6 : 0 }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 700,
                        color: run.isCurrent ? '#38bdf8' : '#64748b'
                      }}>
                        #{index + 1}
                      </div>

                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Clock size={13} color="#94a3b8" />
                          <span>{fmtVN(run.issuedAt)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>
                          Mã chạy: {run.runId}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Hazard & Review Status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: hazardStyle.bg,
                        border: `1px solid ${hazardStyle.border}`,
                        color: hazardStyle.text
                      }}>
                        {hazardStyle.label}
                      </span>

                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        color: reviewInfo.color,
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                      }}>
                        <ReviewIcon size={12} />
                        <span>{reviewInfo.label}</span>
                      </span>
                    </div>

                    {/* Right: Score & Delta */}
                    <div style={{ textAlign: 'right', minWidth: 120 }}>
                      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Điểm Thử Nghiệm</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 1 }}>
                        {run.probability != null ? `${Math.round(run.probability * 100)}%` : '—'}
                      </div>
                      {delta !== null && (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                          fontSize: 11,
                          fontWeight: 700,
                          color: delta > 0 ? '#f87171' : delta < 0 ? '#4ade80' : '#94a3b8',
                          marginTop: 2
                        }}>
                          {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                          <span>{delta > 0 ? `+${delta}%` : `${delta}%`} so với đợt trước</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rainfall comparison context */}
          {ev.forecastRain && ev.forecastRain.length > 0 && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 12,
              padding: 16
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CloudRain size={13} color="#38bdf8" />
                <span>Dự Báo Lượng Mưa 24H từ các nguồn đối tác</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {ev.forecastRain.map((f, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: 8,
                    padding: 10
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1' }}>{f.provider || 'Nguồn đối tác'}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>{f.mm24h != null ? `${f.mm24h} mm` : '—'}</div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Phát hành: {fmtVN(f.issuedAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
