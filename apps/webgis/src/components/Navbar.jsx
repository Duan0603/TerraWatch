import React from 'react';
import { ShieldCheck, Bell, LogOut, FileText, Activity, BellRing, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS_OFFICER = [
  { label: 'Giám sát nguy cơ', key: 'monitor' },
  { label: 'Cảnh báo', key: 'alerts', badge: 1 },
  { label: 'Người nhận', key: 'recipients' },
];

const NAV_ITEMS_ADMIN = [
  { label: 'Phê duyệt', key: 'review', badge: 3 },
  { label: 'Lịch sử cảnh báo', key: 'history' },
  { label: 'Quản lý người nhận', key: 'recipients' },
  { label: 'Báo cáo', key: 'reports' },
];

export default function Navbar({
  activeNav,
  onNavChange,
  soundEnabled,
  setSoundEnabled,
  onOpenBroadcast,
  onOpenHistory,
}) {
  const { user, role, logout } = useAuth();
  const isAdmin = role === 'admin';

  const navItems = isAdmin ? NAV_ITEMS_ADMIN : NAV_ITEMS_OFFICER;
  const initials = user?.fullName
    ? user.fullName.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase()
    : (isAdmin ? 'TL' : 'NA');
  const roleName = isAdmin ? 'Lãnh đạo phê duyệt' : 'Cán bộ giám sát';

  return (
    <header className="top-nav">
      {/* Brand */}
      <div className="nav-left">
        <div className="nav-brand">
          <div className="nav-brand-icon">
            <ShieldCheck size={20} color="#fff" />
          </div>
          <div className="nav-brand-text">
            <span className="nav-brand-name">TerraWatch</span>
            <span className="nav-brand-sub">GeoSentry Platform</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="nav-links">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`nav-link ${activeNav === item.key ? 'active' : ''}`}
              onClick={() => onNavChange?.(item.key)}
            >
              {item.label}
              {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
            </button>
          ))}
        </nav>
      </div>

      {/* Right controls */}
      <div className="nav-right">
        <div className="status-chip">
          <span className="live-dot" />
          Hệ thống trực tuyến
        </div>

        {/* Sound toggle */}
        <button
          className="btn-ghost"
          onClick={() => setSoundEnabled?.(!soundEnabled)}
          title={soundEnabled ? 'Tắt âm báo' : 'Bật âm báo'}
          style={{ padding: '6px 10px' }}
        >
          <Activity size={14} color={soundEnabled ? '#22C55E' : undefined} />
        </button>

        {/* Lịch sử phát lệnh */}
        <button
          className="btn-ghost"
          onClick={onOpenHistory}
          title="Xem nhật ký phát lệnh cảnh báo SMS / FCM"
        >
          <History size={14} />
          Lịch sử lệnh
        </button>

        {/* Phát cảnh báo — Admin only */}
        <button
          className="btn-danger"
          onClick={() => {
            if (isAdmin) {
              onOpenBroadcast?.();
            } else {
              alert('Chỉ tài khoản Admin mới có quyền phát lệnh cảnh báo khẩn cấp.');
            }
          }}
          style={{ opacity: isAdmin ? 1 : 0.5, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
          title={isAdmin ? 'Phát cảnh báo (SMS / App Push)' : 'Cần quyền Admin'}
        >
          <BellRing size={14} />
          Phát cảnh báo
        </button>

        {/* Xuất báo cáo */}
        <button
          className="btn-ghost"
          onClick={() => alert('Đang xuất Báo cáo Thẩm định (PDF/GeoJSON)...')}
          title="Xuất báo cáo"
        >
          <FileText size={14} />
          Xuất báo cáo
        </button>

        {/* Notification bell */}
        <button className="btn-ghost" style={{ padding: '6px 8px', position: 'relative' }} title="Thông báo">
          <Bell size={16} />
          <span style={{
            position: 'absolute', top: 4, right: 4,
            width: 7, height: 7, background: '#EF4444',
            borderRadius: '50%', border: '1.5px solid #fff'
          }} />
        </button>

        {/* User info */}
        <div className="nav-user">
          <div className="nav-avatar">{initials}</div>
          <div className="nav-user-info">
            <div className="nav-user-name">{user?.fullName || 'Cán bộ'}</div>
            <div className="nav-user-role">{roleName}</div>
          </div>
        </div>

        {/* Logout */}
        <button className="btn-ghost" onClick={logout} title="Đăng xuất">
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}
