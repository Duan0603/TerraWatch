import React, { useState, useEffect } from 'react';
import { ShieldCheck, LogOut, MapPin } from 'lucide-react';
import DetailPanel from '../components/DetailPanel';
import landslideApi from '../api/landslideApi';
import { useAuth } from '../context/AuthContext';

// Trang tối giản cho công dân (citizen): chỉ xem bản đồ các điểm sạt lở ĐÃ PHÊ DUYỆT
// (status === 'verified') cùng bằng chứng mưa/địa hình — không có nút thẩm định/phát
// cảnh báo nào (những thao tác đó chỉ dành cho officer/admin trên DashboardPage).
export default function CitizenPage() {
  const { user, logout } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);

  useEffect(() => {
    landslideApi.getLandslides({ status: 'verified' }).then((data) => {
      setEvents(data);
      if (data.length > 0) {
        setSelectedEventId(data[0].id);
      }
    });
  }, []);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;

  return (
    <div className="dashboard-root">
      <header className="top-nav">
        <div className="nav-left">
          <div className="nav-brand">
            <div className="nav-brand-icon">
              <ShieldCheck size={20} color="#fff" />
            </div>
            <div className="nav-brand-text">
              <span className="nav-brand-name">TerraWatch</span>
              <span className="nav-brand-sub">Cảnh báo sạt lở cho người dân</span>
            </div>
          </div>
        </div>

        <div className="nav-right">
          <div className="status-chip">
            <span className="live-dot" />
            Đang theo dõi khu vực của bạn
          </div>

          <div className="nav-user">
            <div className="nav-avatar">
              {(user?.fullName || 'CD').split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase()}
            </div>
            <div className="nav-user-info">
              <div className="nav-user-name">{user?.fullName || 'Công dân'}</div>
              <div className="nav-user-role">Tài khoản công dân</div>
            </div>
          </div>

          <button className="btn-ghost" onClick={logout} title="Đăng xuất">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <div className="main-layout">
        {/* Danh sách chỉ đọc các điểm đã được cán bộ phê duyệt — không có nút thẩm định */}
        <aside className="sidebar" style={{ width: 300, overflowY: 'auto' }}>
          <div style={{ padding: '14px 16px', fontWeight: 700, fontSize: 14 }}>
            Cảnh báo đã xác nhận ({events.length})
          </div>
          {events.map((ev) => (
            <div
              key={ev.id}
              onClick={() => setSelectedEventId(ev.id)}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                borderLeft: ev.id === selectedEventId ? '3px solid #087B70' : '3px solid transparent',
                background: ev.id === selectedEventId ? 'rgba(8,123,112,0.08)' : 'transparent'
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.location}</div>
              <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={11} /> Mức độ: {ev.risk}
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div style={{ padding: 16, fontSize: 12, color: '#64748b' }}>
              Hiện chưa có cảnh báo nào đã được xác nhận tại khu vực bạn đăng ký.
            </div>
          )}
        </aside>

        <DetailPanel
          selectedEvent={selectedEvent}
          events={events}
          onSelectEvent={setSelectedEventId}
        />
      </div>
    </div>
  );
}
