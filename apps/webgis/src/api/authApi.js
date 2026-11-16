import axiosClient from './axiosClient';
import { registerErrorMessage, resetErrorMessage } from './registerError';
// Story 4.44: the phone code is made and texted by our own server (SMS Gateway on a phone), not Firebase:
// no reCAPTCHA and no Firebase billing. The last right code is remembered so a retry after a failed sign-up
// (e.g. weak password) does not need a new SMS.
let lastVerified = null;
const otpError = (err, fallback) => err.response?.data?.message || (err.response ? fallback : 'Không kết nối được máy chủ. Thử lại sau.');

// Chuyển đổi định dạng số điện thoại Việt Nam sang chuẩn quốc tế E.164 (+84...)
export const formatToE164 = (phone) => {
  let cleaned = (phone || '').trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '+84' + cleaned.substring(1);
  } else if (!cleaned.startsWith('+')) {
    cleaned = '+84' + cleaned;
  }
  return cleaned;
};

export const authApi = {
  // Đăng nhập cán bộ / admin — xác thực thật qua Core API, trả về role thật từ JWT
  async login({ email, password }) {
    try {
      const data = await axiosClient.post('/auth/login', { email, password });
      return data;
    } catch (err) {
      // Mọi lỗi (sai mật khẩu, mất kết nối...) là lỗi thật: không giả lập phiên đăng nhập.
      throw err;
    }
  },

  // Lấy thông tin tài khoản hiện tại từ JWT
  async getCurrentUser() {
    try {
      const data = await axiosClient.get('/auth/me');
      return data;
    } catch (err) {
      // Token thật đã bị từ chối (hết hạn/không hợp lệ) — không âm thầm trả dữ liệu cache cũ,
      // để AuthContext/axios interceptor xử lý đăng xuất đúng theo lỗi thật.
      if (err.response) {
        throw err;
      }
      const cached = localStorage.getItem('terrawatch_user');
      return cached ? JSON.parse(cached) : null;
    }
  },

  // Gửi mã OTP 6 số tới số điện thoại thật (Story 4.44: máy chủ tự gửi SMS)
  async sendSmsOtp(phoneNumber) {
    const formatted = formatToE164(phoneNumber);
    try {
      await axiosClient.post('/auth/phone-otp/request', { phoneNumber: formatted });
    } catch (err) {
      throw new Error(otpError(err, 'Chưa gửi được mã xác thực.'));
    }
    lastVerified = null;
    return { success: true, isRealSms: true, formattedPhone: formatted, message: `Mã xác thực đã được gửi tới ${formatted}` };
  },

  // Kiểm tra mã trong SMS; đúng thì máy chủ trả phoneToken dùng một lần để đăng ký / đặt lại mật khẩu.
  async verifySmsOtp(phoneNumber, otpCode) {
    const phone = formatToE164(phoneNumber);
    const code = String(otpCode || '').trim();
    if (lastVerified?.phone === phone && lastVerified.code === code) return { success: true, idToken: lastVerified.token };
    try {
      const res = await axiosClient.post('/auth/phone-otp/verify', { phoneNumber: phone, code });
      lastVerified = { phone, code, token: res.phoneToken };
      return { success: true, idToken: res.phoneToken, message: 'Đã xác thực số điện thoại.' };
    } catch (err) {
      throw new Error(otpError(err, 'Mã OTP không chính xác hoặc đã hết hạn.'));
    }
  },

  // Story 4.19: báo trùng email ngay ở bước nhập thông tin, trước khi tốn một tin nhắn OTP.
  // Lỗi mạng thì coi như "chưa biết" (false): lúc đăng ký máy chủ vẫn chặn email trùng bằng 409.
  async emailExists(email) {
    try {
      const data = await axiosClient.get('/auth/email-exists', { params: { email: email.trim() } });
      return data?.exists === true;
    } catch {
      return false;
    }
  },

  // Story 4.21: quên mật khẩu bằng mã 6 số gửi qua email (không tốn SMS, không cần Firebase Blaze).
  async requestEmailCode(email) {
    try {
      await axiosClient.post('/auth/password-reset/email/request', { email: email.trim() });
    } catch (err) {
      throw new Error(resetErrorMessage(err));
    }
  },

  async verifyEmailCode(email, code) {
    try {
      const data = await axiosClient.post('/auth/password-reset/email/verify', { email: email.trim(), code });
      return data.resetToken;
    } catch (err) {
      throw new Error(resetErrorMessage(err));
    }
  },

  async completeEmailReset({ email, resetToken, newPassword }) {
    try {
      await axiosClient.post('/auth/password-reset/email/complete', { email: email.trim(), resetToken, newPassword });
    } catch (err) {
      throw new Error(resetErrorMessage(err));
    }
  },

  // Story 4.20: quên mật khẩu bằng OTP của số điện thoại đã đăng ký.
  // Hỏi trước xem email + SĐT có khớp một tài khoản không, để sai thì không tốn tin nhắn OTP.
  async canResetPassword(email, phoneNumber) {
    try {
      const data = await axiosClient.post('/auth/password-reset/check', { email: email.trim(), phoneNumber });
      return data?.eligible === true;
    } catch {
      return false;
    }
  },

  async resetPassword({ email, phoneNumber, phoneToken, newPassword }) {
    try {
      await axiosClient.post('/auth/password-reset', { email: email.trim(), phoneNumber, phoneToken, newPassword });
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || '';
      if (!err.response) throw new Error('Không kết nối được máy chủ. Thử lại sau.');
      if (/token/i.test(message)) throw new Error('Mã OTP không hợp lệ hoặc đã hết hạn. Hãy gửi lại mã.');
      if (status === 400) throw new Error(message || 'Thông tin chưa hợp lệ.');
      throw new Error(`Không đặt lại được mật khẩu (mã lỗi ${status}).`);
    }
  },

  // Story 4.8: gửi hồ sơ cán bộ (cần SĐT đã xác minh OTP). Tài khoản ở trạng thái "chờ duyệt"
  // cho tới khi quản trị viên phê duyệt; requestId là mã thật do máy chủ trả về.
  async registerOfficerRequest(data) {
    try {
      return await axiosClient.post('/auth/officer-requests', data);
    } catch (err) {
      throw new Error(registerErrorMessage(err));
    }
  },

  // Đăng ký tài khoản Công dân (Nhận cảnh báo SMS/Push - UC07)
  // Backend luôn tạo role = citizen (Story 1.1 AC1) nên web không gửi `role`.
  async registerCitizen(data) {
    // Mọi lỗi (409 email trùng, 400 dữ liệu sai, mất mạng) đều báo rõ cho người dùng: không có tài khoản giả.
    try {
      return await axiosClient.post('/auth/register', data);
    } catch (err) {
      throw new Error(registerErrorMessage(err));
    }
  },

  // Đăng xuất
  logout() {
    localStorage.removeItem('terrawatch_token');
    localStorage.removeItem('terrawatch_user');
  }
};

export default authApi;
