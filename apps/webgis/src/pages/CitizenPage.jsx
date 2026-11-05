import React, { useState, useEffect } from 'react';
import { ShieldCheck, LogOut, MapPin, AlertTriangle, X } from 'lucide-react';
import DetailPanel from '../components/DetailPanel';
import forecastApi, { apiErrorMessage } from '../api/forecastApi';
import broadcastApi from '../api/broadcastApi';
import { useAuth } from '../context/AuthContext';

const SEVERITY_STYLE = {
  extreme: { bg: '#fef2f2', border: '#fca5a5', badge: '#dc2626', badgeText: '#fff', label: 'CỰC KỲ NGUY HIỂM' },
  high:    { bg: '#fff7ed', border: '#fdba74', badge: '#ea580c', badgeText: '#fff', label: 'NGUY CƠ CAO' },
  medium:  { bg: '#fefce8', border: '#fde047', badge: '#ca8a04', badgeText: '#fff', label: 'TRUNG BÌNH' },
  low:     { bg: '#f0fdf4', border: '#86efac', badge: '#16a34a', badgeText: '#fff', label: 'THẤP' },
};

function AlertBanner({ broadcast, onDismiss }) {
  const s = SEVERITY_STYLE[broadcast.severity] || SEVERITY_STYLE.high;
  const issuedTime = new Date(broadcast.issuedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  return (
    <div style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 10, position: 'relative' }}>
      <button onClick={onDismiss} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2 }}>
        <X size={14} />
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <AlertTriangle size={16} color={s.badge} />
        <span style={{ background: s.badge, color: s.badgeText, fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>{s.label}</span>
        <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 'auto', paddingRight: 20 }}>{issuedTime}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#111', marginBottom: 4, lineHeight: 1.4 }}>{broadcast.title}</div>
      <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.6 }}>{broadcast.message}</div>
      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 5 }}>📍 {broadcast.areaName}</div>
    </div>
  );
}

export default function CitizenPage() {
  const { user, logout } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [eventsReady, setEventsReady] = useState(false);
  const [broadcasts, setBroadcasts] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('tw_dismissed_bc') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    forecastApi.getApprovedZones().then((data) => {
      setEvents(data);
      if (data.length > 0) setSelectedEventId(data[0].id);
      setEventsReady(true);
    }).catch((err) => {
      setLoadError(apiErrorMessage(err, 'Không tải được vùng cảnh báo'));
      setEventsReady(true);
    });

    broadcastApi.getBroadcastsForMe().then(setBroadcasts).catch(() => {});
  }, []);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;
  const visibleBroadcasts = broadcasts.filter(b => !dismissedIds.includes(b.broadcastId));

  const dismissBroadcast = (id) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    try { sessionStorage.setItem('tw_dismissed_bc', JSON.stringify(next)); } catch {}
  };

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
          {visibleBroadcasts.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
              <AlertTriangle size={13} />
              {visibleBroadcasts.length} lệnh khẩn cấp
            </div>
          )}
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
        <aside className="sidebar" style={{ width: 300, overflowY: 'auto' }}>
          {/* Lệnh khẩn cấp từ cán bộ/admin */}
          {visibleBroadcasts.length > 0 && (
            <div style={{ padding: '12px 12px 2px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertTriangle size={12} /> Lệnh cảnh báo khẩn cấp
              </div>
              {visibleBroadcasts.map(b => (
                <AlertBanner key={b.broadcastId} broadcast={b} onDismiss={() => dismissBroadcast(b.broadcastId)} />
              ))}
            </div>
          )}
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
          {loadError && <div role="alert" style={{ padding: 16, fontSize: 12, color: '#B91C1C' }}>{loadError}</div>}
          {events.length === 0 && !loadError && (
            <div style={{ padding: 16, fontSize: 12, color: '#64748b' }}>
              Hiện chưa có cảnh báo nào đã được xác nhận tại khu vực bạn đăng ký.
            </div>
          )}
        </aside>

        {eventsReady ? (
          <DetailPanel
            selectedEvent={selectedEvent}
            events={events}
            onSelectEvent={setSelectedEventId}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E8F2EF', color: '#087B70', fontSize: 14, gap: 10 }}>
            <span className="live-dot" style={{ width: 10, height: 10 }} />
            Đang tải bản đồ…
          </div>
        )}
      </div>
    </div>
  );
}
