import React, { useState, useEffect, useRef } from 'react';
import { Layers, Users, ScrollText, Activity, ChevronDown, Settings2 } from 'lucide-react';

// Story 4.31: the admin's four tools in one drop-down so the top bar fits a laptop screen.
export default function AdminMenu({ onOpenAoi, onOpenUsers, onOpenAdminAudit, onOpenHealth }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const items = [
    { icon: Layers, label: 'Vùng giám sát', hint: 'Ranh giới các vùng theo dõi sạt lở', run: onOpenAoi },
    { icon: Users, label: 'Quản trị người dùng', hint: 'Phân quyền, khóa tài khoản, duyệt cán bộ', run: onOpenUsers },
    { icon: ScrollText, label: 'Nhật ký quản trị', hint: 'Ai đã khóa, đổi quyền, phát hoặc thu hồi cảnh báo', run: onOpenAdminAudit },
    { icon: Activity, label: 'Tình trạng hệ thống', hint: 'Dịch vụ đang chạy và độ tươi của dữ liệu', run: onOpenHealth }
  ];

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button type="button" className="btn-ghost" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((v) => !v)} title="Công cụ quản trị">
        <Settings2 size={14} />
        <span className="btn-label">Quản trị</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 280, zIndex: 40, padding: 6,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.45)'
        }}>
          {items.map(({ icon: Icon, label, hint, run }) => (
            <button key={label} type="button" role="menuitem" className="btn-ghost" onClick={() => { setOpen(false); run?.(); }}
              style={{ width: '100%', border: 'none', textAlign: 'left', gap: 10, padding: '9px 10px', alignItems: 'flex-start', whiteSpace: 'normal' }}>
              <Icon size={15} style={{ marginTop: 2, flex: '0 0 auto' }} aria-hidden="true" />
              <span>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)' }}>{label}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-2)' }}>{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
