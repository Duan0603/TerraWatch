import React from 'react';
import { MapPin, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { fmtVN, relativeToNow } from '../utils/time';

export const RISK_LABELS = {
  extreme: 'Cực nguy hiểm',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
  unavailable: 'Không có dự báo',
};

const STATUS_LABELS = {
  pending: '● Chờ thẩm định',
  approved: '✓ Đã phê duyệt',
  rejected: '✕ Đã từ chối',
  superseded: '↻ Đã bị thay thế',
};

const fmtNum = (v, unit = '', digits = 0) => (v == null ? '—' : `${Number(v).toFixed(digits)}${unit}`);

export default function EventCard({ event, isSelected, onSelect, onReview }) {
  // Chỉ duyệt được đề xuất còn hiệu lực và thật sự có dự báo (backend kiểm tra lại).
  const canReview = event.status === 'pending' && !event.expired && event.availability === 'available';

  return (
    <div className={`event-card ${isSelected ? 'selected' : ''}`} onClick={() => onSelect(event.id)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span className={`risk-tag ${event.risk}`}>
          <AlertTriangle size={10} />
          {RISK_LABELS[event.risk] || event.risk}
        </span>
        <span className={`event-status ${event.status}`}>
          {STATUS_LABELS[event.status] || event.status}
        </span>
      </div>

      <div className="event-location">{event.location}</div>
      <div className="event-coords">
        <MapPin size={11} />
        {event.lat.toFixed(3)}°N, {event.lng.toFixed(3)}°E
      </div>

      <div className="grid-metrics">
        <div>Xác suất: <span style={{ color: 'var(--primary)' }}>{event.probability == null ? '—' : `${Math.round(event.probability * 100)}%`}</span></div>
        <div>Độ dốc TB: <span>{fmtNum(event.unit.slopeAvg, '°', 1)}</span></div>
        <div>Độ cao TB: <span>{fmtNum(event.unit.elevationAvg, ' m')}</span></div>
        <div>Mô hình: <span>{event.modelVersion}</span></div>
      </div>

      <div style={{ fontSize: 11, marginTop: 6, color: event.expired ? '#B91C1C' : 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }} title={`Hiệu lực đến ${fmtVN(event.validUntil)}`}>
        <Clock size={11} />
        {event.expired ? 'Hết hạn' : 'Hiệu lực'}: {relativeToNow(event.validUntil)}
      </div>
      {event.availability !== 'available' && (
        <div style={{ fontSize: 11, color: '#92400E', marginTop: 4 }}>
          Không có dự báo: {event.unavailabilityReason || 'thiếu dữ liệu đầu vào'}
        </div>
      )}

      {canReview && (
        <div className="action-btn-row">
          <button className="btn-approve" onClick={e => { e.stopPropagation(); onReview(event.id, 'approved'); }}>
            <CheckCircle size={13} /> Phê duyệt
          </button>
          <button className="btn-reject" onClick={e => { e.stopPropagation(); onReview(event.id, 'rejected'); }}>
            <XCircle size={13} /> Từ chối
          </button>
        </div>
      )}
    </div>
  );
}
