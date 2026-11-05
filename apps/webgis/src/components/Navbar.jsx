import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, LogOut, Activity, BellRing, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({
  soundEnabled,
  setSoundEnabled,
  onOpenBroadcast,
  onOpenHistory,
}) {
  const { user, role, logout } = useAuth();
  const isAdmin = role === 'admin';

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

      </div>

      {/* Right controls */}
      <div className="nav-right">
        <Link to="/model-demo" className="btn-ghost nav-model-demo-link">Demo mô hình</Link>
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
          <span className="btn-label">Lịch sử lệnh</span>
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
          <span className="btn-label">Phát cảnh báo</span>
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
