import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, LogOut, BellRing, History, Volume2, VolumeX, FileCheck2, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fmtVN } from '../utils/time';
import { playAlertBeep } from '../utils/sound';

export default function Navbar({
  soundEnabled,
  setSoundEnabled,
  onOpenBroadcast,
  onOpenHistory,
  onOpenAuditLog,
  onOpenFieldReports,
  lastLoadedAt,       // Date | null – thời điểm loadEvents() thành công gần nhất
  loadError,          // string | null – lỗi kết nối API
}) {
  const { user, role, logout } = useAuth();
  const isAdmin = role === 'admin';

  const initials = user?.fullName
    ? user.fullName.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase()
    : (isAdmin ? 'TL' : 'NA');
  const roleName = isAdmin ? 'Lãnh đạo phê duyệt' : 'Cán bộ giám sát';

  // Chip trạng thái: phản ánh chính xác kết nối và lần tải dữ liệu thật
  let statusText = 'Đang kết nối...';
  let chipClass = 'status-chip status-chip--warning';
  let dotClass = 'live-dot live-dot--warning';
  if (loadError) {
    statusText = 'Mất kết nối API';
    chipClass = 'status-chip status-chip--error';
    dotClass = 'live-dot live-dot--error';
  } else if (lastLoadedAt) {
    const timeStr = lastLoadedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    statusText = `Hệ thống trực tuyến (${timeStr})`;
    chipClass = 'status-chip';
    dotClass = 'live-dot';
  }

  const handleSoundToggle = () => {
    const next = !soundEnabled;
    setSoundEnabled?.(next);
    if (next) {
      playAlertBeep(); // phát tiếng bíp thật ngay lập tức để người dùng kiểm tra âm thanh
    }
  };

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
        <div
          className={chipClass}
          title={loadError || (lastLoadedAt ? `Lần tải cuối: ${fmtVN(lastLoadedAt.toISOString())}` : 'Đang đồng bộ')}
          style={{ cursor: 'default' }}
        >
          <span className={dotClass} />
          {statusText}
        </div>

        {/* Nút bật/tắt âm báo thật */}
        <button
          className="btn-ghost"
          onClick={handleSoundToggle}
          title={soundEnabled ? 'Tắt âm báo' : 'Bật âm báo (phát tiếng bíp thật)'}
          style={{ padding: '6px 10px', color: soundEnabled ? '#22C55E' : undefined }}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
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

        {/* Nhật ký thẩm định dự báo */}
        <button
          className="btn-ghost"
          onClick={onOpenAuditLog}
          title="Xem nhật ký kiểm toán thẩm định dự báo (ai duyệt, lý do)"
        >
          <FileCheck2 size={14} />
          <span className="btn-label">Nhật ký thẩm định</span>
        </button>

        {/* Báo cáo hiện trường từ cộng đồng */}
        <button
          className="btn-ghost"
          onClick={onOpenFieldReports}
          title="Xem danh sách báo cáo hiện trường & hình ảnh từ người dân"
        >
          <Radio size={14} />
          <span className="btn-label">Báo cáo hiện trường</span>
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
