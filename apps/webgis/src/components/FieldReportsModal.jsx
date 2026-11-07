import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  MapPin, 
  Clock, 
  User, 
  Phone, 
  Image as ImageIcon, 
  CheckCircle2, 
  Archive, 
  RefreshCw, 
  Search, 
  X, 
  ExternalLink, 
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import forecastApi from '../api/forecastApi';
import { fmtVN } from '../utils/time';

const STATUS_CONFIG = {
  submitted: { label: 'Chờ xử lý', color: '#facc15', bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)' },
  processed: { label: 'Đã xử lý', color: '#4ade80', bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.3)' },
  archived: { label: 'Đã lưu trữ', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)' },
};

export default function FieldReportsModal({ isOpen, onClose, onSelectLocation }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [previewImage, setPreviewImage] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await forecastApi.getFieldReports();
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách báo cáo hiện trường');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReports();
    }
  }, [isOpen]);

  const handleUpdateStatus = async (reportId, newStatus) => {
    try {
      setUpdatingId(reportId);
      await forecastApi.updateFieldReportStatus(reportId, newStatus);
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r));
    } catch (err) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isOpen) return null;

  const filteredReports = reports.filter(r => {
    const term = searchTerm.toLowerCase();
    const matchTerm = 
      (r.description && r.description.toLowerCase().includes(term)) ||
      (r.submitterName && r.submitterName.toLowerCase().includes(term)) ||
      (r.submitterPhone && r.submitterPhone.includes(term)) ||
      (r.id && String(r.id).includes(term));

    const matchFilter = filterStatus === 'ALL' || r.status === filterStatus;
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
        maxWidth: 980,
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
              <Radio size={20} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#fff' }}>
                BÁO CÁO HIỆN TRƯỜNG TỪ CỘNG ĐỒNG
              </h3>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                Tiếp nhận tin báo nguy cơ sạt lở từ ứng dụng di động công dân & điều phối xử lý hiện trường
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
              placeholder="Tìm theo nội dung, tên người gửi, số điện thoại..."
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

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
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
            <option value="ALL">Tất Cả Trạng Thái</option>
            <option value="submitted">Chờ Xử Lý (Mới gửi)</option>
            <option value="processed">Đã Xử Lý</option>
            <option value="archived">Đã Lưu Trữ</option>
          </select>

          <button
            onClick={fetchReports}
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

        {/* Content */}
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
              Đang tải danh sách báo cáo...
            </div>
          ) : filteredReports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 50, color: '#64748b', fontSize: 13 }}>
              Không có báo cáo hiện trường nào.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredReports.map((report) => {
                const statusInfo = STATUS_CONFIG[report.status] || STATUS_CONFIG.submitted;
                const isProcessed = report.status === 'processed';
                const isArchived = report.status === 'archived';

                return (
                  <div
                    key={report.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      borderRadius: 12,
                      padding: 16,
                      display: 'flex',
                      gap: 16,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Photo thumbnail */}
                    {report.imageUrl ? (
                      <div
                        onClick={() => setPreviewImage(report.imageUrl)}
                        style={{
                          width: 90,
                          height: 90,
                          borderRadius: 8,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          flexShrink: 0,
                          position: 'relative',
                          background: '#000'
                        }}
                        title="Bấm để phóng to ảnh"
                      >
                        <img
                          src={report.imageUrl}
                          alt="Hiện trường"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <div style={{
                          position: 'absolute',
                          bottom: 2,
                          right: 2,
                          background: 'rgba(0,0,0,0.6)',
                          borderRadius: 4,
                          padding: 2
                        }}>
                          <ImageIcon size={12} color="#38bdf8" />
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        width: 90,
                        height: 90,
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px dashed rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748b',
                        fontSize: 10,
                        flexShrink: 0,
                        gap: 4
                      }}>
                        <ImageIcon size={20} color="#475569" />
                        <span>Không có ảnh</span>
                      </div>
                    )}

                    {/* Main details */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              background: statusInfo.bg,
                              color: statusInfo.color,
                              border: `1px solid ${statusInfo.border}`
                            }}>
                              {statusInfo.label}
                            </span>
                            <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                              #{report.id}
                            </span>
                          </div>

                          <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={12} />
                            <span>{fmtVN(report.time)}</span>
                          </div>
                        </div>

                        {/* Description */}
                        <div style={{ fontSize: 13, color: '#f8fafc', lineHeight: 1.5, marginBottom: 8 }}>
                          {report.description || 'Không có mô tả chi tiết.'}
                        </div>

                        {/* Submitter & GPS Location */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 11, color: '#94a3b8' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <User size={12} color="#38bdf8" />
                            <span style={{ color: '#cbd5e1' }}>{report.submitterName || 'Công dân ẩn danh'}</span>
                          </div>

                          {report.submitterPhone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Phone size={12} color="#38bdf8" />
                              <span style={{ color: '#cbd5e1' }}>{report.submitterPhone}</span>
                            </div>
                          )}

                          {report.coords && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MapPin size={12} color="#f87171" />
                              <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>
                                {report.coords[1]?.toFixed(4)}°N, {report.coords[0]?.toFixed(4)}°E
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                        {report.coords && onSelectLocation && (
                          <button
                            onClick={() => {
                              onSelectLocation(report.coords);
                              onClose();
                            }}
                            style={{
                              background: 'rgba(56, 189, 248, 0.1)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              color: '#38bdf8',
                              padding: '4px 10px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <ExternalLink size={12} /> Xem Trên Bản Đồ
                          </button>
                        )}

                        {!isProcessed && (
                          <button
                            onClick={() => handleUpdateStatus(report.id, 'processed')}
                            disabled={updatingId === report.id}
                            style={{
                              background: '#16a34a',
                              border: 'none',
                              color: '#fff',
                              padding: '4px 12px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: updatingId === report.id ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <CheckCircle2 size={12} /> {updatingId === report.id ? 'Đang cập nhật...' : 'Chuyển Đã Xử Lý'}
                          </button>
                        )}

                        {!isArchived && (
                          <button
                            onClick={() => handleUpdateStatus(report.id, 'archived')}
                            disabled={updatingId === report.id}
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: '#cbd5e1',
                              padding: '4px 10px',
                              borderRadius: 6,
                              fontSize: 11,
                              cursor: updatingId === report.id ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Archive size={12} /> Lưu Trữ
                          </button>
                        )}

                        {isProcessed && (
                          <button
                            onClick={() => handleUpdateStatus(report.id, 'submitted')}
                            disabled={updatingId === report.id}
                            style={{
                              background: 'rgba(234, 179, 8, 0.15)',
                              border: '1px solid rgba(234, 179, 8, 0.3)',
                              color: '#facc15',
                              padding: '4px 10px',
                              borderRadius: 6,
                              fontSize: 11,
                              cursor: updatingId === report.id ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <RotateCcw size={12} /> Mở Lại
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lightbox Modal for Photo Preview */}
        {previewImage && (
          <div
            onClick={() => setPreviewImage(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.92)',
              zIndex: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20
            }}
          >
            <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
              <img
                src={previewImage}
                alt="Phóng to"
                style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8, objectFit: 'contain' }}
              />
              <button
                onClick={() => setPreviewImage(null)}
                style={{
                  position: 'absolute',
                  top: -40,
                  right: 0,
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                <X size={24} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
