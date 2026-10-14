import React from 'react';
import { AlertOctagon, BellRing, X, Radio, CheckCircle } from 'lucide-react';

export default function EmergencyAlertPrompt({ event, isAdmin, onClose, onOpenBroadcast }) {
  if (!event) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      background: 'rgba(15, 23, 42, 0.96)',
      border: '1px solid #ef4444',
      borderRadius: 12,
      padding: '16px 20px',
      boxShadow: '0 12px 40px rgba(239, 68, 68, 0.35)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      maxWidth: 620,
      width: '90%'
    }}>
      <div style={{
        background: 'rgba(239, 68, 68, 0.2)',
        padding: 10,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <AlertOctagon size={28} color="#ef4444" />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f87171', textTransform: 'uppercase' }}>
            🚨 Đã Phê Duyệt Nguy Cơ {event.risk.toUpperCase()}!
          </span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            ({event.location})
          </span>
        </div>
        <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
          {isAdmin 
            ? `Ước tính có khoảng ~${event.estPopulation} người dân trong vùng bán kính nguy hiểm. Đ/c Admin có muốn mở mẫu Phát Cảnh Báo Khẩn Cấp (SMS / App Push) ngay lập tức?`
            : `Đã cập nhật sự cố lên bản đồ cảnh báo số. Thông tin đã được chuyển tiếp tới Ban Chỉ huy Phòng chống Thiên tai.`
          }
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isAdmin && (
          <button
            onClick={() => {
              onClose();
              if (onOpenBroadcast) onOpenBroadcast(event);
              else alert(`[Story 4.4 Admin Broadcast] Đang chuẩn bị mẫu phát lệnh khẩn cấp cho vùng: ${event.location}`);
            }}
            style={{
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <BellRing size={14} /> Phát Cảnh Báo
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: '#94a3b8',
            border: 'none',
            padding: '8px',
            borderRadius: 6,
            cursor: 'pointer',
            display: 'flex'
          }}
          title="Đóng thông báo"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
