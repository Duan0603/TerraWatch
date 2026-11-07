import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertOctagon, 
  Send, 
  X, 
  Smartphone, 
  MessageSquare, 
  Radio, 
  Users, 
  Clock, 
  CheckCircle2, 
  ShieldAlert, 
  ArrowRight,
  RefreshCw,
  Info
} from 'lucide-react';
import broadcastApi from '../api/broadcastApi';

const TEMPLATES = [
  {
    id: 'evacuation',
    title: '🚨 Di Dời & Sơ Tán Khẩn Cấp',
    text: '[KHẨN CẤP] Ban Chỉ huy PCTT thông báo nguy cơ sạt lở đất nghiêm trọng tại {location}. Đề nghị toàn thể nhân dân khẩn trương sơ tán người già, trẻ nhỏ đến nơi an toàn trước 18h00.'
  },
  {
    id: 'heavy_rain',
    title: '🌧️ Mưa Lũ & Nguy Cơ Lũ Bùn Đá',
    text: '[CẢNH BÁO MƯA LŨ] Lượng mưa 24h vượt 150mm tại {location}, nguy cơ cao xảy ra lũ quét và sạt trượt ta-luy dương. Người dân tuyệt đối không ở lại lán trại nương rẫy.'
  },
  {
    id: 'traffic',
    title: '⛔ Cảnh Báo Giao Thông Đèo Dốc',
    text: '[CẢNH BÁO GIAO THÔNG] Tuyến đường qua {location} xuất hiện cung trượt nguy hiểm. Tạm thời phong tỏa phương tiện qua lại cho đến khi có thông báo an toàn.'
  }
];

/**
 * @typedef {Object} BroadcastModalProps
 * @property {boolean} isOpen - Trạng thái hiển thị modal phát tán
 * @property {function} onClose - Callback đóng modal
 * @property {Object|null} [event] - Sự cố trọng tâm cần phát thông báo
 * @property {Object[]} [allEvents] - Danh sách tất cả sự cố hiện hành
 * @property {Object|null} [currentUser] - Người dùng đăng nhập có quyền chỉ huy
 * @property {function} [onBroadcastSuccess] - Callback khi phát lệnh thành công
 */

/**
 * Component BroadcastModal - Cửa sổ điều hành phát lệnh khẩn cấp qua đa kênh (SMS, FCM, Loa còi)
 * @param {BroadcastModalProps} props
 */
export default function BroadcastModal({ 
  isOpen, 
  onClose, 
  event, 
  allEvents = [], 
  currentUser,
  onBroadcastSuccess 
}) {
  if (!isOpen) return null;

  // Trọng tâm khu vực phát lệnh
  const activeEvent = event || (allEvents.length > 0 ? allEvents[0] : null);
  const locationName = activeEvent ? activeEvent.location : 'Vùng Tây Bắc (Yên Bái - Lào Cai)';

  // Form states
  // Khu vực phát lệnh lấy từ backend (người nhận = thuê bao đăng ký khu vực đó). Kênh duy nhất đang chạy: FCM.
  const [areas, setAreas] = useState([]);
  const [areaId, setAreaId] = useState('');
  const [areasError, setAreasError] = useState(null);
  const requestIdRef = useRef(null);
  const area = areas.find(a => String(a.id) === String(areaId));
  const channels = ['fcm'];
  const [selectedTemplate, setSelectedTemplate] = useState('evacuation');
  const [message, setMessage] = useState(() => {
    return TEMPLATES[0].text.replace('{location}', locationName);
  });

  // Step state: 1 = Soạn thảo & Xem trước, 2 = Xác nhận an toàn 2 bước, 3 = Đang gửi, 4 = Thành công
  const [step, setStep] = useState(1);
  const [confirmInput, setConfirmInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Cập nhật nội dung khi thay đổi template hoặc sự cố
  const handleSelectTemplate = (tplId) => {
    setSelectedTemplate(tplId);
    const tpl = TEMPLATES.find(t => t.id === tplId);
    if (tpl) {
      setMessage(tpl.text.replace('{location}', locationName));
    }
  };

  useEffect(() => {
    broadcastApi.getAreas()
      .then((list) => {
        setAreas(list);
        // Điền sẵn khu vực của dự báo đang chọn (nếu có); admin vẫn đổi được.
        const preset = event?.unit?.areaId;
        if (preset != null && list.some(a => a.id === preset)) setAreaId(String(preset));
      })
      .catch(() => setAreasError('Không tải được danh sách khu vực. Không thể phát lệnh lúc này.'));
  }, []);

  // Đếm ký tự SMS (160 ký tự / tin)
  const charCount = message.length;
  const smsSegments = Math.ceil(charCount / 160) || 1;
  const isOverSingleSms = charCount > 160;

  // Thực hiện phát lệnh
  const handleExecuteBroadcast = async () => {
    try {
      setIsSending(true);
      setStep(3);

      requestIdRef.current ??= crypto.randomUUID();
      const result = await broadcastApi.sendBroadcast({
        requestId: requestIdRef.current,
        areaId: area.id,
        areaName: area.name,
        runId: event?.status === 'approved' && !event.expired ? event.id : null,
        message,
        issuedBy: currentUser?.fullName || 'Admin',
        urgency: activeEvent?.risk === 'extreme' ? 'EXTREME' : 'HIGH'
      });
      setSendResult(result);
      setStep(4);

      if (onBroadcastSuccess) {
        onBroadcastSuccess(result);
      }
    } catch (err) {
      if (err.retryWithNewKey) requestIdRef.current = null;
      alert(`Lỗi khi phát lệnh cảnh báo: ${err.message}`);
      setStep(2);
    } finally {
      setIsSending(false);
    }
  };

  const handleResetModal = () => {
    setStep(1);
    setConfirmInput('');
    setSendResult(null);
    requestIdRef.current = null;
    onClose();
  };

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
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="broadcast-modal-heading"
        style={{
        maxWidth: 720,
        width: '100%',
        background: 'rgba(13, 19, 34, 0.98)',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        borderRadius: 16,
        boxShadow: '0 25px 70px rgba(0, 0, 0, 0.85), 0 0 35px rgba(239, 68, 68, 0.2)',
        color: '#f8fafc',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '92vh'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.15) 0%, rgba(13, 19, 34, 0) 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: '#dc2626',
              padding: 8,
              borderRadius: 10,
              display: 'flex',
              boxShadow: '0 0 15px rgba(220, 38, 38, 0.6)'
            }}>
              <AlertOctagon size={24} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.03em', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                PHÁT LỆNH CẢNH BÁO THIÊN TAI KHẨN CẤP
                <span style={{
                  fontSize: 10,
                  background: 'rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  fontWeight: 700
                }}>
                  ADMIN EXCLUSIVE
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                Khu vực trọng điểm: <strong style={{ color: '#38bdf8' }}>{locationName}</strong>
              </div>
            </div>
          </div>

          <button
            onClick={handleResetModal}
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

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* STEP 1: SOẠN THẢO VÀ CẤU HÌNH PHÁT SÓNG */}
          {step === 1 && (
            <div>
              {/* 1. Khu vực phát lệnh (người nhận = thuê bao đăng ký khu vực này) */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>
                  <Radio size={14} color="#38bdf8" /> 1. KHU VỰC PHÁT CẢNH BÁO:
                </label>
                <select
                  value={areaId}
                  onChange={(e) => setAreaId(e.target.value)}
                  style={{ width: '100%', background: 'rgba(6, 9, 17, 0.95)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}
                >
                  <option value="">-- Chọn khu vực giám sát --</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {areasError && <div style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>{areasError}</div>}
              </div>

              {/* 2. Kênh phát: chỉ FCM đang hoạt động */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
                  2. Kênh phát sóng:
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#cbd5e1' }}>
                  <Smartphone size={15} color="#fb923c" />
                  <span>Thông báo đẩy <strong>FCM App Push</strong> tới người dân đã đăng ký khu vực</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#64748b', marginTop: 6 }}>
                  <MessageSquare size={14} />
                  <span>SMS chưa khả dụng (chưa kết nối nhà cung cấp SMS) — sẽ không có tin SMS nào được gửi.</span>
                </div>
              </div>

              {/* 3. Mẫu Tin Nhắn Tình Huống Khẩn Cấp */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>
                    3. MẪU SOẠN SẴN (TEMPLATES TÌNH HUỐNG):
                  </label>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Bấm để nạp nhanh nội dung</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TEMPLATES.map(tpl => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl.id)}
                      style={{
                        background: selectedTemplate === tpl.id ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${selectedTemplate === tpl.id ? '#ef4444' : 'rgba(255, 255, 255, 0.1)'}`,
                        color: selectedTemplate === tpl.id ? '#f87171' : '#cbd5e1',
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {tpl.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Soạn Nội Dung Tin Nhắn & Bộ Đếm Ký Tự SMS */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>
                    4. NỘI DUNG PHÁT CẢNH BÁO:
                  </label>
                  {/* SMS Counter */}
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: isOverSingleSms ? '#fb923c' : '#38bdf8'
                  }}>
                    {charCount}/160 ký tự ({smsSegments} SMS {isOverSingleSms && '⚠️'})
                  </span>
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    background: 'rgba(6, 9, 17, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    color: '#fff',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                    resize: 'vertical',
                    outline: 'none',
                    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.5)'
                  }}
                  placeholder="Nhập nội dung cảnh báo khẩn cấp gửi tới người dân..."
                />

                {isOverSingleSms && (
                  <div style={{ fontSize: 10, color: '#fb923c', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Info size={12} />
                    Nội dung vượt 160 ký tự sẽ được gửi dưới dạng tin nhắn ghép (2 SMS). Khuyến nghị rút gọn để tối ưu tốc độ nhận tin.
                  </div>
                )}
              </div>

              {/* Footer Buttons Step 1 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <button
                  type="button"
                  onClick={handleResetModal}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#94a3b8',
                    padding: '9px 18px',
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!message.trim() || !area}
                  style={{
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    padding: '9px 22px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 4px 15px rgba(220, 38, 38, 0.4)'
                  }}
                >
                  Tiếp Tục Xác Nhận Phát Lệnh <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: XÁC NHẬN AN TOÀN 2 BƯỚC (TWO-STEP SAFETY CONFIRMATION) */}
          {step === 2 && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '2px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 12,
              padding: 24,
              textAlign: 'center'
            }}>
              <div style={{
                width: 60,
                height: 60,
                background: 'rgba(239, 68, 68, 0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                border: '2px solid #ef4444'
              }}>
                <ShieldAlert size={34} color="#ef4444" />
              </div>

              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#f87171', margin: '0 0 8px 0' }}>
                XÁC NHẬN BÁO ĐỘNG ĐỎ KHẨN CẤP
              </h3>

              <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, maxWidth: 540, margin: '0 auto 16px' }}>
                Đồng chí đang chuẩn bị phát lệnh cảnh báo khẩn cấp tới{' '}
                <strong style={{ color: '#fff', textDecoration: 'underline' }}>
                  toàn bộ người dân đã đăng ký khu vực
                </strong>{' '}
                <strong>{area?.name}</strong> qua kênh{' '}
                <strong>[FCM APP PUSH]</strong>.
              </p>

              <div style={{
                background: 'rgba(0, 0, 0, 0.5)',
                borderRadius: 8,
                padding: '12px 16px',
                textAlign: 'left',
                fontSize: 12,
                color: '#e2e8f0',
                borderLeft: '4px solid #ef4444',
                marginBottom: 20,
                fontFamily: 'monospace'
              }}>
                "{message}"
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                  Để tránh phát lệnh nhầm, vui lòng gõ <strong>"XAC NHAN"</strong> vào ô bên dưới:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="XAC NHAN"
                  autoFocus
                  style={{
                    background: 'rgba(6, 9, 17, 0.95)',
                    border: '1px solid #ef4444',
                    borderRadius: 8,
                    padding: '10px 16px',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    textAlign: 'center',
                    letterSpacing: '0.1em',
                    outline: 'none',
                    width: 200
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#cbd5e1',
                    padding: '10px 20px',
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Quay Lại Chỉnh Sửa
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBroadcast}
                  disabled={confirmInput.trim().toUpperCase() !== 'XAC NHAN'}
                  style={{
                    background: confirmInput.trim().toUpperCase() === 'XAC NHAN' ? '#dc2626' : 'rgba(220, 38, 38, 0.3)',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 26px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: confirmInput.trim().toUpperCase() === 'XAC NHAN' ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: confirmInput.trim().toUpperCase() === 'XAC NHAN' ? '0 0 25px rgba(220, 38, 38, 0.7)' : 'none'
                  }}
                >
                  <Send size={15} /> XÁC NHẬN PHÁT LỆNH NGAY
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: ĐANG TRUYỀN TẢI TÍN HIỆU ĐẾN TELCO / FCM */}
          {step === 3 && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ display: 'inline-block', animation: 'spin 1.2s linear infinite', marginBottom: 16 }}>
                <RefreshCw size={36} color="#38bdf8" />
              </div>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 6px 0' }}>
                Đang gửi lệnh cảnh báo...
              </h4>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                Đang gửi qua Firebase Cloud Messaging
              </p>
            </div>
          )}

          {/* STEP 4: PHÁT LỆNH THÀNH CÔNG */}
          {step === 4 && sendResult && (
            <div style={{ padding: '24px 20px', textAlign: 'center' }}>
              <div style={{
                width: 56,
                height: 56,
                background: 'rgba(34, 197, 94, 0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                border: '2px solid #22c55e'
              }}>
                <CheckCircle2 size={32} color="#22c55e" />
              </div>

              <h4 style={{ fontSize: 18, fontWeight: 800, color: '#4ade80', margin: '0 0 8px 0' }}>
                ĐÃ GỬI LỆNH CẢNH BÁO
              </h4>

              <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 16px 0' }}>
                Mã điều phối: <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{sendResult.broadcastId}</strong>
              </p>

              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                padding: '12px 18px',
                display: 'inline-block',
                fontSize: 12,
                color: '#94a3b8',
                marginBottom: 20
              }}>
                Đã gửi tới {sendResult.sent}/{sendResult.total} thiết bị
                {sendResult.failed > 0 && ` — ${sendResult.failed} thiết bị lỗi`}. SMS: không gửi.
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleResetModal}
                  style={{
                    background: '#0284c7',
                    border: 'none',
                    color: '#fff',
                    padding: '9px 24px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Hoàn Tất & Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
