import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

// Story 4.37: one drop-down for a group of top-bar tools (used for "Công cụ" and "Quản trị").
// items: [{ icon, label, hint?, run }]. The button keeps aria-label = label so it has a name when the text is hidden on small screens.
export default function NavMenu({ label, title, icon: ButtonIcon, items }) {
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

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button type="button" className="btn-ghost" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((v) => !v)} aria-label={label} title={title}>
        <ButtonIcon size={14} />
        <span className="btn-label">{label}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 280, zIndex: 40, padding: 6,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.45)'
        }}>
          {items.map(({ icon: Icon, label: itemLabel, hint, run }) => (
            <button key={itemLabel} type="button" role="menuitem" className="btn-ghost" onClick={() => { setOpen(false); run?.(); }}
              style={{ width: '100%', border: 'none', textAlign: 'left', gap: 10, padding: '9px 10px', alignItems: 'flex-start', whiteSpace: 'normal' }}>
              <Icon size={15} style={{ marginTop: 2, flex: '0 0 auto' }} aria-hidden="true" />
              <span>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)' }}>{itemLabel}</span>
                {hint && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-2)' }}>{hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
