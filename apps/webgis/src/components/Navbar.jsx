import React from 'react';
import { 
  ShieldAlert, 
  Satellite, 
  Volume2, 
  VolumeX, 
  FileText, 
  LogOut, 
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ soundEnabled, setSoundEnabled }) {
  const { user, role, logout } = useAuth();

  return (
    <header className="top-nav">
      <div className="nav-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#0284c7', padding: '6px', borderRadius: '8px', display: 'flex' }}>
            <ShieldAlert size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.04em', color: '#fff' }}>
              TERRAWATCH <span style={{ color: '#38bdf8', fontWeight: 500 }}>GEOSENTRY</span>
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>
              Hệ Thống Viễn Thám & AI Cảnh Báo Sớm Sạt Lở Đất
            </div>
          </div>
        </div>

        <div className="national-badge">
          <span className="live-pulse"></span>
          Trực Giám Sát 24/7: Sẵn sàng
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#38bdf8' }}>
          <Satellite size={15} />
          <span>Sentinel-2A/B (10m) + DEM 30m</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Toggle còi báo động */}
        <button 
          onClick={() => setSoundEnabled(!soundEnabled)}
          style={{ 
            background: 'rgba(255,255,255,0.06)', 
            border: '1px solid rgba(255,255,255,0.1)', 
            color: '#fff', 
            padding: '6px 12px', 
            borderRadius: 6, 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6, 
            fontSize: 12 
          }}
          title="Bật/tắt còi cảnh báo khi có nguy cơ mới"
        >
          {soundEnabled ? <Volume2 size={15} color="#22c55e" /> : <VolumeX size={15} color="#94a3b8" />}
          {soundEnabled ? 'Còi: Bật' : 'Còi: Tắt'}
        </button>

        {/* Nút xuất báo cáo */}
        <button 
          onClick={() => alert('Đang xuất Báo cáo Thẩm định Địa không gian (PDF/GeoJSON) chuẩn Bộ TN&MT...')}
          style={{ 
            background: '#0284c7', 
            border: 'none', 
            color: '#fff', 
            padding: '6px 14px', 
            borderRadius: 6, 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6, 
            fontSize: 12, 
            fontWeight: 600 
          }}
        >
          <FileText size={15} />
          Xuất Báo Cáo
        </button>

        {/* Thông tin Cán bộ đăng nhập & Role */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255,255,255,0.05)',
          padding: '4px 10px',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.1)',
          fontSize: 12
        }}>
          {role === 'admin' ? (
            <ShieldCheck size={16} color="#ef4444" />
          ) : (
            <UserCheck size={16} color="#38bdf8" />
          )}
          <div>
            <div style={{ fontWeight: 600, color: '#f8fafc', lineHeight: 1.2 }}>
              {user?.fullName || 'Cán Bộ Thẩm Định'}
            </div>
            <div style={{ fontSize: 10, color: role === 'admin' ? '#f87171' : '#38bdf8', textTransform: 'uppercase' }}>
              Vai trò: {role}
            </div>
          </div>
        </div>

        {/* Nút Đăng xuất */}
        <button
          onClick={logout}
          style={{
            background: 'transparent',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            padding: '6px 10px',
            borderRadius: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12
          }}
          title="Đăng xuất khỏi hệ thống"
        >
          <LogOut size={14} />
          Thoát
        </button>
      </div>
    </header>
  );
}
