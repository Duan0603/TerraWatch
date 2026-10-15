import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, 
  Lock, 
  Mail, 
  ArrowRight, 
  ArrowLeft,
  UserCheck, 
  ShieldCheck, 
  UserPlus, 
  Smartphone, 
  X, 
  Building2, 
  MapPin, 
  Phone, 
  User, 
  CheckCircle2, 
  Info,
  MessageSquare,
  RotateCcw,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import authApi from '../api/authApi';

export default function LoginPage() {
  // Khớp với tài khoản seed thật (V2) + mật khẩu demo đặt bởi migration V4
  const [email, setEmail] = useState('officer.yenbai@terrawatch.vn');
  const [password, setPassword] = useState('Terrawatch@2026');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // State quản lý Modal Đăng ký
  const [activeModal, setActiveModal] = useState(null); // 'officer' | 'citizen' | null
  const [regStep, setRegStep] = useState('form'); // 'form' | 'otp'
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regUnit, setRegUnit] = useState('Chi cục Thủy lợi & PCTT Tỉnh Yên Bái');
  const [regArea, setRegArea] = useState('Huyện Mù Cang Chải, Tỉnh Yên Bái');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccessResult, setRegSuccessResult] = useState(null);

  // State quản lý mã OTP qua Số điện thoại
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [isRealSms, setIsRealSms] = useState(false);
  const [formattedPhone, setFormattedPhone] = useState('');
  const [smsWarning, setSmsWarning] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(60);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  // Đếm ngược 60s gửi lại mã OTP
  useEffect(() => {
    let timer;
    if (regStep === 'otp' && otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [regStep, otpCountdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg('');
      await login(email, password);
      navigate('/');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (role) => {
    if (role === 'officer') {
      setEmail('officer.yenbai@terrawatch.vn');
    } else if (role === 'citizen') {
      setEmail('citizen.limmong@terrawatch.vn');
    } else {
      setEmail('admin@terrawatch.vn');
    }
    setPassword('Terrawatch@2026');
  };

  const openRegisterModal = (role) => {
    setActiveModal(role);
    setRegStep('form');
    setRegFullName('');
    setRegEmail('');
    setRegPhone('');
    setRegPassword('');
    setRegConfirmPassword('');
    setRegError('');
    setRegSuccessResult(null);
    setOtpCode('');
    setGeneratedOtp('');
    setOtpCountdown(60);
    setOtpError('');
    if (role === 'officer') {
      setRegUnit('Chi cục PCTT & Ban Chỉ huy TKCN Tỉnh Yên Bái');
    } else {
      setRegArea('Huyện Mù Cang Chải, Tỉnh Yên Bái (Vùng trọng điểm AOI 1)');
    }
  };

  const closeRegisterModal = () => {
    setActiveModal(null);
    setRegStep('form');
    setRegSuccessResult(null);
    setRegError('');
    setOtpCode('');
    setOtpError('');
  };

  // Bước 1: Kiểm tra form và Gửi mã OTP về Số điện thoại
  const handleInitiateRegister = async (e) => {
    e.preventDefault();
    setRegError('');

    if (!regFullName.trim() || !regEmail.trim() || !regPhone.trim() || !regPassword) {
      setRegError('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }

    const cleanPhone = regPhone.replace(/\s+/g, '');
    if (cleanPhone.length < 9) {
      setRegError('Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại để nhận mã OTP SMS.');
      return;
    }

    if (regPassword.length < 6) {
      setRegError('Mật khẩu bảo mật phải có tối thiểu 6 ký tự.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('Mật khẩu xác nhận không khớp với mật khẩu đã nhập.');
      return;
    }

    try {
      setRegLoading(true);
      // Gửi mã OTP SMS qua Firebase Phone Auth
      const res = await authApi.sendSmsOtp(cleanPhone, 'recaptcha-container');
      setIsRealSms(!!res.isRealSms);
      setFormattedPhone(res.formattedPhone || cleanPhone);
      setGeneratedOtp(res.otp || '');
      setSmsWarning(res.warning || '');
      setOtpCode('');
      setOtpCountdown(60);
      setOtpError('');
      setRegStep('otp');
    } catch (err) {
      setRegError('Không thể gửi mã OTP SMS: ' + (err.message || 'Vui lòng kiểm tra lại số điện thoại.'));
    } finally {
      setRegLoading(false);
    }
  };

  // Gửi lại mã OTP SMS
  const handleResendOtp = async () => {
    if (otpCountdown > 0 || otpLoading) return;
    try {
      setOtpLoading(true);
      setOtpError('');
      const cleanPhone = regPhone.replace(/\s+/g, '');
      const res = await authApi.sendSmsOtp(cleanPhone, 'recaptcha-container');
      setIsRealSms(!!res.isRealSms);
      setFormattedPhone(res.formattedPhone || cleanPhone);
      setGeneratedOtp(res.otp || '');
      setSmsWarning(res.warning || '');
      setOtpCountdown(60);
    } catch (err) {
      setOtpError('Không thể gửi lại mã OTP: ' + (err.message || 'Vui lòng thử lại sau.'));
    } finally {
      setOtpLoading(false);
    }
  };

  // Bước 2: Xác thực mã OTP và hoàn tất Đăng ký
  const handleVerifyOtpAndRegister = async (e) => {
    e.preventDefault();
    setOtpError('');

    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setOtpError('Vui lòng nhập đầy đủ 6 chữ số mã OTP.');
      return;
    }

    try {
      setOtpLoading(true);
      const cleanPhone = regPhone.replace(/\s+/g, '');

      // 1. Kiểm tra xác thực mã OTP
      await authApi.verifySmsOtp(cleanPhone, cleanOtp, generatedOtp);

      // 2. Hoàn tất đăng ký sau khi OTP hợp lệ
      if (activeModal === 'officer') {
        const result = await authApi.registerOfficerRequest({
          fullName: regFullName,
          email: regEmail,
          phoneNumber: cleanPhone,
          departmentUnit: regUnit,
          password: regPassword,
          role: 'officer',
          phoneVerified: true
        });
        setRegSuccessResult({
          type: 'officer',
          title: 'Xác Thực SĐT & Gửi Hồ Sơ Cán Bộ Thành Công!',
          requestId: result.requestId || `REG-OFFICER-${Date.now().toString().slice(-6)}`,
          phone: cleanPhone,
          message: 'Số điện thoại đã được xác thực OTP chính chủ. Hồ sơ đăng ký đã được chuyển vào hàng đợi phê duyệt của Ban Quản Trị (Admin) theo quy chuẩn UC06.'
        });
      } else {
        const result = await authApi.registerCitizen({
          fullName: regFullName,
          email: regEmail,
          phoneNumber: cleanPhone,
          areaOfInterest: regArea,
          password: regPassword,
          phoneVerified: true
        });
        setRegSuccessResult({
          type: 'citizen',
          title: 'Đăng Ký & Xác Thực Số Điện Thoại Thành Công!',
          userId: result.userId || `citizen-${Date.now().toString().slice(-6)}`,
          phone: cleanPhone,
          message: 'Số điện thoại của bạn đã được xác thực và lưu vào hệ thống cảnh báo sớm. Bạn sẽ nhận được tin nhắn SMS khẩn cấp (Story 4.4) khi có nguy cơ sạt lở tại khu vực.'
        });
      }
    } catch (err) {
      setOtpError(err.message || 'Mã OTP không chính xác hoặc đã hết hạn.');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(14, 165, 233, 0.12) 0%, transparent 70%)',
      padding: 20
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
        background: 'rgba(19, 27, 46, 0.88)',
        border: '1px solid var(--border-color)',
        borderRadius: 16,
        padding: 32,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(16px)'
      }}>
        {/* Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex',
            background: 'rgba(14, 165, 233, 0.15)',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            padding: 12,
            borderRadius: 14,
            marginBottom: 12
          }}>
            <ShieldAlert size={36} color="#38bdf8" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.03em', marginBottom: 4 }}>
            TERRAWATCH <span style={{ color: '#38bdf8' }}>GEOSENTRY</span>
          </h1>
          <p style={{ fontSize: 12, color: '#94a3b8' }}>
            Hệ thống Viễn thám & AI Giám sát Cảnh báo Sớm Sạt lở Đất
          </p>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 12,
            marginBottom: 16
          }}>
            {errorMsg}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Email đăng nhập (Công dân / Cán bộ / Admin)
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 12, top: 11, color: '#64748b' }}>
                <Mail size={16} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@terrawatch.vn"
                style={{
                  width: '100%',
                  background: 'rgba(13, 19, 34, 0.9)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '10px 12px 10px 38px',
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Mật khẩu bảo mật
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 12, top: 11, color: '#64748b' }}>
                <Lock size={16} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  background: 'rgba(13, 19, 34, 0.9)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '10px 12px 10px 38px',
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              padding: '12px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background 0.2s ease'
            }}
          >
            {isLoading ? 'Đang xác thực JWT...' : (
              <>
                Vào Trung Tâm Chỉ Huy <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Helper (Hữu ích khi demo cho Hội đồng chấm thi) */}
        <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, textAlign: 'center' }}>
            Nút chọn nhanh tài khoản diễn tập:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('citizen')}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '8px',
                borderRadius: 6,
                color: '#34d399',
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}
            >
              <Smartphone size={13} /> Công Dân
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('officer')}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '8px',
                borderRadius: 6,
                color: '#38bdf8',
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}
            >
              <UserCheck size={13} /> Cán Bộ (Officer)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin')}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '8px',
                borderRadius: 6,
                color: '#f87171',
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}
            >
              <ShieldCheck size={13} /> Quản Trị (Admin)
            </button>
          </div>
        </div>

        {/* Liên kết phụ: Đăng ký Cán bộ (Yêu cầu Admin phê duyệt) hoặc Công dân */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, textAlign: 'center' }}>
            Chưa có tài khoản trên hệ thống?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={() => openRegisterModal('officer')}
              style={{
                background: 'rgba(56, 189, 248, 0.06)',
                border: '1px dashed rgba(56, 189, 248, 0.35)',
                padding: '9px 12px',
                borderRadius: 8,
                color: '#38bdf8',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
                textAlign: 'center'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.14)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.06)'; }}
            >
              <UserPlus size={14} />
              <span>Đăng ký tài khoản cán bộ mới <span style={{ opacity: 0.8, fontSize: 11, fontWeight: 400 }}>(Admin phê duyệt)</span></span>
            </button>

            <button
              type="button"
              onClick={() => openRegisterModal('citizen')}
              style={{
                background: 'rgba(16, 185, 129, 0.06)',
                border: '1px dashed rgba(16, 185, 129, 0.35)',
                padding: '9px 12px',
                borderRadius: 8,
                color: '#34d399',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
                textAlign: 'center'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.14)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.06)'; }}
            >
              <Smartphone size={14} />
              <span>Đăng ký tài khoản công dân <span style={{ opacity: 0.8, fontSize: 11, fontWeight: 400 }}>(Nhận cảnh báo)</span></span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Đăng Ký Chuyên Nghiệp (Cán Bộ / Công Dân) */}
      {activeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(3, 7, 18, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          zIndex: 9999
        }}>
          <div style={{
            width: '100%',
            maxWidth: 480,
            background: 'rgba(15, 23, 42, 0.95)',
            border: activeModal === 'officer' ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 16,
            padding: 28,
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
            maxHeight: '92vh',
            overflowY: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  background: activeModal === 'officer' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  border: activeModal === 'officer' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                  padding: 8,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {activeModal === 'officer' ? (
                    <UserPlus size={22} color="#38bdf8" />
                  ) : (
                    <Smartphone size={22} color="#34d399" />
                  )}
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    {activeModal === 'officer' ? 'Đăng Ký Tài Khoản Cán Bộ Chuyên Môn' : 'Đăng Ký Tài Khoản Công Dân'}
                  </h2>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0 0' }}>
                    {activeModal === 'officer' 
                      ? 'Dành cho cán bộ Ban Chỉ huy PCTT & TKCN các địa phương' 
                      : 'Đăng ký nhận cảnh báo sạt lở sớm qua SMS & TerraWatch Mobile'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeRegisterModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 6
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Success Result View */}
            {regSuccessResult ? (
              <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                <div style={{
                  display: 'inline-flex',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: 12,
                  borderRadius: '50%',
                  marginBottom: 12
                }}>
                  <CheckCircle2 size={36} color="#34d399" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>
                  {regSuccessResult.title}
                </h3>
                <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, marginBottom: 16 }}>
                  {regSuccessResult.message}
                </p>

                {regSuccessResult.requestId && (
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#38bdf8',
                    marginBottom: 20
                  }}>
                    Mã hồ sơ tiếp nhận: <strong>{regSuccessResult.requestId}</strong>
                  </div>
                )}

                <button
                  type="button"
                  onClick={closeRegisterModal}
                  style={{
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 24px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Quay lại Đăng nhập
                </button>
              </div>
            ) : regStep === 'otp' ? (
              /* OTP Verification View */
              <form onSubmit={handleVerifyOtpAndRegister}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <button
                    type="button"
                    onClick={() => { setRegStep('form'); setOtpError(''); }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#38bdf8',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: 0
                    }}
                  >
                    <ArrowLeft size={14} /> Quay lại sửa thông tin
                  </button>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Bước 2 / 2: Xác thực SĐT</span>
                </div>

                {/* Invisible reCAPTCHA container for Firebase Phone Auth */}
                <div id="recaptcha-container"></div>

                {/* SMS Notification Banner (Real SMS vs Simulation) */}
                {isRealSms ? (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 16
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontSize: 13, fontWeight: 700 }}>
                        <Smartphone size={16} /> 📲 Đã gửi tin nhắn SMS thật về điện thoại!
                      </div>
                      <span style={{ fontSize: 10, color: '#a7f3d0', background: 'rgba(16, 185, 129, 0.2)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                        Google Firebase SMS
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#f8fafc', lineHeight: 1.5 }}>
                      Google Firebase vừa gửi tin nhắn SMS chứa mã OTP gồm 6 chữ số đến SIM điện thoại: <strong style={{ color: '#34d399' }}>{formattedPhone || regPhone}</strong>.
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      👉 Vui lòng mở tin nhắn SMS trên điện thoại của bạn và nhập 6 chữ số vào ô bên dưới.
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: 'rgba(14, 165, 233, 0.12)',
                    border: '1px solid rgba(14, 165, 233, 0.35)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 16
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontSize: 12, fontWeight: 700 }}>
                        <MessageSquare size={15} /> 💬 [Chế Độ Mô Phỏng SMS Diễn Tập]
                      </div>
                      <span style={{ fontSize: 10, color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>
                        Gửi tới {formattedPhone || regPhone}
                      </span>
                    </div>
                    {smsWarning && (
                      <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 6, lineHeight: 1.4 }}>
                        ℹ️ {smsWarning}
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: '#f8fafc', lineHeight: 1.5 }}>
                      TerraWatch PCTT: Ma OTP xac thuc so dien thoai cua ban la{' '}
                      <strong style={{
                        color: '#38bdf8',
                        fontSize: 16,
                        letterSpacing: '2px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: '1px solid rgba(56, 189, 248, 0.3)'
                      }}>
                        {generatedOtp}
                      </strong>. Hiệu lực trong 5 phút.
                    </div>
                    <button
                      type="button"
                      onClick={() => { setOtpCode(generatedOtp); setOtpError(''); }}
                      style={{
                        marginTop: 8,
                        background: 'rgba(56, 189, 248, 0.2)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        color: '#38bdf8',
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      ⚡ Tự động điền nhanh mã OTP: {generatedOtp}
                    </button>
                  </div>
                )}

                {otpError && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    marginBottom: 14
                  }}>
                    {otpError}
                  </div>
                )}

                {/* 6-Digit OTP Input */}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>
                    Nhập mã xác thực gồm 6 chữ số:
                  </label>
                  <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      value={otpCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setOtpCode(val);
                      }}
                      placeholder="••••••"
                      style={{
                        width: '240px',
                        textAlign: 'center',
                        fontSize: '24px',
                        fontWeight: 800,
                        letterSpacing: '8px',
                        padding: '10px 12px',
                        background: 'rgba(13, 19, 34, 0.95)',
                        border: '2px solid #0284c7',
                        borderRadius: 10,
                        color: '#38bdf8',
                        outline: 'none',
                        boxShadow: '0 0 15px rgba(2, 132, 199, 0.35)'
                      }}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                    Đã gửi mã tới số: <strong style={{ color: '#fff' }}>{regPhone}</strong>
                  </p>
                </div>

                {/* Resend OTP button */}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  {otpCountdown > 0 ? (
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      Có thể gửi lại mã OTP sau <strong style={{ color: '#38bdf8' }}>{otpCountdown}s</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={otpLoading}
                      onClick={handleResendOtp}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#38bdf8',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <RotateCcw size={13} /> {otpLoading ? 'Đang gửi...' : 'Gửi lại mã OTP qua SMS'}
                    </button>
                  )}
                </div>

                {/* Submit button */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={closeRegisterModal}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#cbd5e1',
                      padding: '9px 16px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={otpLoading || otpCode.length !== 6}
                    style={{
                      background: activeModal === 'officer' ? '#0284c7' : '#059669',
                      color: '#fff',
                      border: 'none',
                      padding: '9px 22px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: (otpLoading || otpCode.length !== 6) ? 'not-allowed' : 'pointer',
                      opacity: (otpLoading || otpCode.length !== 6) ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {otpLoading ? 'Đang xác thực...' : (
                      <>
                        <KeyRound size={14} /> Xác Nhận & Hoàn Tất Đăng Ký
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Registration Form (Step 1) */
              <form onSubmit={handleInitiateRegister}>
                {/* Note/Badge theo nghiệp vụ RBAC */}
                <div style={{
                  background: activeModal === 'officer' ? 'rgba(14, 165, 233, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                  border: activeModal === 'officer' ? '1px solid rgba(14, 165, 233, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  marginBottom: 16,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start'
                }}>
                  <Info size={16} color={activeModal === 'officer' ? '#38bdf8' : '#34d399'} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.5 }}>
                    {activeModal === 'officer' ? (
                      <>
                        <strong>Quy chuẩn an toàn UC06:</strong> Sau khi xác thực OTP số điện thoại, hồ sơ cán bộ sẽ được chuyển tới <em>Ban Quản Trị (Admin) phê duyệt</em> trước khi có thể đăng nhập.
                      </>
                    ) : (
                      <>
                        <strong>Quy chuẩn UC07:</strong> Hệ thống sẽ gửi mã OTP SMS xác thực số điện thoại để kích hoạt danh bạ nhận tin cảnh báo thiên tai khẩn cấp (Story 4.4).
                      </>
                    )}
                  </div>
                </div>

                {regError && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    marginBottom: 14
                  }}>
                    {regError}
                  </div>
                )}

                {/* Họ và tên */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                    Họ và tên <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 10, top: 9, color: '#64748b' }}>
                      <User size={15} />
                    </div>
                    <input
                      type="text"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder={activeModal === 'officer' ? 'Đ/c Nguyễn Văn Huy' : 'Hoàng Văn Dũng'}
                      style={{
                        width: '100%',
                        background: 'rgba(13, 19, 34, 0.9)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 6,
                        padding: '8px 10px 8px 34px',
                        color: '#fff',
                        fontSize: 12,
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Email & Phone */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                      Email <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 10, top: 9, color: '#64748b' }}>
                        <Mail size={15} />
                      </div>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder={activeModal === 'officer' ? 'officer@terrawatch.vn' : 'citizen@gmail.com'}
                        style={{
                          width: '100%',
                          background: 'rgba(13, 19, 34, 0.9)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 6,
                          padding: '8px 10px 8px 34px',
                          color: '#fff',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                      Số điện thoại nhận OTP SMS <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 10, top: 9, color: '#64748b' }}>
                        <Phone size={15} />
                      </div>
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="0912345678"
                        style={{
                          width: '100%',
                          background: 'rgba(13, 19, 34, 0.9)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 6,
                          padding: '8px 10px 8px 34px',
                          color: '#fff',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Đơn vị công tác (Cán bộ) hoặc Khu vực quan tâm (Công dân) */}
                {activeModal === 'officer' ? (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                      Đơn vị công tác / Ban Chỉ huy PCTT <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 10, top: 9, color: '#64748b' }}>
                        <Building2 size={15} />
                      </div>
                      <input
                        type="text"
                        value={regUnit}
                        onChange={(e) => setRegUnit(e.target.value)}
                        placeholder="Ví dụ: Chi cục Thủy lợi & PCTT Tỉnh Yên Bái"
                        style={{
                          width: '100%',
                          background: 'rgba(13, 19, 34, 0.9)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 6,
                          padding: '8px 10px 8px 34px',
                          color: '#fff',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                      Địa bàn cư trú / Vùng nhận cảnh báo (AOI) <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 10, top: 9, color: '#64748b' }}>
                        <MapPin size={15} />
                      </div>
                      <input
                        type="text"
                        value={regArea}
                        onChange={(e) => setRegArea(e.target.value)}
                        placeholder="Ví dụ: Bản Lìm Mông, Xã Cao Phạ, Huyện Mù Cang Chải"
                        style={{
                          width: '100%',
                          background: 'rgba(13, 19, 34, 0.9)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 6,
                          padding: '8px 10px 8px 34px',
                          color: '#fff',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Password & Confirm Password */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                      Mật khẩu <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 10, top: 9, color: '#64748b' }}>
                        <Lock size={15} />
                      </div>
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{
                          width: '100%',
                          background: 'rgba(13, 19, 34, 0.9)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 6,
                          padding: '8px 10px 8px 34px',
                          color: '#fff',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                      Xác nhận mật khẩu <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 10, top: 9, color: '#64748b' }}>
                        <Lock size={15} />
                      </div>
                      <input
                        type="password"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{
                          width: '100%',
                          background: 'rgba(13, 19, 34, 0.9)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 6,
                          padding: '8px 10px 8px 34px',
                          color: '#fff',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={closeRegisterModal}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#cbd5e1',
                      padding: '9px 16px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={regLoading}
                    style={{
                      background: activeModal === 'officer' ? '#0284c7' : '#059669',
                      color: '#fff',
                      border: 'none',
                      padding: '9px 20px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: regLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {regLoading ? 'Đang gửi mã OTP...' : (
                      <>
                        Tiếp tục: Nhận mã OTP SMS <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Phần tử container gắn reCAPTCHA ẩn cho Firebase */}
      <div id="recaptcha-container"></div>
    </div>
  );
}
