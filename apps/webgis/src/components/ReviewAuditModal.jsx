import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  X, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  RefreshCw,
  Download,
  FileText,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import forecastApi from '../api/forecastApi';
import { fmtVN } from '../utils/time';
import { exportReport, AUDIT_COLUMNS } from '../utils/reportExport';
import { reviewSummaryRows } from '../utils/reviewKpi';

export default function ReviewAuditModal({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDecision, setFilterDecision] = useState('ALL'); // ALL | approved | rejected
  const [days, setDays] = useState(7); // Story 4.34: cửa sổ số liệu tổng hợp
  const [metrics, setMetrics] = useState(null);
  const [metricsError, setMetricsError] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await forecastApi.getReviewAuditLog(100);
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Không thể tải nhật ký thẩm định');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setMetricsError(false);
    forecastApi.getReviewMetrics(days).then(setMetrics).catch(() => { setMetrics(null); setMetricsError(true); });
  }, [isOpen, days]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter(item => {
    const term = searchTerm.toLowerCase();
    const matchTerm = 
      (item.unitId && item.unitId.toLowerCase().includes(term)) ||
      (item.reviewerName && item.reviewerName.toLowerCase().includes(term)) ||
      (item.reviewerEmail && item.reviewerEmail.toLowerCase().includes(term)) ||
      (item.reasonNotes && item.reasonNotes.toLowerCase().includes(term)) ||
      (item.runId && item.runId.toLowerCase().includes(term));

    const matchFilter = 
      filterDecision === 'ALL' || item.decision === filterDecision;

    return matchTerm && matchFilter;
  });

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 8, 16, 0.88)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20
    }}>
      <div style={{
        maxWidth: 960,
        width: '100%',
        background: 'rgba(13, 19, 34, 0.98)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: 16,
        boxShadow: '0 25px 70px rgba(0, 0, 0, 0.85)',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: 8, borderRadius: 8, display: 'flex' }}>
              <ShieldCheck size={20} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#fff' }}>
                NHẬT KÝ THẨM ĐỊNH DỰ BÁO
              </h3>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                Lưu vết kiểm toán toàn bộ quyết định phê duyệt / từ chối dự báo nguy cơ sạt lở (<code>core_schema.forecast_reviews</code>)
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              padding: 6,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Story 4.34: số liệu tổng hợp từ server, không tính lại ở trình duyệt */}
        <div aria-label="Tóm tắt hiệu quả thẩm định" style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: '#94a3b8', flex: 1 }}>Hiệu quả thẩm định</span>
            {[7, 30].map(d => (
              <button key={d} type="button" className="btn-ghost" aria-pressed={days === d} onClick={() => setDays(d)}
                style={{ padding: '3px 10px', fontSize: 11, borderColor: days === d ? '#38bdf8' : undefined }}>{d} ngày</button>
            ))}
          </div>
          {metricsError && <div role="alert" style={{ fontSize: 12, color: '#fbbf24' }}>Không tải được số liệu tổng hợp.</div>}
          {!metricsError && !metrics && <div style={{ fontSize: 12, color: '#94a3b8' }}>Đang tải…</div>}
          {metrics && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {reviewSummaryRows(metrics).map(r => (
                <div key={r.label} style={{ flex: '1 1 150px', padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{r.value}</div>
                  {r.sub && <div style={{ fontSize: 10.5, color: '#64748b' }}>{r.sub}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div style={{
          padding: '12px 24px',
          background: 'rgba(0, 0, 0, 0.25)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          gap: 12,
          alignItems: 'center'
        }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={15} color="#64748b" style={{ position: 'absolute', left: 12, top: 10 }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã ô đánh giá, tên cán bộ, lý do thẩm định..."
              style={{
                width: '100%',
                background: 'rgba(6, 9, 17, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: '8px 12px 8px 36px',
                color: '#fff',
                fontSize: 12,
                outline: 'none'
              }}
            />
          </div>

          {/* Filter Status */}
          <select
            value={filterDecision}
            onChange={(e) => setFilterDecision(e.target.value)}
            style={{
              background: 'rgba(6, 9, 17, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#cbd5e1',
              fontSize: 12,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">Tất Cả Quyết Định</option>
            <option value="approved">Đã Phê Duyệt</option>
            <option value="rejected">Đã Bác Bỏ / Từ Chối</option>
          </select>


          <button
            onClick={() => exportReport('nhat-ky-tham-dinh', AUDIT_COLUMNS, filteredLogs)}
            disabled={!filteredLogs.length}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#38bdf8',
              padding: '8px 12px',
              borderRadius: 8,
              cursor: filteredLogs.length ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12
            }}
            title="Xuất danh sách đang hiển thị ra tệp CSV"
          >
            <Download size={14} />
            <span>Xuất CSV</span>
          </button>

          <button
            onClick={fetchLogs}
            disabled={loading}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#38bdf8',
              padding: '8px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Làm Mới</span>
          </button>
        </div>

        {/* Content list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
              padding: 12,
              color: '#f87171',
              fontSize: 12,
              marginBottom: 16
            }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: 13 }}>
              <RefreshCw size={18} className="spin" style={{ display: 'inline', marginRight: 8 }} />
              Đang tải lịch sử thẩm định từ máy chủ...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 50, color: '#64748b', fontSize: 13 }}>
              Không có dữ liệu thẩm định nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredLogs.map((item) => {
                const isApproved = item.decision === 'approved';
                const hazard = (item.hazardLevel || 'high').toUpperCase();
                const hazardColor = hazard === 'EXTREME' ? '#f87171' : hazard === 'HIGH' ? '#fb923c' : '#38bdf8';

                return (
                  <div
                    key={item.reviewId || item.runId}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: 10,
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: isApproved ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isApproved ? '#4ade80' : '#f87171',
                          border: `1px solid ${isApproved ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                          {isApproved ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                          {isApproved ? 'ĐÃ PHÊ DUYỆT' : 'ĐÃ BÁC BỎ'}
                        </span>

                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          color: hazardColor,
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: `1px solid ${hazardColor}40`
                        }}>
                          {hazard}
                        </span>

                        <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                          Ô: <code style={{ color: '#38bdf8' }}>{item.unitId || 'N/A'}</code>
                        </span>
                      </div>

                      <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Clock size={12} />
                        <span>{fmtVN(item.reviewedAt)}</span>
                      </div>
                    </div>

                    {/* Reviewer info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#cbd5e1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <User size={13} color="#38bdf8" />
                        <span style={{ fontWeight: 600 }}>{item.reviewerName || 'Cán bộ'}</span>
                        {item.reviewerEmail && <span style={{ color: '#64748b', fontSize: 11 }}>({item.reviewerEmail})</span>}
                      </div>
                      {item.reviewerRole && (
                        <span style={{
                          background: 'rgba(56, 189, 248, 0.1)',
                          color: '#38bdf8',
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}>
                          {item.reviewerRole}
                        </span>
                      )}
                    </div>

                    {/* Reason notes */}
                    {item.reasonNotes && (
                      <div style={{
                        background: 'rgba(6, 9, 17, 0.85)',
                        borderLeft: `3px solid ${isApproved ? '#22c55e' : '#ef4444'}`,
                        borderRadius: 6,
                        padding: '8px 12px',
                        fontSize: 12,
                        color: '#e2e8f0',
                        marginTop: 2
                      }}>
                        <strong style={{ color: '#94a3b8', fontSize: 11 }}>Ghi chú thẩm định: </strong>
                        {item.reasonNotes}
                      </div>
                    )}

                    <div style={{ fontSize: 10, color: '#475569', display: 'flex', gap: 10, marginTop: 2 }}>
                      <span>Mã chạy: {item.runId}</span>
                      <span>Mã kiểm toán: #{item.reviewId}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
