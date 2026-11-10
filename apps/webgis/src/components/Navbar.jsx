import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, LogOut, BellRing, History, Volume2, VolumeX, FileCheck2, Radio, Download, Cpu, Wrench } from 'lucide-react';
import AdminMenu from './AdminMenu';
import NavMenu from './NavMenu';
import { useAuth } from '../context/AuthContext';
import { fmtVN } from '../utils/time';
import { playAlertBeep } from '../utils/sound';

// Chip trạng thái: phản ánh chính xác kết nối và lần tải dữ liệu thật
function connectionStatus({ loadError, lastLoadedAt, liveConnected }) {
  if (loadError) {
    return { statusText: 'Mất kết nối API', chipClass: 'status-chip status-chip--error', dotClass: 'live-dot live-dot--error' };
  }
  if (lastLoadedAt) {
    const timeStr = lastLoadedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return {
      statusText: liveConnected ? `Trực tiếp (${timeStr})` : `Hệ thống trực tuyến (${timeStr})`,
      chipClass: 'status-chip',
      dotClass: 'live-dot'
    };
  }
  return { statusText: 'Đang kết nối...', chipClass: 'status-chip status-chip--warning', dotClass: 'live-dot live-dot--warning' };
}

export default function Navbar({
  soundEnabled,
  setSoundEnabled,
  onOpenBroadcast,
  onOpenHistory,
  onOpenAuditLog,
  onOpenFieldReports,
  onOpenAoi,
  onOpenUsers,
  onOpenAdminAudit,
  onOpenHealth,
  onOpenModelCard,
  onExportReport,
  lastLoadedAt,      // Date | null – thời điểm loadEvents() thành công gần nhất
  loadError,          // string | null – lỗi kết nối API
  liveConnected,      // boolean – luồng cập nhật tức thì (SSE) đang mở (Story 4.35)
}) {
  const { user, role, logout } = useAuth();
  const isAdmin = role === 'admin';

  const initials = user?.fullName
    ? user.fullName.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase()
    : (isAdmin ? 'TL' : 'NA');
  const roleName = isAdmin ? 'Lãnh đạo phê duyệt' : 'Cán bộ giám sát';

  const { statusText, chipClass, dotClass } = connectionStatus({ loadError, lastLoadedAt, liveConnected });

  // Story 4.37: công cụ chung của cán bộ và admin gom vào menu "Công cụ" (giữ nhãn chữ trên màn 1440 px)
  const tools = [
    { icon: Download, label: 'Xuất báo cáo', hint: 'Hàng đợi dự báo hiện tại ra tệp CSV (mở được bằng Excel)', run: onExportReport },
    { icon: History, label: 'Lịch sử lệnh', hint: 'Nhật ký phát lệnh cảnh báo SMS / FCM', run: onOpenHistory },
    { icon: FileCheck2, label: 'Nhật ký thẩm định', hint: 'Ai duyệt dự báo, lý do', run: onOpenAuditLog },
    { icon: Radio, label: 'Báo cáo hiện trường', hint: 'Báo cáo và hình ảnh từ người dân', run: onOpenFieldReports },
    { icon: Cpu, label: 'Thẻ mô hình', hint: 'Mô hình AI là gì, đã kiểm tra thế nào, giới hạn ra sao', run: onOpenModelCard }
  ];

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
          title={loadError || (lastLoadedAt ? `Lần tải cuối: ${fmtVN(lastLoadedAt.toISOString())}${liveConnected ? ' · nhận cập nhật tức thì từ máy chủ' : ' · cập nhật mỗi phút'}` : 'Đang đồng bộ')}
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

        <NavMenu label="Công cụ" title="Xuất báo cáo, nhật ký, báo cáo hiện trường, thẻ mô hình" icon={Wrench} items={tools} />

        {/* Bốn công cụ quản trị gom vào một menu — Admin only (Story 4.31) */}
        {isAdmin && (
          <AdminMenu onOpenAoi={onOpenAoi} onOpenUsers={onOpenUsers} onOpenAdminAudit={onOpenAdminAudit} onOpenHealth={onOpenHealth} />
        )}

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
          aria-label="Phát cảnh báo" title={isAdmin ? 'Phát cảnh báo (SMS / App Push)' : 'Cần quyền Admin'}
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
