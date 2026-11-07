import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail, Phone, RotateCcw } from 'lucide-react';
import authApi from '../api/authApi';
import FormSteps from './FormSteps';
import OtpBoxes from './OtpBoxes';

// Quên mật khẩu: chứng minh là chủ tài khoản bằng mã 6 số gửi qua EMAIL (Story 4.21, mặc định, miễn phí)
// hoặc qua SMS tới số đã đăng ký (Story 4.20, cần Firebase Blaze cho số thật).
// Thứ tự: 1 tài khoản -> 2 nhập mã (đúng rồi mới sang bước sau) -> 3 đặt mật khẩu mới -> 4 xong.
export default function ForgotPasswordPanel({ initialEmail, onBack }) {
  const [step, setStep] = useState('form'); // form | otp | newpw | done
  const [method, setMethod] = useState('email'); // email | sms
  const [proof, setProof] = useState(''); // chứng cứ (token từ máy chủ hoặc token Firebase), có sau khi mã đúng
  const [email, setEmail] = useState(initialEmail || '');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  useEffect(() => {
    if (step !== 'otp' || countdown <= 0) return undefined;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [step, countdown]);

  const current = { form: 1, otp: 2, newpw: 3, done: 4 }[step];

  const sendOtp = async (e) => {
    e?.preventDefault();
    setError('');
    const cleanPhone = phone.replace(/\s+/g, '');
    if (!email.trim()) { setError('Vui lòng nhập email tài khoản.'); return; }
    if (method === 'sms' && cleanPhone.length < 9) { setError('Vui lòng nhập số điện thoại đã đăng ký.'); return; }
    try {
      setLoading(true);
      if (method === 'email') {
        await authApi.requestEmailCode(email);
        setSentTo(email.trim());
      } else {
        // Hỏi trước: sai email/SĐT thì không tốn một tin nhắn OTP.
        if (!(await authApi.canResetPassword(email, cleanPhone))) {
          setError('Email và số điện thoại này không khớp với tài khoản nào có thể đặt lại mật khẩu. Hãy nhập đúng số đã dùng khi đăng ký.');
          return;
        }
        const res = await authApi.sendSmsOtp(cleanPhone, 'recaptcha-container');
        setSentTo(res.formattedPhone || cleanPhone);
      }
      setOtp('');
      setCountdown(60);
      setStep('otp');
    } catch (err) {
      setError(method === 'email' ? err.message : 'Không thể gửi mã OTP SMS: ' + (err.message || 'Vui lòng thử lại.'));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (countdown > 0 || loading) return;
    try {
      setLoading(true);
      setError('');
      if (method === 'email') {
        await authApi.requestEmailCode(email);
      } else {
        const res = await authApi.sendSmsOtp(phone.replace(/\s+/g, ''), 'recaptcha-container');
        setSentTo(res.formattedPhone || phone);
      }
      setCountdown(60);
    } catch (err) {
      setError(method === 'email' ? err.message : 'Không thể gửi lại mã OTP: ' + (err.message || 'Vui lòng thử lại sau.'));
    } finally {
      setLoading(false);
    }
  };

  const confirmOtp = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setLoading(true);
      if (method === 'email') {
        setProof(await authApi.verifyEmailCode(email, otp));
      } else {
        const verified = await authApi.verifySmsOtp(phone.replace(/\s+/g, ''), otp);
        setProof(verified.idToken || (await verified.user?.getIdToken?.()));
      }
      setError('');
      setStep('newpw'); // OTP đúng rồi mới được đặt mật khẩu mới
    } catch (err) {
      setError(err.message || 'Mã OTP không chính xác hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  const saveNewPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Mật khẩu mới phải có tối thiểu 8 ký tự.'); return; }
    if (password !== confirm) { setError('Hai mật khẩu chưa khớp.'); return; }
    try {
      setLoading(true);
      if (method === 'email') {
        await authApi.completeEmailReset({ email, resetToken: proof, newPassword: password });
      } else {
        await authApi.resetPassword({ email, phoneNumber: phone.replace(/\s+/g, ''), phoneToken: proof, newPassword: password });
      }
      setPassword('');
      setConfirm('');
      setStep('done');
    } catch (err) {
      setError(err.message || 'Không đặt lại được mật khẩu.');
      // Mã OTP hết hạn / không hợp lệ: quay về bước đầu để lấy mã mới.
      if (/OTP|mã|hết hạn/i.test(err.message || '')) setStep('form');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" className="lg-backlink" onClick={() => onBack()}>
        <ArrowLeft size={16} aria-hidden="true" /> Quay lại đăng nhập
      </button>
      <div className="lg-modal-head">
        <span className="lg-modal-icon" aria-hidden="true"><KeyRound size={22} /></span>
        <div className="lg-modal-titles">
          <h2 id="lg-forgot-title">Quên mật khẩu</h2>
          <p>Xác minh bằng mã 6 số gửi tới email hoặc số điện thoại của tài khoản</p>
        </div>
      </div>
      <FormSteps current={current} labels={['Tài khoản', 'Mã OTP', 'Mật khẩu mới', 'Hoàn tất']} ariaLabel="Các bước đặt lại mật khẩu" />

      <div key={step} className="lg-pane lg-pane-fwd">
        {step === 'done' && (
          <div className="lg-done">
            <span className="lg-done-icon" aria-hidden="true"><CheckCircle2 size={40} /></span>
            <h3>Đã đặt lại mật khẩu</h3>
            <p>Bạn có thể đăng nhập bằng mật khẩu mới. Phiên đăng nhập cũ (nếu có) vẫn dùng được tới khi hết hạn.</p>
            <button type="button" className="lg-btn lg-btn-primary" onClick={() => onBack(email)}>Đăng nhập ngay</button>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={sendOtp} noValidate>
            <div className="lg-tabs" role="tablist" aria-label="Cách nhận mã xác nhận">
              <button type="button" role="tab" aria-selected={method === 'email'} className={`lg-tab${method === 'email' ? ' is-on' : ''}`}
                onClick={() => { setMethod('email'); setError(''); }}><Mail size={16} aria-hidden="true" /> Nhận mã qua email</button>
              <button type="button" role="tab" aria-selected={method === 'sms'} className={`lg-tab${method === 'sms' ? ' is-on' : ''}`}
                onClick={() => { setMethod('sms'); setError(''); }}><Phone size={16} aria-hidden="true" /> Nhận mã qua SMS</button>
            </div>
            <p className="lg-info">
              <Lock size={16} aria-hidden="true" />
              <span>{method === 'email'
                ? 'Nhập email tài khoản. Chúng tôi gửi mã 6 số vào hộp thư của bạn; nhập đúng mã rồi bạn mới được đặt mật khẩu mới.'
                : 'Nhập email và số điện thoại bạn đã dùng khi đăng ký. Chúng tôi gửi mã OTP qua SMS; nhập đúng mã rồi bạn mới được đặt mật khẩu mới.'}</span>
            </p>
            {error && <div className="lg-error" role="alert">{error}</div>}
            <label className="lg-label" htmlFor="fp-email">Email tài khoản</label>
            <div className="lg-field">
              <Mail size={18} aria-hidden="true" />
              <input id="fp-email" className="lg-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="ten@email.com" autoComplete="username" />
            </div>
            {method === 'sms' && (
              <>
                <label className="lg-label" htmlFor="fp-phone">Số điện thoại đã đăng ký</label>
                <div className="lg-field">
                  <Phone size={18} aria-hidden="true" />
                  <input id="fp-phone" className="lg-input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="0912345678" autoComplete="tel" />
                </div>
              </>
            )}
            <div className="lg-actions">
              <button type="submit" className="lg-btn lg-btn-primary" disabled={loading}>
                {loading ? 'Đang gửi…' : <>{method === 'email' ? 'Gửi mã qua email' : 'Gửi mã OTP'} <ArrowRight size={18} aria-hidden="true" /></>}
              </button>
            </div>
          </form>
        )}

        {step === 'newpw' && (
          <form onSubmit={saveNewPassword} noValidate>
            <p className="lg-info">
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>{method === 'email' ? 'Đã xác minh mã.' : 'Đã xác minh số điện thoại.'} Hãy đặt mật khẩu mới cho <strong>{email}</strong>.</span>
            </p>
            {error && <div className="lg-error" role="alert">{error}</div>}
            <div className="lg-two">
              <div>
                <label className="lg-label" htmlFor="fp-pw">Mật khẩu mới</label>
                <div className="lg-field">
                  <Lock size={18} aria-hidden="true" />
                  <input id="fp-pw" autoFocus className="lg-input lg-has-eye" type={showPw ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" />
                  <button type="button" className="lg-eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                    {showPw ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="lg-label" htmlFor="fp-pw2">Nhập lại</label>
                <div className="lg-field">
                  <Lock size={18} aria-hidden="true" />
                  <input id="fp-pw2" className="lg-input" type={showPw ? 'text' : 'password'} value={confirm}
                    onChange={(e) => setConfirm(e.target.value)} placeholder="Nhập lại" autoComplete="new-password" />
                </div>
              </div>
            </div>
            {confirm && (
              <p className={password === confirm ? 'lg-match lg-match-ok' : 'lg-match lg-match-bad'} role="status">
                {password === confirm ? 'Mật khẩu khớp.' : 'Hai mật khẩu chưa khớp.'}
              </p>
            )}
            <div className="lg-actions">
              <button type="submit" className="lg-btn lg-btn-primary" disabled={loading}>
                {loading ? 'Đang lưu…' : <><KeyRound size={16} aria-hidden="true" /> Đổi mật khẩu</>}
              </button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={confirmOtp} noValidate>
            <p className="lg-otp-lead">
              {method === 'email'
                ? <>Nếu <strong>{sentTo}</strong> có tài khoản, mã 6 chữ số đã được gửi tới hộp thư (xem cả thư mục Spam). Mã có hiệu lực 10 phút. Nhập mã vào các ô dưới đây.</>
                : <>Chúng tôi đã gửi tin nhắn SMS chứa mã 6 chữ số tới <strong>{sentTo}</strong>. Nhập mã đó vào các ô dưới đây.</>}
            </p>
            {error && <div className="lg-error" role="alert">{error}</div>}
            <OtpBoxes value={otp} onChange={(v) => { setOtp(v); setError(''); }} disabled={loading} />
            <div className="lg-resend">
              {countdown > 0 ? (
                <span>Có thể gửi lại mã sau <strong>{countdown} giây</strong></span>
              ) : (
                <button type="button" className="lg-textbtn" disabled={loading} onClick={resend}>
                  <RotateCcw size={14} aria-hidden="true" /> {loading ? 'Đang gửi…' : (method === 'email' ? 'Gửi lại mã qua email' : 'Gửi lại mã qua SMS')}
                </button>
              )}
            </div>
            <div className="lg-actions">
              <button type="button" className="lg-btn lg-btn-ghost lg-back" onClick={() => { setStep('form'); setError(''); }}>
                <ArrowLeft size={16} aria-hidden="true" /> Sửa thông tin
              </button>
              <button type="submit" className="lg-btn lg-btn-primary" disabled={loading || otp.length !== 6}>
                {loading ? 'Đang xác thực…' : <><KeyRound size={16} aria-hidden="true" /> Xác nhận mã OTP</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
