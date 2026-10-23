import React, { useState } from 'react';
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import EventCard from './EventCard';

export default function VerificationQueue({
  events,
  selectedEventId,
  onSelectEvent,
  onVerifyEvent,
  onResetData,
}) {
  const [filter, setFilter] = useState('all');

  const pendingCount = events.filter(e => e.status === 'pending').length;
  const verifiedCount = events.filter(e => e.status === 'verified').length;
  const extremeCount = events.filter(e => e.risk === 'extreme').length;
  const highCount = events.filter(e => e.risk === 'high').length;

  const filteredEvents = events.filter(e => {
    if (filter === 'pending') return e.status === 'pending';
    if (filter === 'verified') return e.status === 'verified';
    return true;
  });

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-eyebrow">Trung tâm điều hành</div>
        <div className="sidebar-title">Giám sát nguy cơ 24h</div>
        <div style={{ position: 'relative' }}>
          <Search
            size={13}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }}
          />
          <input
            type="text"
            placeholder="Tìm xã, huyện..."
            style={{
              width: '100%',
              padding: '7px 10px 7px 30px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              background: 'var(--bg)',
              color: 'var(--text-1)',
              outline: 'none',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
      </div>

      {/* Overview */}
      <div className="sidebar-overview">
        <div className="overview-item">
          <div className="ov-num" style={{ color: 'var(--text-1)' }}>{events.length}</div>
          <div className="ov-label">Ô theo dõi</div>
        </div>
        <div className="overview-item">
          <div className="ov-num" style={{ color: 'var(--risk-extreme)' }}>{pendingCount}</div>
          <div className="ov-label">Chờ thẩm định</div>
        </div>
        <div className="overview-item">
          <div className="ov-num" style={{ color: 'var(--risk-extreme)' }}>{extremeCount}</div>
          <div className="ov-label">Cực nguy hiểm</div>
        </div>
        <div className="overview-item">
          <div className="ov-num" style={{ color: 'var(--risk-high)' }}>{highCount}</div>
          <div className="ov-label">Mức cao</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {[
          { key: 'all', label: `Tất cả (${events.length})` },
          { key: 'pending', label: `Chờ duyệt (${pendingCount})` },
          { key: 'verified', label: `Đã duyệt (${verifiedCount})` },
        ].map(tab => (
          <button
            key={tab.key}
            className={`filter-tab ${filter === tab.key ? 'active' : ''}`}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Event list */}
      <div className="queue-container">
        {filteredEvents.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '40px 16px',
            color: 'var(--text-3)', fontSize: 13
          }}>
            Không có sự cố trong bộ lọc này.
          </div>
        ) : (
          filteredEvents.map(event => (
            <EventCard
              key={event.id}
              event={event}
              isSelected={selectedEventId === event.id}
              onSelect={onSelectEvent}
              onVerify={onVerifyEvent}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>TerraWatch v2.4.0</span>
        <button
          onClick={onResetData}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-2)',
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <RotateCcw size={11} /> Reset demo
        </button>
      </div>
    </aside>
  );
}
