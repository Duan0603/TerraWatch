import React from 'react';
import { MapPin, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function EventCard({ event, isSelected, onSelect, onVerify }) {
  const isPending = event.status === 'pending';

  return (
    <div 
      className={`event-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(event.id)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span className={`risk-tag ${event.risk}`}>
          <AlertTriangle size={11} /> Nguy cơ {event.risk}
        </span>
        <span style={{ 
          fontSize: 11, 
          color: isPending ? '#fb923c' : (event.status === 'verified' ? '#22c55e' : '#94a3b8'), 
          fontWeight: 600 
        }}>
          {isPending ? '● Chờ cán bộ duyệt' : (event.status === 'verified' ? '✓ Đã thẩm định' : '✕ Đã bác bỏ')}
        </span>
      </div>

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{event.location}</div>
      <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
        <MapPin size={12} /> {event.coords}
      </div>

      <div className="grid-metrics">
        <div>Độ dốc: <span>{event.slope}°</span></div>
        <div>Giảm NDVI: <span>{event.ndviDrop}</span></div>
        <div>Độ tin cậy AI: <span style={{ color: '#38bdf8' }}>{Math.round(event.confidence * 100)}%</span></div>
        <div>Diện tích: <span>{event.areaM2.toLocaleString()} m²</span></div>
      </div>

      {isPending && (
        <div className="action-btn-row">
          <button 
            className="btn-approve"
            onClick={(e) => {
              e.stopPropagation();
              onVerify(event.id, 'verified');
            }}
            title="Xác nhận sạt lở và cập nhật lên bản đồ cảnh báo"
          >
            <CheckCircle size={14} /> Phê duyệt & Phát lệnh
          </button>
          <button 
            className="btn-reject"
            onClick={(e) => {
              e.stopPropagation();
              onVerify(event.id, 'rejected');
            }}
            title="Bác bỏ báo động giả"
          >
            <XCircle size={14} /> Bác bỏ
          </button>
        </div>
      )}
    </div>
  );
}
