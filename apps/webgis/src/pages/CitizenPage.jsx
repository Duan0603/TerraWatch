import React, { useState, useEffect } from 'react';
import { ShieldCheck, LogOut, MapPin } from 'lucide-react';
import DetailPanel from '../components/DetailPanel';
import { RISK_LABELS } from '../components/EventCard';
import { fmtVN } from '../utils/time';
import forecastApi, { apiErrorMessage } from '../api/forecastApi';
import { useAuth } from '../context/AuthContext';

// Trang tối giản cho công dân (citizen): chỉ xem bản đồ các điểm sạt lở ĐÃ PHÊ DUYỆT
// (đã duyệt, còn hiệu lực) cùng bằng chứng mưa/địa hình — không có nút thẩm định/phát
// cảnh báo nào (những thao tác đó chỉ dành cho officer/admin trên DashboardPage).
export default function CitizenPage() {
  const { user, logout } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // Vùng cảnh báo đã duyệt và còn hiệu lực (cùng nguồn với bộ nhớ ngoại tuyến của ứng dụng di động)
  useEffect(() => {
    forecastApi.getApprovedZones().then((data) => {
      setEvents(data);
      if (data.length > 0) {
        setSelectedEventId(data[0].id);
      }
    }).catch((err) => setLoadError(apiErrorMessage(err, 'Không tải được vùng cảnh báo')));
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
            Vùng cảnh báo đã duyệt, còn hiệu lực
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
        {/* Danh sách chỉ đọc các vùng đã được cán bộ phê duyệt và còn hiệu lực — không có nút thẩm định.
            Đây là mọi vùng đang hiệu lực, chưa lọc theo khu vực người dân đăng ký (backend chưa trả khu vực của ô). */}
        <aside className="sidebar citizen-list">
          <div style={{ padding: '14px 16px', fontWeight: 700, fontSize: 14 }}>
            Cảnh báo đang hiệu lực ({events.length})
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
                <MapPin size={11} /> Mức nguy cơ: {RISK_LABELS[ev.risk] || ev.risk}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Hiệu lực đến {fmtVN(ev.validUntil)}</div>
            </div>
          ))}
          {loadError && <div role="alert" style={{ padding: 16, fontSize: 12, color: '#B91C1C' }}>{loadError}</div>}
          {events.length === 0 && !loadError && (
            <div style={{ padding: 16, fontSize: 12, color: '#64748b' }}>
              Hiện chưa có vùng cảnh báo nào đã được cán bộ duyệt và còn hiệu lực. Đây không phải xác nhận an toàn.
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
