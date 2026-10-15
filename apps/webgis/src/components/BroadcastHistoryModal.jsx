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
  Send
} from 'lucide-react';
import broadcastApi from '../api/broadcastApi';

export default function BroadcastHistoryModal({ isOpen, onClose, onOpenNewBroadcast }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await broadcastApi.getBroadcastHistory();
      setHistory(data);
      if (data.length > 0 && !selectedEntry) {
        setSelectedEntry(data[0]);
      }
    } catch (err) {
      console.error('Lỗi khi tải lịch sử phát cảnh báo:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

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
              <div style={{ textAlign: 'center', padding: 30, color: '#64748b', fontSize: 12 }}>
                Không tìm thấy đợt phát lệnh nào.
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
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#4ade80',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5
                  }}>
                    <CheckCircle size={13} /> {selectedEntry.status}
                  </span>
                </div>

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
                <div>
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
