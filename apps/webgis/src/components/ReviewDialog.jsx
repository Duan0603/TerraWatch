import React, { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

// Hộp thoại thẩm định: lý do bắt buộc khi từ chối, tùy chọn khi phê duyệt. Lỗi từ server hiện ngay trong hộp.
export default function ReviewDialog({ target, onCancel, onSubmit }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (!target) return null;

  const approve = target.decision === 'approved';
  const needReason = !approve && !reason.trim();

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(23,37,36,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 22, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: approve ? '#15803D' : '#B91C1C' }}>
          {approve ? <CheckCircle size={18} /> : <XCircle size={18} />}
          {approve ? 'Phê duyệt đề xuất cảnh báo' : 'Từ chối đề xuất cảnh báo'}
        </div>
        <div style={{ fontSize: 12, color: '#687977', margin: '6px 0 12px' }}>
          {target.event.location} — việc duyệt chỉ xác nhận đề xuất cảnh báo hợp lệ, không khẳng định sạt lở đã xảy ra.
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder={approve ? 'Ghi chú (không bắt buộc)' : 'Lý do từ chối (bắt buộc)'}
          style={{ width: '100%', border: '1px solid #DCE5E2', borderRadius: 8, padding: 10, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
        />
        {error && <div style={{ color: '#B91C1C', fontSize: 12, marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>Hủy</button>
          <button className={approve ? 'btn-approve' : 'btn-reject'} onClick={submit} disabled={busy || needReason}>
            {busy ? 'Đang gửi...' : approve ? 'Xác nhận phê duyệt' : 'Xác nhận từ chối'}
          </button>
        </div>
      </div>
    </div>
  );
}
