import React from 'react';
import { MapPin, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const RISK_LABELS = {
  extreme: 'Cực nguy hiểm',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
};

const STATUS_LABELS = {
  pending: '● Chờ thẩm định',
  verified: '✓ Đã phê duyệt',
  rejected: '✕ Đã từ chối',
};

export default function EventCard({ event, isSelected, onSelect, onVerify }) {
  const isPending = event.status === 'pending';

  return (
    <div
      className={`event-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(event.id)}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span className={`risk-tag ${event.risk}`}>
          <AlertTriangle size={10} />
          {RISK_LABELS[event.risk] || event.risk}
        </span>
        <span className={`event-status ${event.status}`}>
          {STATUS_LABELS[event.status] || event.status}
        </span>
      </div>

      {/* Location */}
      <div className="event-location">{event.location}</div>
      <div className="event-coords">
        <MapPin size={11} />
        {event.coords}
      </div>

      {/* Metrics */}
      <div className="grid-metrics">
        <div>Điểm AI: <span style={{ color: 'var(--primary)' }}>{Math.round(event.confidence * 100)}/100</span></div>
        <div>Diện tích: <span>{event.areaM2?.toLocaleString()} m²</span></div>
        <div>Độ dốc: <span>{event.slope}°</span></div>
        <div>NDVI drop: <span>{event.ndviDrop}</span></div>
      </div>

      {/* Actions — only for pending */}
      {isPending && (
        <div className="action-btn-row">
          <button
            className="btn-approve"
            onClick={e => { e.stopPropagation(); onVerify(event.id, 'verified'); }}
          >
            <CheckCircle size={13} /> Phê duyệt
          </button>
          <button
            className="btn-reject"
            onClick={e => { e.stopPropagation(); onVerify(event.id, 'rejected'); }}
          >
            <XCircle size={13} /> Từ chối
          </button>
        </div>
      )}
    </div>
  );
}
