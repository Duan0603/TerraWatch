import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollText, RefreshCw, X, Download, AlertCircle } from 'lucide-react';
import adminApi from '../api/adminApi';
import { ACTION_LABELS, actionLabel, describeEntry, ADMIN_AUDIT_COLUMNS } from '../utils/adminAudit';
import { exportReport } from '../utils/reportExport';
import { fmtVN } from '../utils/time';

const cell = { padding: '8px 10px', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', verticalAlign: 'top' };
const head = { ...cell, fontSize: 11, color: '#94a3b8', textAlign: 'left', position: 'sticky', top: 0, background: '#0B1528' };

// Story 4.27: admin-only log of who locked, promoted, approved, broadcast or revoked what.
export default function AdminAuditModal({ isOpen, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getAudit(300);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không tải được nhật ký quản trị');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const shown = useMemo(() => (filter === 'ALL' ? rows : rows.filter((r) => r.action === filter)), [rows, filter]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 12, 26, 0.82)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16
    }}>
      <div role="dialog" aria-modal="true" aria-label="Nhật ký quản trị" onClick={(e) => e.stopPropagation()} style={{
        backgroundColor: '#0B1528', border: '1px solid #1E293B', borderRadius: 12, width: '100%', maxWidth: 900,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', color: '#F1F5F9', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.65)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid #1E293B', flexWrap: 'wrap' }}>
          <ScrollText size={18} aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 700 }}>Nhật ký thao tác quản trị</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Ai khóa, đổi quyền, duyệt cán bộ, phát và thu hồi cảnh báo. {shown.length} dòng.</div>
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Lọc theo thao tác" style={{
            background: 'rgba(6, 9, 17, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#cbd5e1', fontSize: 12
          }}>
            <option value="ALL">Mọi thao tác</option>
            {Object.keys(ACTION_LABELS).map((k) => <option key={k} value={k}>{ACTION_LABELS[k]}</option>)}
          </select>
          <button type="button" className="btn-ghost" disabled={!shown.length}
            onClick={() => exportReport('nhat-ky-quan-tri', ADMIN_AUDIT_COLUMNS(fmtVN), shown)} title="Xuất các dòng đang hiển thị ra tệp CSV">
            <Download size={14} /> <span className="btn-label">Xuất CSV</span>
          </button>
          <button type="button" className="btn-ghost" onClick={load} disabled={loading} title="Tải lại">
            <RefreshCw size={14} style={{ opacity: loading ? 0.5 : 1 }} /> <span className="btn-label">Làm mới</span>
          </button>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Đóng"><X size={16} /></button>
        </div>

        <div style={{ overflow: 'auto', padding: '0 20px 16px' }}>
          {error && <div role="alert" style={{ display: 'flex', gap: 8, padding: 12, color: '#fca5a5' }}><AlertCircle size={16} /> {error}</div>}
          {!error && !loading && !shown.length && (
            <p style={{ padding: 20, color: '#94a3b8', fontSize: 13 }}>Chưa có thao tác nào được ghi lại.</p>
          )}
          {shown.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={head}>Thời điểm</th><th style={head}>Người thao tác</th><th style={head}>Thao tác</th>
                  <th style={head}>Đối tượng</th><th style={head}>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>{fmtVN(r.at)}</td>
                    <td style={cell}>{r.actor || '—'}</td>
                    <td style={cell}>{actionLabel(r.action)}</td>
                    <td style={cell}>{r.targetLabel || r.targetId || '—'}</td>
                    <td style={{ ...cell, color: '#94a3b8' }}>{describeEntry(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
