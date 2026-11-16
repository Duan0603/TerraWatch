import React from 'react';

// Trạng thái trống của các bảng nhật ký: nói rõ vì sao trống và khi nào sẽ có dữ liệu.
export default function EmptyState({ icon: Icon, title, hint, tone = '#38bdf8', children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, padding: '40px 24px' }}>
      {Icon && (
        <div aria-hidden="true" style={{
          width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${tone}1f`, border: `1px solid ${tone}55`
        }}>
          <Icon size={24} color={tone} />
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{title}</div>
      {hint && <div style={{ fontSize: 12, lineHeight: 1.6, color: '#94a3b8', maxWidth: 380 }}>{hint}</div>}
      {children}
    </div>
  );
}
