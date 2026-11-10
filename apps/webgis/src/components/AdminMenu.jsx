import React from 'react';
import { Layers, Users, ScrollText, Activity, Settings2 } from 'lucide-react';
import NavMenu from './NavMenu';

// Story 4.31: the admin's four tools in one drop-down so the top bar fits a laptop screen.
export default function AdminMenu({ onOpenAoi, onOpenUsers, onOpenAdminAudit, onOpenHealth }) {
  const items = [
    { icon: Layers, label: 'Vùng giám sát', hint: 'Ranh giới các vùng theo dõi sạt lở', run: onOpenAoi },
    { icon: Users, label: 'Quản trị người dùng', hint: 'Phân quyền, khóa tài khoản, duyệt cán bộ', run: onOpenUsers },
    { icon: ScrollText, label: 'Nhật ký quản trị', hint: 'Ai đã khóa, đổi quyền, phát hoặc thu hồi cảnh báo', run: onOpenAdminAudit },
    { icon: Activity, label: 'Tình trạng hệ thống', hint: 'Dịch vụ đang chạy và độ tươi của dữ liệu', run: onOpenHealth }
  ];
  return <NavMenu label="Quản trị" title="Công cụ quản trị" icon={Settings2} items={items} />;
}
