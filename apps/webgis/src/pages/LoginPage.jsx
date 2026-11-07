import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import authApi from '../api/authApi';
import LoginBackdrop from '../components/LoginBackdrop';
import './login.css';

// Khung tự đổi chiều cao mượt khi nội dung bên trong thay đổi (chuyển bước đăng ký).
function AutoHeight({ children }) {
  const inner = useRef(null);
  const [h, setH] = useState('auto');
  useEffect(() => {
    const el = inner.current;
    if (!el || !window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    setH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);
  return <div className="lg-auto" style={{ height: h }}><div ref={inner}>{children}</div></div>;
}

// Sáu ô nhập mã OTP: tự nhảy ô, Backspace lùi ô, dán cả mã một lần.
function OtpBoxes({ value, onChange, disabled }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  const setAt = (i, ch) => {
    const next = digits.slice();
    next[i] = ch;
    onChange(next.join('').slice(0, 6));
  };
  const handleChange = (i, raw) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) { setAt(i, ''); return; }
    if (clean.length > 1) { // dán nhiều số
      onChange((value.slice(0, i) + clean).slice(0, 6));
      refs.current[Math.min(i + clean.length, 5)]?.focus();
      return;
    }
    setAt(i, clean);
    if (i < 5) refs.current[i + 1]?.focus();
  };
  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  };

  return (
    <div className="lg-otp" role="group" aria-label="Mã OTP gồm 6 chữ số">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className="lg-otp-box"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={6}
          value={d}
          disabled={disabled}
          autoFocus={i === 0}
          aria-label={`Chữ số ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // State quản lý Modal Đăng ký
  const [activeModal, setActiveModal] = useState(null); // 'officer' | 'citizen' | null
  const [regStep, setRegStep] = useState('form'); // 'form' | 'otp'
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regUnit, setRegUnit] = useState('');
  const [regArea, setRegArea] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);
  const [modalFrom, setModalFrom] = useState({ x: 0, y: 0 }); // vị trí nút vừa bấm so với tâm màn hình
  const prevStepRef = useRef(1);
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

  const passwordRef = useRef(null);
  const submitRef = useRef(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('page-login');
    return () => document.body.classList.remove('page-login');
  }, []);

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
      const status = err.response?.status;
      if (status === 401) {
        setErrorMsg('Email hoặc mật khẩu không đúng.');
        setPassword('');
        setTimeout(() => passwordRef.current?.focus(), 0);
      } else if (!err.response) {
        setErrorMsg('Không kết nối được máy chủ. Thử lại sau.');
      } else {
        // 403 (khóa / chờ duyệt): máy chủ đã viết sẵn câu tiếng Việt.
        setErrorMsg(err.response?.data?.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại.');
      }
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
    setErrorMsg('');
    setTimeout(() => submitRef.current?.focus(), 0);
  };

  const openRegisterModal = (role, event) => {
    const rect = event?.currentTarget?.getBoundingClientRect?.();
    setModalFrom(rect
      ? { x: Math.round(rect.left + rect.width / 2 - window.innerWidth / 2), y: Math.round(rect.top + rect.height / 2 - window.innerHeight / 2) }
      : { x: 0, y: 0 });
    prevStepRef.current = 1;
    setModalClosing(false);
    setActiveModal(role);
    setRegStep('form');
    setRegFullName('');
    setRegEmail('');
    setRegPhone('');
    setRegPassword('');
    setRegConfirmPassword('');
    setShowPw(false);
    setRegError('');
    setRegSuccessResult(null);
    setOtpCode('');
    setGeneratedOtp('');
    setOtpCountdown(60);
    setOtpError('');
    setRegUnit('');
    setRegArea('');
  };

  const closeRegisterModal = () => {
    if (modalClosing) return;
    const finish = () => {
      setActiveModal(null);
      setModalClosing(false);
      setRegStep('form');
      setRegSuccessResult(null);
      setRegError('');
      setOtpCode('');
      setOtpError('');
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    setModalClosing(true);
    setTimeout(finish, 260); // khớp thời gian keyframes lg-modal-out
  };

  // Bước 1: Kiểm tra form và Gửi mã OTP về Số điện thoại
  const handleInitiateRegister = async (e) => {
    e.preventDefault();
    setRegError('');

    if (!regFullName.trim() || !regEmail.trim() || !regPhone.trim() || !regPassword) {
      setRegError('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }

    if (activeModal === 'officer' && !regUnit.trim()) {
      setRegError('Vui lòng nhập đơn vị công tác để Quản trị viên xét duyệt.');
      return;
    }

    const cleanPhone = regPhone.replace(/\s+/g, '');
    if (cleanPhone.length < 9) {
      setRegError('Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại để nhận mã OTP SMS.');
      return;
    }

    if (regPassword.length < 8) {
      setRegError('Mật khẩu bảo mật phải có tối thiểu 8 ký tự (theo yêu cầu của máy chủ).');
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
      const verifyRes = await authApi.verifySmsOtp(cleanPhone, cleanOtp, generatedOtp);
      const phoneToken = verifyRes.idToken || (await verifyRes.user?.getIdToken?.());

      // 2. Hoàn tất đăng ký sau khi OTP hợp lệ (gửi kèm phoneToken để server kiểm tra)
      if (activeModal === 'officer') {
        const result = await authApi.registerOfficerRequest({
          fullName: regFullName,
          email: regEmail,
          phoneNumber: cleanPhone,
          phoneToken,
          departmentUnit: regUnit.trim(),
          password: regPassword
        });
        setRegSuccessResult({
          type: 'officer',
          title: 'Đã Gửi Hồ Sơ Cán Bộ!',
          requestId: result?.requestId,
          phone: cleanPhone,
          message: 'Số điện thoại đã được xác thực OTP. Hồ sơ đang chờ Quản trị viên phê duyệt; bạn chỉ đăng nhập được sau khi được duyệt.'
        });
      } else {
        const result = await authApi.registerCitizen({
          fullName: regFullName,
          email: regEmail,
          phoneNumber: cleanPhone,
          phoneToken,
          areaOfInterest: regArea,
          password: regPassword
        });
        setRegSuccessResult({
          type: 'citizen',
          title: 'Đăng Ký & Xác Thực Số Điện Thoại Thành Công!',
          userId: result?.user?.userId,
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

  const stepNow = regSuccessResult ? 3 : regStep === 'otp' ? 2 : 1;
  const stepDir = stepNow >= prevStepRef.current ? 'fwd' : 'back';
  useEffect(() => { prevStepRef.current = stepNow; }, [stepNow]);

  return (
    <div className={`lg-stage${activeModal && !modalClosing ? ' lg-dimmed' : ''}`}>
      <LoginBackdrop />
      <main className="lg-layout">
        <section className="lg-hero">
          <div className="lg-brand">
            <span className="lg-mark" aria-hidden="true"><ShieldAlert size={22} color="#5FD0C0" /></span>
            TERRAWATCH GEOSENTRY
          </div>
          <h1>Theo dõi mưa và địa hình, <em>cảnh báo sạt lở 24 giờ tới</em></h1>
          <p>Trung tâm chỉ huy dành cho cán bộ và quản trị viên: xem dự báo từng khu vực, thẩm định và phát lệnh cảnh báo.</p>
          <p className="lg-note">Hệ thống đang ở giai đoạn thử nghiệm. Điểm nguy cơ là điểm thử nghiệm, chưa phải xác suất đã hiệu chuẩn và chưa thay thế cảnh báo chính thức.</p>
        </section>

        <section className="lg-card" aria-labelledby="lg-title">
          <h2 id="lg-title">Đăng nhập</h2>
          <p className="lg-sub">Dành cho công dân, cán bộ và quản trị viên</p>

          {errorMsg && <div className="lg-error" role="alert">{errorMsg}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <label className="lg-label" htmlFor="lg-email">Email</label>
            <div className="lg-field">
              <Mail size={18} aria-hidden="true" />
              <input
                id="lg-email"
                className="lg-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten@terrawatch.vn"
                autoComplete="username"
                readOnly={isLoading}
              />
            </div>
            <label className="lg-label" htmlFor="lg-password">Mật khẩu</label>
            <div className="lg-field">
              <Lock size={18} aria-hidden="true" />
              <input
                id="lg-password"
                ref={passwordRef}
                className="lg-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ít nhất 8 ký tự"
                autoComplete="current-password"
                readOnly={isLoading}
              />
            </div>
            <button ref={submitRef} className="lg-btn lg-btn-primary" type="submit" disabled={isLoading}>
              {isLoading ? 'Đang đăng nhập…' : <>Vào trung tâm chỉ huy <ArrowRight size={18} aria-hidden="true" /></>}
            </button>
            <Link className="lg-btn lg-btn-ghost" to="/model-demo">Xem demo mô hình trên dữ liệu lịch sử</Link>
          </form>

          <div className="lg-sep">Diễn tập nhanh</div>
          <div className="lg-chips">
            <button type="button" className="lg-chip" onClick={() => handleQuickLogin('citizen')}>
              <span className="lg-dot" style={{ background: '#4ADE80' }} />Công dân
            </button>
            <button type="button" className="lg-chip" onClick={() => handleQuickLogin('officer')}>
              <span className="lg-dot" style={{ background: '#FB923C' }} />Cán bộ
            </button>
            <button type="button" className="lg-chip" onClick={() => handleQuickLogin('admin')}>
              <span className="lg-dot" style={{ background: '#F87171' }} />Quản trị
            </button>
          </div>
          <p className="lg-hint">Điền sẵn tài khoản demo để diễn tập.</p>

          <div className="lg-links">
            <button type="button" className="lg-action" onClick={(e) => openRegisterModal('citizen', e)}>
              <span className="lg-action-icon"><Smartphone size={20} aria-hidden="true" /></span>
              <span className="lg-action-text">
                <strong>Đăng ký công dân</strong>
                <small>Nhận cảnh báo qua SMS và ứng dụng</small>
              </span>
              <ArrowRight size={18} className="lg-action-go" aria-hidden="true" />
            </button>
            <button type="button" className="lg-action" onClick={(e) => openRegisterModal('officer', e)}>
              <span className="lg-action-icon"><UserPlus size={20} aria-hidden="true" /></span>
              <span className="lg-action-text">
                <strong>Yêu cầu tài khoản cán bộ</strong>
                <small>Quản trị viên sẽ xét duyệt hồ sơ</small>
              </span>
              <ArrowRight size={18} className="lg-action-go" aria-hidden="true" />
            </button>
          </div>
        </section>

        <p className="lg-note lg-note-m">Hệ thống đang ở giai đoạn thử nghiệm. Điểm nguy cơ là điểm thử nghiệm, chưa phải xác suất đã hiệu chuẩn và chưa thay thế cảnh báo chính thức.</p>
      </main>

      {/* Hộp đăng ký (công dân / cán bộ): thiết kế theo DESIGN.md mục Registration dialogs */}
      {activeModal && (
        <div className={`lg-overlay${modalClosing ? ' is-closing' : ''}`} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) closeRegisterModal(); }}>
          <div className="lg-modal" style={{ '--from-x': `${modalFrom.x}px`, '--from-y': `${modalFrom.y}px` }} role="dialog" aria-modal="true" aria-labelledby="lg-modal-title">
            <div className="lg-modal-head">
              <span className="lg-modal-icon" aria-hidden="true">
                {activeModal === 'officer' ? <UserPlus size={22} /> : <Smartphone size={22} />}
              </span>
              <div className="lg-modal-titles">
                <h2 id="lg-modal-title">{activeModal === 'officer' ? 'Yêu cầu tài khoản cán bộ' : 'Đăng ký tài khoản công dân'}</h2>
                <p>{activeModal === 'officer'
                  ? 'Dành cho cán bộ Ban Chỉ huy PCTT & TKCN các địa phương'
                  : 'Nhận cảnh báo sạt lở sớm qua SMS và ứng dụng TerraWatch'}</p>
              </div>
              <button type="button" className="lg-modal-close" onClick={closeRegisterModal} aria-label="Đóng">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <ol className="lg-steps" aria-label="Các bước đăng ký">
              {['Thông tin', 'Xác minh SĐT', 'Hoàn tất'].map((label, i) => {
                const current = regSuccessResult ? 3 : regStep === 'otp' ? 2 : 1;
                const state = i + 1 < current ? 'done' : i + 1 === current ? 'now' : 'todo';
                return (
                  <li key={label} className={`lg-step lg-step-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
                    <span className="lg-step-dot">{state === 'done' ? <CheckCircle2 size={16} aria-hidden="true" /> : i + 1}</span>
                    <span className="lg-step-label">{label}</span>
                  </li>
                );
              })}
            </ol>

            <AutoHeight>
            <div key={stepNow} className={`lg-pane lg-pane-${stepDir}`}>
            {regSuccessResult ? (
              <div className="lg-done">
                <span className="lg-done-icon" aria-hidden="true"><CheckCircle2 size={40} /></span>
                <h3>{regSuccessResult.title}</h3>
                <p>{regSuccessResult.message}</p>
                {regSuccessResult.requestId && (
                  <div className="lg-code">
                    <span>Mã hồ sơ tiếp nhận</span>
                    <strong>{regSuccessResult.requestId}</strong>
                  </div>
                )}
                <button type="button" className="lg-btn lg-btn-primary" onClick={closeRegisterModal}>Quay lại đăng nhập</button>
              </div>
            ) : regStep === 'otp' ? (
              <form onSubmit={handleVerifyOtpAndRegister} noValidate>
                <p className="lg-otp-lead">
                  Chúng tôi đã gửi tin nhắn SMS chứa mã 6 chữ số tới <strong>{formattedPhone || regPhone}</strong>.
                  Nhập mã đó vào các ô dưới đây.
                </p>
                {otpError && <div className="lg-error" role="alert">{otpError}</div>}
                <OtpBoxes value={otpCode} onChange={(v) => { setOtpCode(v); setOtpError(''); }} disabled={otpLoading} />
                <div className="lg-resend">
                  {otpCountdown > 0 ? (
                    <span>Có thể gửi lại mã sau <strong>{otpCountdown} giây</strong></span>
                  ) : (
                    <button type="button" className="lg-textbtn" disabled={otpLoading} onClick={handleResendOtp}>
                      <RotateCcw size={14} aria-hidden="true" /> {otpLoading ? 'Đang gửi…' : 'Gửi lại mã qua SMS'}
                    </button>
                  )}
                </div>
                <div className="lg-actions">
                  <button type="button" className="lg-btn lg-btn-ghost lg-back" onClick={() => { setRegStep('form'); setOtpError(''); }}>
                    <ArrowLeft size={16} aria-hidden="true" /> Sửa thông tin
                  </button>
                  <button type="submit" className="lg-btn lg-btn-primary" disabled={otpLoading || otpCode.length !== 6}>
                    {otpLoading ? 'Đang xác thực…' : <><KeyRound size={16} aria-hidden="true" /> Xác nhận và hoàn tất</>}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleInitiateRegister} noValidate>
                <p className="lg-info">
                  <Info size={16} aria-hidden="true" />
                  <span>{activeModal === 'officer'
                    ? 'Sau khi xác minh số điện thoại, hồ sơ được gửi tới Quản trị viên. Bạn chỉ đăng nhập được khi hồ sơ được duyệt.'
                    : 'Chúng tôi gửi mã OTP qua SMS để xác minh số điện thoại nhận cảnh báo khẩn cấp.'}</span>
                </p>
                {regError && <div className="lg-error" role="alert">{regError}</div>}

                <fieldset className="lg-group">
                  <legend>Thông tin cá nhân</legend>
                  <label className="lg-label" htmlFor="rg-name">Họ và tên</label>
                  <div className="lg-field">
                    <User size={18} aria-hidden="true" />
                    <input id="rg-name" className="lg-input" type="text" value={regFullName} onChange={(e) => setRegFullName(e.target.value)}
                      placeholder={activeModal === 'officer' ? 'Nguyễn Văn Huy' : 'Hoàng Văn Dũng'} autoComplete="name" />
                  </div>
                  <label className="lg-label" htmlFor="rg-email">Email</label>
                  <div className="lg-field">
                    <Mail size={18} aria-hidden="true" />
                    <input id="rg-email" className="lg-input" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="ten@email.com" autoComplete="email" />
                  </div>
                </fieldset>

                <fieldset className="lg-group">
                  <legend>{activeModal === 'officer' ? 'Số điện thoại và đơn vị' : 'Số điện thoại và khu vực'}</legend>
                  <label className="lg-label" htmlFor="rg-phone">Số điện thoại nhận mã OTP</label>
                  <div className="lg-field">
                    <Phone size={18} aria-hidden="true" />
                    <input id="rg-phone" className="lg-input" type="tel" inputMode="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="0912345678" autoComplete="tel" aria-describedby="rg-phone-hint" />
                  </div>
                  <p id="rg-phone-hint" className="lg-helper">Số di động Việt Nam, ví dụ 0912345678. Mã OTP gửi qua SMS tới số này.</p>
                  {activeModal === 'officer' ? (
                    <>
                      <label className="lg-label" htmlFor="rg-unit">Đơn vị công tác</label>
                      <div className="lg-field">
                        <Building2 size={18} aria-hidden="true" />
                        <input id="rg-unit" className="lg-input" type="text" value={regUnit} onChange={(e) => setRegUnit(e.target.value)}
                          placeholder="Chi cục Thủy lợi & PCTT Tỉnh Yên Bái" autoComplete="organization" />
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="lg-label" htmlFor="rg-area">Khu vực muốn nhận cảnh báo (tùy chọn)</label>
                      <div className="lg-field">
                        <MapPin size={18} aria-hidden="true" />
                        <input id="rg-area" className="lg-input" type="text" value={regArea} onChange={(e) => setRegArea(e.target.value)}
                          placeholder="Bản Lìm Mông, xã Cao Phạ, huyện Mù Cang Chải" aria-describedby="rg-area-hint" />
                      </div>
                      <p id="rg-area-hint" className="lg-helper">Bạn chọn vùng nhận cảnh báo chi tiết trong ứng dụng sau khi đăng ký.</p>
                    </>
                  )}
                </fieldset>

                <fieldset className="lg-group">
                  <legend>Mật khẩu</legend>
                  <div className="lg-two">
                    <div>
                      <label className="lg-label" htmlFor="rg-pw">Mật khẩu</label>
                      <div className="lg-field">
                        <Lock size={18} aria-hidden="true" />
                        <input id="rg-pw" className="lg-input lg-has-eye" type={showPw ? 'text' : 'password'} value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)} placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" />
                        <button type="button" className="lg-eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                          {showPw ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="lg-label" htmlFor="rg-pw2">Nhập lại mật khẩu</label>
                      <div className="lg-field">
                        <Lock size={18} aria-hidden="true" />
                        <input id="rg-pw2" className="lg-input" type={showPw ? 'text' : 'password'} value={regConfirmPassword}
                          onChange={(e) => setRegConfirmPassword(e.target.value)} placeholder="Nhập lại" autoComplete="new-password" />
                      </div>
                    </div>
                  </div>
                  {regConfirmPassword && (
                    <p className={regPassword === regConfirmPassword ? 'lg-match lg-match-ok' : 'lg-match lg-match-bad'} role="status">
                      {regPassword === regConfirmPassword ? 'Mật khẩu khớp.' : 'Hai mật khẩu chưa khớp.'}
                    </p>
                  )}
                </fieldset>

                <div className="lg-actions">
                  <button type="button" className="lg-btn lg-btn-ghost lg-back" onClick={closeRegisterModal}>Hủy</button>
                  <button type="submit" className="lg-btn lg-btn-primary" disabled={regLoading}>
                    {regLoading ? 'Đang gửi mã OTP…' : <>Tiếp tục: nhận mã OTP <ArrowRight size={18} aria-hidden="true" /></>}
                  </button>
                </div>
              </form>
            )}
            </div>
            </AutoHeight>
          </div>
        </div>
      )}

      {/* Phần tử container gắn reCAPTCHA ẩn cho Firebase */}
      <div id="recaptcha-container"></div>
    </div>
  );
}
