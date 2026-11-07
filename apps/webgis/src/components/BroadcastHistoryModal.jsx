import React, { useState, useEffect } from 'react';
import { 
  History, 
  X, 
  Search, 
  CheckCircle, 
  Clock, 
  MessageSquare, 
  Smartphone, 
  Radio, 
  AlertTriangle,
  RefreshCw,
  Send,
  RotateCcw,
  Users,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import broadcastApi from '../api/broadcastApi';

export default function BroadcastHistoryModal({ isOpen, onClose, onOpenNewBroadcast }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [deliveries, setDeliveries] = useState([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await broadcastApi.getBroadcastHistory();
      setHistory(data);
      if (data.length > 0 && !selectedEntry) {
        setSelectedEntry(data[0]);
      }
    } catch (err) {
      setHistory([]);
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedEntry?.broadcastId) {
      fetchDeliveries(selectedEntry.broadcastId);
      setConfirmRevoke(false);
      setRevokeError(null);
    } else {
      setDeliveries([]);
    }
  }, [selectedEntry?.broadcastId]);

  const fetchDeliveries = async (broadcastId) => {
    try {
      setDeliveriesLoading(true);
      const data = await broadcastApi.getDeliveries(broadcastId);
      setDeliveries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Could not fetch deliveries:', err);
      setDeliveries([]);
    } finally {
      setDeliveriesLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!selectedEntry?.broadcastId) return;
    try {
      setRevoking(true);
      setRevokeError(null);
      await broadcastApi.revokeBroadcast(selectedEntry.broadcastId);
      setSelectedEntry(prev => prev ? { ...prev, status: 'ĐÃ THU HỒI' } : null);
      setHistory(prev => prev.map(item => item.id === selectedEntry.id ? { ...item, status: 'ĐÃ THU HỒI' } : item));
      setConfirmRevoke(false);
    } catch (err) {
      setRevokeError(err.message || 'Không thể thu hồi lệnh cảnh báo');
    } finally {
      setRevoking(false);
    }
  };

  if (!isOpen) return null;

  const filteredHistory = history.filter(item => {
    const term = searchTerm.toLowerCase();
    return (
      item.location?.toLowerCase().includes(term) ||
      item.message?.toLowerCase().includes(term) ||
      item.id?.toLowerCase().includes(term)
    );
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
        maxWidth: 880,
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
              <History size={20} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#fff' }}>
                NHẬT KÝ ĐIỀU PHỐI & PHÁT CẢNH BÁO KHẨN CẤP
              </h3>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                Lưu vết kiểm toán các đợt phát tin nhắn SMS & FCM thông báo di dời
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {onOpenNewBroadcast && (
              <button
                onClick={() => { onClose(); onOpenNewBroadcast(); }}
                style={{
                  background: '#dc2626',
                  border: 'none',
                  color: '#fff',
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Send size={13} /> Phát Lệnh Mới
              </button>
            )}
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
        </div>

        {/* Search Bar */}
        <div style={{
          padding: '12px 24px',
          background: 'rgba(0, 0, 0, 0.25)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          gap: 12,
          alignItems: 'center'
        }}>
          <div style={{
            position: 'relative',
            flex: 1
          }}>
            <Search size={15} color="#64748b" style={{ position: 'absolute', left: 12, top: 10 }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo khu vực, mã lệnh hoặc nội dung tin nhắn..."
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

          <button
            onClick={fetchHistory}
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
            title="Làm mới danh sách"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Làm Mới</span>
          </button>
        </div>

        {/* Content: Split 2 columns */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Cột trái: Danh sách các lệnh */}
          <div style={{ width: '45%', borderRight: '1px solid rgba(255, 255, 255, 0.08)', overflowY: 'auto', padding: 12 }}>
            {filteredHistory.length === 0 ? (
              <div role={loadError ? 'alert' : undefined} style={{ textAlign: 'center', padding: 30, color: loadError ? '#f87171' : '#64748b', fontSize: 12 }}>
                {loadError || (loading ? 'Đang tải lịch sử từ máy chủ…' : 'Không tìm thấy đợt phát lệnh nào.')}
              </div>
            ) : (
              filteredHistory.map((item) => {
                const isSelected = selectedEntry?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedEntry(item)}
                    style={{
                      background: isSelected ? 'rgba(2, 132, 199, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.06)'}`,
                      borderRadius: 10,
                      padding: '12px 14px',
                      marginBottom: 8,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: item.urgency === 'EXTREME' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                        color: item.urgency === 'EXTREME' ? '#f87171' : '#fb923c',
                        border: `1px solid ${item.urgency === 'EXTREME' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(249, 115, 22, 0.4)'}`
                      }}>
                        {item.urgency || 'HIGH'}
                      </span>
                      <span style={{ fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} /> {item.timestamp?.split(' ')[1] || item.timestamp}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
                      {item.location}
                    </div>

                    <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Mã: <code style={{ color: '#38bdf8' }}>{item.id}</code></span>
                      <span style={{ color: '#4ade80', fontWeight: 600 }}>
                        {item.deliveredCount}/{item.recipientsTotal} đã nhận
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Cột phải: Chi tiết lệnh đang chọn */}
          <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
            {selectedEntry ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#38bdf8', fontFamily: 'monospace' }}>
                      {selectedEntry.id}
                    </span>
                    <h4 style={{ fontSize: 16, fontWeight: 800, margin: '2px 0 0 0', color: '#fff' }}>
                      {selectedEntry.location}
                    </h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {(() => {
                      // Màu theo kết quả thật: chỉ "ĐÃ GỬI" mới là xanh
                      const isRevoked = selectedEntry.status === 'ĐÃ THU HỒI';
                      const ok = selectedEntry.status === 'ĐÃ GỬI';
                      const rgb = isRevoked ? '148, 163, 184' : ok ? '34, 197, 94' : selectedEntry.status === 'GỬI MỘT PHẦN' ? '251, 146, 60' : '239, 68, 68';
                      return (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: `rgba(${rgb}, 0.15)`,
                          color: `rgb(${rgb})`,
                          border: `1px solid rgba(${rgb}, 0.3)`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5
                        }}>
                          {isRevoked ? <RotateCcw size={13} /> : ok ? <CheckCircle size={13} /> : <AlertTriangle size={13} />} {selectedEntry.status}
                        </span>
                      );
                    })()}

                    {selectedEntry.status !== 'ĐÃ THU HỒI' && !confirmRevoke && (
                      <button
                        onClick={() => setConfirmRevoke(true)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#f87171',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all 0.2s'
                        }}
                        title="Thu hồi lệnh cảnh báo này đối với các thiết bị công dân"
                      >
                        <RotateCcw size={12} /> Thu Hồi Lệnh
                      </button>
                    )}
                  </div>
                </div>

                {confirmRevoke && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginBottom: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10
                  }}>
                    <div style={{ fontSize: 12, color: '#fca5a5' }}>
                      <strong>Xác nhận thu hồi?</strong> Thiết bị công dân sẽ hiển thị thông báo đã hủy bỏ ở lần kết nối tới.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleRevoke}
                        disabled={revoking}
                        style={{
                          background: '#dc2626',
                          border: 'none',
                          color: '#fff',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: revoking ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {revoking ? 'Đang thu hồi...' : 'Đồng Ý Thu Hồi'}
                      </button>
                      <button
                        onClick={() => setConfirmRevoke(false)}
                        disabled={revoking}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: '#cbd5e1',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          cursor: 'pointer'
                        }}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}

                {revokeError && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 11,
                    marginBottom: 12
                  }}>
                    {revokeError}
                  </div>
                )}

                {/* Metadata cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 10,
                  marginBottom: 16
                }}>
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 10, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Thời điểm phát</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginTop: 2 }}>
                      {selectedEntry.timestamp}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 10, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Người phát lệnh</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginTop: 2 }}>
                      {selectedEntry.issuedBy}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 10, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Phạm vi phát sóng</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#38bdf8', marginTop: 2 }}>
                      {selectedEntry.scopeLabel || selectedEntry.scope}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 10, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Kênh phân phối</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginTop: 2, display: 'flex', gap: 6 }}>
                      {selectedEntry.channels?.map(ch => (
                        <span key={ch} style={{
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: ch === 'sms' ? '#0284c7' : '#ea580c',
                          color: '#fff',
                          fontSize: 10
                        }}>
                          {ch.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Kết quả phân phối */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: 'space-around',
                  textAlign: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>TỔNG NGƯỜI NHẬN</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 2 }}>
                      {selectedEntry.recipientsTotal}
                    </div>
                  </div>
                  <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }}></div>
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>ĐÃ TIẾP NHẬN</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#4ade80', marginTop: 2 }}>
                      {selectedEntry.deliveredCount}
                    </div>
                  </div>
                  <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }}></div>
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>THẤT BẠI / TẮT MÁY</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#f87171', marginTop: 2 }}>
                      {selectedEntry.failedCount || 0}
                    </div>
                  </div>
                </div>

                {/* Nội dung tin nhắn đã phát */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
                    Nội dung tin nhắn phát tới người dân:
                  </div>
                  <div style={{
                    background: 'rgba(6, 9, 17, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    padding: '14px 16px',
                    fontSize: 13,
                    color: '#f8fafc',
                    lineHeight: 1.6,
                    borderLeft: '4px solid #0284c7'
                  }}>
                    {selectedEntry.message}
                  </div>
                </div>

                {/* Danh sách người nhận chi tiết */}
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                      <Users size={13} color="#38bdf8" />
                      <span>Danh sách người nhận & trạng thái chuyển phát</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      {deliveries.length} thiết bị ghi nhận
                    </span>
                  </div>

                  {deliveriesLoading ? (
                    <div style={{ textAlign: 'center', padding: 16, color: '#64748b', fontSize: 12 }}>
                      <RefreshCw size={14} className="spin" style={{ display: 'inline', marginRight: 6 }} /> Đang tải danh sách người nhận...
                    </div>
                  ) : deliveries.length === 0 ? (
                    <div style={{
                      padding: 14,
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: 8,
                      textAlign: 'center',
                      color: '#64748b',
                      fontSize: 12
                    }}>
                      Chưa có dữ liệu chuyển phát chi tiết cho đợt phát này.
                    </div>
                  ) : (
                    <div style={{
                      maxHeight: 220,
                      overflowY: 'auto',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 8,
                      background: 'rgba(0, 0, 0, 0.3)'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: 'rgba(255, 255, 255, 0.04)', color: '#94a3b8', textAlign: 'left', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <th style={{ padding: '8px 10px' }}>Người nhận</th>
                            <th style={{ padding: '8px 10px' }}>Số điện thoại</th>
                            <th style={{ padding: '8px 10px' }}>FCM Token</th>
                            <th style={{ padding: '8px 10px' }}>Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deliveries.map((d, idx) => {
                            const isSent = d.status === 'sent';
                            return (
                              <tr key={d.deliveryId || idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                                <td style={{ padding: '8px 10px', color: '#f8fafc', fontWeight: 600 }}>
                                  {d.recipientName || 'Công dân'}
                                </td>
                                <td style={{ padding: '8px 10px', color: '#cbd5e1' }}>
                                  {d.phoneNumber || '—'}
                                </td>
                                <td style={{ padding: '8px 10px', color: '#64748b', fontFamily: 'monospace' }}>
                                  {d.fcmToken ? `...${d.fcmToken.slice(-10)}` : '—'}
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    background: isSent ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    color: isSent ? '#4ade80' : '#f87171',
                                    border: `1px solid ${isSent ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                                  }}>
                                    {isSent ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                    {isSent ? 'Thành công' : 'Thất bại'}
                                  </span>
                                  {d.errorMessage && (
                                    <div style={{ color: '#f87171', fontSize: 10, marginTop: 2 }}>{d.errorMessage}</div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                Chọn một lệnh cảnh báo bên trái để xem chi tiết.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
