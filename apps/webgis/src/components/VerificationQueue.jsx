import React, { useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import EventCard from './EventCard';

export default function VerificationQueue({
  events,
  selectedEventId,
  onSelectEvent,
  onReviewEvent,
  onRefresh,
  className = '',
}) {
  const [filter, setFilter] = useState('pending');
  const [query, setQuery] = useState('');

  const count = (pred) => events.filter(pred).length;
  // Chờ duyệt: chỉ đếm pending còn hiệu lực (hết hạn không duyệt được)
  const pendingCount = count(e => e.status === 'pending' && !e.expired);
  const approvedCount = count(e => e.status === 'approved');
  const rejectedCount = count(e => e.status === 'rejected');
  const extremeCount = count(e => e.risk === 'extreme');
  const highCount = count(e => e.risk === 'high');

  const q = query.trim().toLowerCase();
  const filteredEvents = events.filter(e => {
    // Dự báo hết hạn không hiện trong tab "Chờ duyệt" (không thẩm định được)
    if (filter === 'pending' && e.expired) return false;
    return (filter === 'all' || e.status === filter) && (!q || e.location.toLowerCase().includes(q));
  });

  return (
    <aside className={`sidebar${className ? ' ' + className : ''}`}>
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
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm khu vực..."
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
          />
        </div>
      </div>

      <div className="sidebar-overview">
        <div className="overview-item">
          <div className="ov-num" style={{ color: 'var(--text-1)' }}>{events.length}</div>
          <div className="ov-label">Ô đánh giá</div>
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

      <div className="filter-tabs">
        {[
          { key: 'pending', label: `Chờ duyệt (${pendingCount})` },
          { key: 'approved', label: `Đã duyệt (${approvedCount})` },
          { key: 'rejected', label: `Từ chối (${rejectedCount})` },
          { key: 'all', label: `Tất cả (${events.length})` },
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

      <div className="queue-container">
        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-3)', fontSize: 13 }}>
            Không có đề xuất cảnh báo trong bộ lọc này.
          </div>
        ) : (
          filteredEvents.map(event => (
            <EventCard
              key={event.id}
              event={event}
              isSelected={selectedEventId === event.id}
              onSelect={onSelectEvent}
              onReview={onReviewEvent}
            />
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Tự làm mới mỗi 60 giây</span>
        <button
          onClick={onRefresh}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-2)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <RefreshCw size={11} /> Làm mới
        </button>
      </div>
    </aside>
  );
}
