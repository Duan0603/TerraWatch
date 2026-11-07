import axiosClient from './axiosClient';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../config/firebase';

let confirmationResult = null;

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

// Khởi tạo reCAPTCHA ẩn cho Firebase Phone Auth
export const getOrCreateRecaptcha = async (containerId = 'recaptcha-container') => {
  let host = document.getElementById(containerId);
  if (!host) {
    host = document.createElement('div');
    host.id = containerId;
    host.style.position = 'fixed';
    host.style.bottom = '0';
    host.style.left = '0';
    host.style.zIndex = '-1';
    document.body.appendChild(host);
  }

  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (e) {
      // bỏ qua lỗi nếu đã giải phóng
    }
    window.recaptchaVerifier = null;
  }

  // reCAPTCHA chỉ render được một lần vào mỗi phần tử: mỗi lần gửi (gửi lại) dùng một phần tử mới,
  // nếu không lần thứ hai báo "reCAPTCHA has already been rendered in this element".
  host.replaceChildren();
  const element = document.createElement('div');
  host.appendChild(element);

  window.recaptchaVerifier = new RecaptchaVerifier(auth, element, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA hoàn tất tự động
    }
  });

  await window.recaptchaVerifier.render();
  return window.recaptchaVerifier;
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

  // Gửi mã OTP xác thực số điện thoại THẬT qua Firebase Phone Auth
  async sendSmsOtp(phoneNumber, containerId = 'recaptcha-container') {
    const formatted = formatToE164(phoneNumber);
    if (!auth) {
      throw new Error('Xác thực số điện thoại chưa được cấu hình cho web (thiếu VITE_FIREBASE_*). Chưa có mã OTP nào được gửi.');
    }
    try {
      const verifier = await getOrCreateRecaptcha(containerId);
      const conf = await signInWithPhoneNumber(auth, formatted, verifier);
      confirmationResult = conf;
      window.confirmationResult = conf;

      return {
        success: true,
        isRealSms: true,
        formattedPhone: formatted,
        message: `Mã OTP đã được Google Firebase gửi về số điện thoại thực tế: ${formatted}`
      };
    } catch (err) {
      console.error('Firebase Phone Auth báo lỗi chi tiết:', err);
      let humanMsg = err.message;
      if (err.code === 'auth/invalid-phone-number') {
        humanMsg = 'Số điện thoại không đúng định dạng quốc tế (VD: 0865396352).';
      } else if (err.code === 'auth/too-many-requests') {
        humanMsg = 'Đã đạt hạn mức SMS tối đa trong ngày của Firebase (10 SMS/ngày).';
      } else if (err.code === 'auth/quota-exceeded') {
        humanMsg = 'Dự án đã sử dụng hết hạn mức SMS.';
      } else if (err.code === 'auth/argument-error') {
        humanMsg = 'Lỗi cấu hình phần tử reCAPTCHA: ' + err.message;
      }

      // Không có mã OTP dự phòng: một mã hiện trên màn hình thì không xác thực được số điện thoại nào.
      throw new Error(humanMsg);
    }
  },

  // Xác thực mã OTP bằng Firebase; chỉ mã trong tin nhắn SMS thật mới hợp lệ.
  async verifySmsOtp(phoneNumber, otpCode) {
    const conf = confirmationResult || window.confirmationResult;
    if (!conf) {
      throw new Error('Chưa có mã OTP nào được gửi tới số này. Vui lòng bấm gửi lại mã.');
    }
    try {
      const res = await conf.confirm(otpCode);
      const idToken = await res.user?.getIdToken?.();
      return {
        success: true,
        user: res.user,
        idToken,
        isRealSms: true,
        message: 'Xác thực số điện thoại thật qua SMS Firebase thành công!'
      };
    } catch (err) {
      if (err.code === 'auth/invalid-verification-code') {
        throw new Error('Mã OTP không đúng với tin nhắn SMS gửi về điện thoại của bạn.');
      } else if (err.code === 'auth/code-expired') {
        throw new Error('Mã OTP trong tin nhắn SMS đã hết hạn. Vui lòng bấm gửi lại mã mới.');
      }
      throw new Error(err.message || 'Mã OTP không chính xác.');
    }
  },

  // Không có đăng ký cán bộ công khai (Story 1.1 AC1): tài khoản officer/admin do quản trị viên tạo.
  // Trước đây hàm này giả vờ thành công với mã hồ sơ bịa; giờ báo đúng sự thật.
  async registerOfficerRequest() {
    throw new Error('Tài khoản cán bộ do quản trị viên cấp trực tiếp; hệ thống chưa nhận đăng ký cán bộ trực tuyến.');
  },

  // Đăng ký tài khoản Công dân (Nhận cảnh báo SMS/Push - UC07)
  // Backend luôn tạo role = citizen (Story 1.1 AC1) nên web không gửi `role`.
  async registerCitizen(data) {
    // Mọi lỗi (409 email trùng, 400 dữ liệu sai, mất mạng) đều báo rõ cho người dùng: không có tài khoản giả.
    try {
      return await axiosClient.post('/auth/register', data);
    } catch (err) {
      const status = err.response?.status;
      const serverMessage = err.response?.data?.message;
      if (status === 409) throw new Error('Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.');
      if (status === 400 && /phone number must be verified|verification token/i.test(serverMessage || '')) {
        throw new Error('Số điện thoại chưa được xác minh bằng mã OTP. Vui lòng gửi lại mã và nhập đúng.');
      }
      if (status === 400) throw new Error(serverMessage || 'Thông tin đăng ký chưa hợp lệ.');
      if (!err.response) throw new Error('Không kết nối được máy chủ. Vui lòng thử lại sau.');
      throw new Error(`Đăng ký không thành công (mã lỗi ${status}).`);
    }
  },

  // Đăng xuất
  logout() {
    localStorage.removeItem('terrawatch_token');
    localStorage.removeItem('terrawatch_user');
  }
};

export default authApi;
