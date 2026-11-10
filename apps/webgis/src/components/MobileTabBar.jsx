import React from 'react';
import { List, Map } from 'lucide-react';

const TABS = [
  { id: 'list', label: 'Danh sách', Icon: List },
  { id: 'map', label: 'Bản đồ', Icon: Map }
];

export default function MobileTabBar({ active, onChange }) {
  return (
    <nav className="mobile-tab-bar" role="tablist" aria-label="Điều hướng giao diện di động">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={active === id}
          className={`mobile-tab-btn${active === id ? ' active' : ''}`}
          onClick={() => onChange(id)}
        >
          <Icon size={20} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
