import React from 'react';
import { CloudRain, Mountain, Calendar, X, AlertTriangle } from 'lucide-react';
import { fmtVN, fmtUtc, hourVN, relativeToNow } from '../utils/time';

const STATE = {
  expired: { label: 'Hết hạn', bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA' },
  unavailable: { label: 'Không có dự báo', bg: '#FEFCE8', fg: '#92400E', border: '#FEF08A' },
  superseded: { label: 'Đã bị thay thế', bg: '#F1F5F9', fg: '#475569', border: '#CBD5E1' },
  fresh: { label: 'Còn hiệu lực', bg: '#F0FDF4', fg: '#15803D', border: '#BBF7D0' },
};

const stateOf = (e) =>
  e.status === 'superseded' ? 'superseded'
  : e.availability !== 'available' ? 'unavailable'
  : e.expired ? 'expired' : 'fresh';

const fmt = (v, d = 1) => (typeof v === 'number' ? Number(v.toFixed(d)).toString() : String(v));

// Hiển thị JSON tự do (yếu tố đóng góp / chất lượng đầu vào) thành danh sách "khóa: giá trị".
const REVIEW_VN = { pending: 'chờ duyệt', approved: 'đã duyệt', rejected: 'từ chối', superseded: 'đã bị thay thế' };

const entriesOf = (data) => {
  if (data == null) return [];
  if (Array.isArray(data)) return data.map((v, i) => [String(i + 1), typeof v === 'object' ? JSON.stringify(v) : fmt(v, 2)]);
  if (typeof data === 'object') return Object.entries(data).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : fmt(v, 2)]);
  return [['', fmt(data)]];
};

function KeyValues({ title, data }) {
  const rows = entriesOf(data);
  if (rows.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#172524', marginBottom: 4 }}>{title}</div>
      <div style={{ background: '#F5F8F7', border: '1px solid #DCE5E2', borderRadius: 8, padding: '6px 10px', fontSize: 10, color: '#475569' }}>
        {rows.map(([k, v]) => (
          <div key={k + v} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0' }}>
            <span>{k}</span><strong style={{ color: '#172524', textAlign: 'right' }}>{v}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RainfallEvidencePanel({ selectedEvent: ev, onClose }) {
  if (!ev) return null;

  const state = STATE[stateOf(ev)];
  const hasEvidence = Array.isArray(ev.observedRain);
  const obs = ev.observedRain || [];
  const measured = obs.filter(o => o.mm != null);
  const missing = obs.length - measured.length;
  const observedTotal = measured.reduce((s, o) => s + o.mm, 0);
  const forecasts = ev.forecastRain || [];
  const latestForecast = forecasts[0];
  const maxHourly = Math.max(1, ...measured.map(o => o.mm));
  const maxTotal = Math.max(1, observedTotal, latestForecast?.mm24h || 0);
  const prior = ev.priorRuns || [];

  return (
    <div className="evidence-panel" style={{
      position: 'absolute', bottom: 20, right: 20, width: 380, maxHeight: 'calc(100vh - 110px)', overflowY: 'auto',
      background: '#fff', border: '1px solid #DCE5E2', borderRadius: 14, boxShadow: '0 8px 32px rgba(23,37,36,0.12)', zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid #DCE5E2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: '#E4F4F1', padding: 7, borderRadius: 8 }}>
            <CloudRain size={16} color="#087B70" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#172524' }}>Bằng chứng mưa & địa hình</div>
            <div style={{ fontSize: 10, color: '#687977' }}>{ev.location}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: state.bg, color: state.fg, border: `1px solid ${state.border}` }}>
            {state.label}
          </span>
          {onClose && (
            <button onClick={onClose} aria-label="Đóng" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9BB0AD' }}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {ev.availability !== 'available' && (
          <div style={{ background: '#FEFCE8', border: '1px solid #FEF08A', color: '#92400E', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, display: 'flex', gap: 8 }}>
            <AlertTriangle size={14} /> Chưa có dự báo cho ô này: {ev.unavailabilityReason || 'thiếu dữ liệu đầu vào'}. Không đồng nghĩa nguy cơ thấp.
          </div>
        )}

        {hasEvidence && (
          <>
            {/* Quan trắc vs dự báo */}
            <div style={{ fontSize: 11, fontWeight: 600, color: '#172524', marginBottom: 6 }}>Mưa quan trắc 24h trước khi phát hành vs dự báo 24h tới</div>
            {[
              { label: 'Quan trắc', value: obs.length ? observedTotal : null, color: '#087B70' },
              { label: 'Dự báo', value: latestForecast ? latestForecast.mm24h : null, color: '#F97316' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 11 }}>
                <span style={{ width: 62, color: '#687977' }}>{label}</span>
                <div style={{ flex: 1, background: '#F5F8F7', borderRadius: 4, height: 14 }}>
                  {value != null && <div style={{ width: `${(value / maxTotal) * 100}%`, height: '100%', background: color, borderRadius: 4 }} />}
                </div>
                <strong style={{ width: 64, textAlign: 'right', color: '#172524' }}>{value == null ? 'chưa có' : `${fmt(value)} mm`}</strong>
              </div>
            ))}
            {missing > 0 && (
              <div style={{ fontSize: 10, color: '#92400E', marginBottom: 6 }}>
                Thiếu {missing}/{obs.length} khoảng quan trắc — tổng thực tế có thể cao hơn; thiếu dữ liệu không phải là không mưa.
              </div>
            )}

            {/* Quan trắc theo khoảng */}
            {obs.length > 0 && (
              <div style={{ margin: '10px 0 14px' }}>
                <div style={{ fontSize: 10, color: '#687977', marginBottom: 4 }}>Mưa quan trắc theo khoảng (giờ VN)</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', height: 70, background: '#F5F8F7', padding: '6px 4px 2px', borderRadius: 8, border: '1px solid #DCE5E2', gap: 2 }}>
                  {obs.map((o, i) => (
                    <div key={i} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
                      title={o.mm == null ? `Thiếu dữ liệu (${o.quality})` : `${o.mm} mm — ${o.source}`}>
                      <div style={{ width: '70%', height: o.mm == null ? 6 : `${Math.max((o.mm / maxHourly) * 48, 2)}px`,
                        background: o.mm == null ? 'repeating-linear-gradient(45deg,#CBD5E1,#CBD5E1 2px,#fff 2px,#fff 4px)' : '#087B70', borderRadius: '2px 2px 0 0' }} />
                      <span style={{ fontSize: 7, color: '#9BB0AD' }}>{hourVN(o.intervalEnd)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {obs.length === 0 && (
              <div style={{ fontSize: 11, color: '#92400E', marginBottom: 12 }}>Chưa có dữ liệu mưa quan trắc cho ô này.</div>
            )}

            {/* So sánh các lần chạy dự báo */}
            {(forecasts.length > 0 || prior.length > 0) && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#172524', marginBottom: 4 }}>So sánh các lần chạy</div>
                <div style={{ background: '#F5F8F7', border: '1px solid #DCE5E2', borderRadius: 8, padding: '6px 10px', fontSize: 10, color: '#475569' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#172524' }}>
                    <strong>Lần này · {fmtVN(ev.issuedAt)}</strong>
                    <strong>{ev.probability == null ? '—' : `${Math.round(ev.probability * 100)}%`}</strong>
                  </div>
                  {prior.map(p => (
                    <div key={p.runId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0' }}>
                      <span>Trước · {fmtVN(p.issuedAt)} · {p.hazardLevel || 'n/a'} · {REVIEW_VN[p.reviewStatus] || p.reviewStatus}</span>
                      <span>{p.probability == null ? '—' : `${Math.round(p.probability * 100)}%`}
                        {p.probability != null && ev.probability != null && ` (${ev.probability >= p.probability ? '+' : ''}${Math.round((ev.probability - p.probability) * 100)})`}</span>
                    </div>
                  ))}
                  {forecasts.map(f => (
                    <div key={f.providerRunId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0' }}>
                      <span>Mưa dự báo {f.provider} · {fmtVN(f.issuedAt)}</span><span>{fmt(f.mm24h)} mm</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Địa hình */}
        {ev.unit && (
          <div style={{ background: '#F5F8F7', border: '1px solid #DCE5E2', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: '#687977', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <Mountain size={12} color="#087B70" /> Địa hình ô đánh giá
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: '#475569' }}>
              <div>Độ dốc TB: <strong>{ev.unit.slopeAvg == null ? '—' : `${fmt(ev.unit.slopeAvg)}°`}</strong></div>
              <div>Độ dốc max: <strong>{ev.unit.slopeMax == null ? '—' : `${fmt(ev.unit.slopeMax)}°`}</strong></div>
              <div>Độ cao TB: <strong>{ev.unit.elevationAvg == null ? '—' : `${fmt(ev.unit.elevationAvg, 0)} m`}</strong></div>
              <div>Chênh cao: <strong>{ev.unit.reliefM == null ? '—' : `${fmt(ev.unit.reliefM, 0)} m`}</strong></div>
            </div>
            <div style={{ fontSize: 10, color: '#687977', marginTop: 6 }}>
              Độ phân giải hiệu dụng ≈ {ev.unit.effectiveResolutionM == null ? '—' : `${fmt(ev.unit.effectiveResolutionM, 0)} m`}: đây là vùng đánh giá nguy cơ, không phải vị trí chính xác của một điểm sạt lở.
            </div>
          </div>
        )}

        <KeyValues title="Yếu tố đóng góp" data={ev.factors} />
        <KeyValues title="Chất lượng dữ liệu đầu vào" data={ev.quality} />

        <div style={{ fontSize: 10, color: '#687977', display: 'grid', gap: 3, paddingTop: 10, borderTop: '1px solid #DCE5E2' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }} title={fmtUtc(ev.issuedAt)}>
            <Calendar size={11} /> Phát hành: {fmtVN(ev.issuedAt)} ({relativeToNow(ev.issuedAt).replace('còn', 'sau').replace('đã quá', 'cách đây')})
          </span>
          <span style={{ color: ev.expired ? '#B91C1C' : '#087B70', fontWeight: 600 }} title={fmtUtc(ev.validUntil)}>
            Hiệu lực: {fmtVN(ev.validFrom)} → {fmtVN(ev.validUntil)}
          </span>
        </div>
      </div>
    </div>
  );
}
