import React from 'react';
import { AlertTriangle, BellRing, X } from 'lucide-react';
import { fmtVN } from '../utils/time';

// Gợi ý sau khi duyệt dự báo nguy cơ cao: chỉ mở form phát cảnh báo, KHÔNG tự động gửi.
export default function EmergencyAlertPrompt({ event, isAdmin, onClose, onOpenBroadcast }) {
  if (!event) return null;

  return (
    <div className="alert-prompt-wrapper">
      <div className="alert-icon-wrap">
        <AlertTriangle size={24} color="var(--risk-extreme)" />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--risk-extreme)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Đã phê duyệt — Nguy cơ {event.risk?.toUpperCase()}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{event.location}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
          {isAdmin
            ? `Dự báo hiệu lực đến ${fmtVN(event.validUntil)}. Mở form để soạn và xác nhận phát cảnh báo cho người dân đã đăng ký khu vực.`
            : 'Đã duyệt. Chỉ Admin được phát cảnh báo cho người dân — hãy báo Ban Chỉ huy PCTT.'}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isAdmin && (
          <button className="btn-danger" onClick={() => { onClose(); onOpenBroadcast(event); }}>
            <BellRing size={14} /> Soạn cảnh báo
          </button>
        )}
        <button className="btn-ghost" style={{ padding: '7px 8px' }} onClick={onClose} title="Đóng">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
