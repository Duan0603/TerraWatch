import React, { useState } from 'react';
import { RotateCcw, Filter, Layers } from 'lucide-react';
import EventCard from './EventCard';

export default function VerificationQueue({ 
  events, 
  selectedEventId, 
  onSelectEvent, 
  onVerifyEvent, 
  onResetData 
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'verified'

  const pendingCount = events.filter(e => e.status === 'pending').length;
  const verifiedCount = events.filter(e => e.status === 'verified').length;
  const totalPopulationAtRisk = events
    .filter(e => e.status === 'verified')
    .reduce((sum, e) => sum + (e.estPopulation || 0), 0);

  const filteredEvents = events.filter(e => {
    if (filter === 'pending') return e.status === 'pending';
    if (filter === 'verified') return e.status === 'verified';
    return true;
  });

  return (
    <aside className="sidebar">
      {/* 1. Top Quick Stats */}
      <div className="sidebar-stats">
        <div className="stat-box">
          <div className="lbl">Chờ thẩm định</div>
          <div className="num" style={{ color: '#fb923c' }}>{pendingCount}</div>
        </div>
        <div className="stat-box">
          <div className="lbl">Đã cảnh báo</div>
          <div className="num" style={{ color: '#ef4444' }}>{verifiedCount}</div>
        </div>
        <div className="stat-box">
          <div className="lbl">Dân số nguy cơ</div>
          <div className="num" style={{ color: '#38bdf8' }}>{totalPopulationAtRisk.toLocaleString()}</div>
        </div>
      </div>

      {/* 2. Header & Filter Tabs */}
      <div style={{ 
        padding: '12px 16px 8px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Hàng Đợi AI ({filteredEvents.length} điểm)
        </div>

        {/* Filter Buttons */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.3)', padding: 2, borderRadius: 6 }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              background: filter === 'all' ? '#0284c7' : 'transparent',
              color: filter === 'all' ? '#fff' : '#94a3b8',
              border: 'none',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 10,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Tất cả
          </button>
          <button
            onClick={() => setFilter('pending')}
            style={{
              background: filter === 'pending' ? '#fb923c' : 'transparent',
              color: filter === 'pending' ? '#fff' : '#94a3b8',
              border: 'none',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 10,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Chờ duyệt ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('verified')}
            style={{
              background: filter === 'verified' ? '#22c55e' : 'transparent',
              color: filter === 'verified' ? '#fff' : '#94a3b8',
              border: 'none',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 10,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Đã duyệt
          </button>
        </div>
      </div>

      {/* 3. Event List */}
      <div className="queue-container">
        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b', fontSize: 13 }}>
            Không có sự cố nào trong bộ lọc này.
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

      {/* 4. Footer Reset Demo Button */}
      <div style={{ 
        padding: '10px 16px', 
        borderTop: '1px solid rgba(255,255,255,0.06)', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.15)'
      }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>TerraWatch SE-Capstone</span>
        <button
          onClick={onResetData}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
          title="Đặt lại danh sách mẫu ban đầu"
        >
          <RotateCcw size={12} /> Reset dữ liệu mẫu
        </button>
      </div>
    </aside>
  );
}
