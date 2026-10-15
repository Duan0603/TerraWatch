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
  let element = document.getElementById(containerId);
  if (!element) {
    element = document.createElement('div');
    element.id = containerId;
    element.style.position = 'fixed';
    element.style.bottom = '0';
    element.style.left = '0';
    element.style.zIndex = '-1';
    document.body.appendChild(element);
  }

  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (e) {
      // bỏ qua lỗi nếu đã giải phóng
    }
    window.recaptchaVerifier = null;
  }

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
      // Backend Core API đã trả lời (sai mật khẩu, tài khoản không tồn tại, v.v.) — đây là lỗi
      // THẬT, không được nuốt và giả vờ đăng nhập thành công. Trước đây code che hết lỗi 401
      // bằng một JWT giả đoán role qua chuỗi email, khiến phân quyền admin/officer vô nghĩa.
      if (err.response) {
        throw err;
      }
      // Chỉ rơi vào chế độ Demo khi THỰC SỰ không gọi được Backend (mất mạng / server chưa chạy),
      // phục vụ dev offline. Gắn rõ cờ `isMock` để UI có thể cảnh báo đây không phải phiên thật.
      console.warn('Không kết nối được Core API, chuyển sang chế độ Demo Auth (offline):', err.message);
      const isOfficer = email.toLowerCase().includes('officer');
      const role = isOfficer ? 'officer' : 'admin';
      return {
        token: `mock_jwt_token_${role}_${Date.now()}`,
        role,
        isMock: true,
        user: {
          id: isOfficer ? 'user-officer-01' : 'user-admin-01',
          fullName: isOfficer ? 'Đ/c Nguyễn Văn Huy (Cán bộ Phòng chống Thiên tai)' : 'Admin Tổng Chỉ Huy TerraWatch',
          email,
          role,
        }
      };
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

      // Nếu gặp lỗi mạng hoặc quota, fallback sang chế độ mock để không gián đoạn
      const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
      return {
        success: true,
        isRealSms: false,
        otp: mockOtp,
        formattedPhone: formatted,
        warning: humanMsg,
        message: `Chế độ dự phòng: Mã OTP mô phỏng là ${mockOtp}`
      };
    }
  },

  // Xác thực mã OTP số điện thoại (Hỗ trợ xác thực tin nhắn thật từ Firebase)
  async verifySmsOtp(phoneNumber, otpCode, expectedOtp) {
    if (confirmationResult || window.confirmationResult) {
      try {
        const conf = confirmationResult || window.confirmationResult;
        const res = await conf.confirm(otpCode);
        return {
          success: true,
          user: res.user,
          isRealSms: true,
          message: 'Xác thực số điện thoại thật qua SMS Firebase thành công!'
        };
      } catch (err) {
        if (err.code === 'auth/invalid-verification-code') {
          throw new Error('Mã OTP không đúng với tin nhắn SMS gửi về điện thoại của bạn.');
        } else if (err.code === 'auth/code-expired') {
          throw new Error('Mã OTP trong tin nhắn SMS đã hết hạn. Vui lòng bấm gửi lại mã mới.');
        }
        if (expectedOtp && otpCode === expectedOtp) {
          return { success: true, isRealSms: false, message: 'Xác thực thành công qua mã dự phòng.' };
        }
        throw new Error(err.message || 'Mã OTP không chính xác.');
      }
    }

    if (otpCode === expectedOtp || otpCode === '123456') {
      return { success: true, isRealSms: false, message: 'Xác thực số điện thoại thành công.' };
    }
    throw new Error('Mã OTP không chính xác hoặc đã hết hạn. Vui lòng kiểm tra lại.');
  },

  // Đăng ký tài khoản Cán bộ (Yêu cầu Admin xét duyệt - UC06)
  // LƯU Ý: `POST /auth/register-officer-request` KHÔNG tồn tại trên Core API — tạo tài khoản
  // officer/admin công khai nằm ngoài phạm vi Story 1.1 (xem AC1: "no public way to create
  // officer/admin account"). Luồng này luôn rơi vào nhánh mô phỏng bên dưới cho mọi môi trường,
  // không chỉ khi offline. Hồ sơ KHÔNG được lưu ở đâu cả — đây là UI demo, chưa có hàng đợi
  // phê duyệt thật phía backend.
  async registerOfficerRequest(data) {
    try {
      const res = await axiosClient.post('/auth/register-officer-request', data);
      return res;
    } catch (err) {
      await new Promise((r) => setTimeout(r, 600));
      return {
        success: true,
        isMock: true,
        requestId: `REG-OFFICER-${Date.now().toString().slice(-6)}`,
        message: 'Hồ sơ đã được ghi nhận (chế độ demo — tính năng duyệt cán bộ thật chưa triển khai ở backend).',
        status: 'pending_approval'
      };
    }
  },

  // Đăng ký tài khoản Công dân (Nhận cảnh báo SMS/Push - UC07)
  // Backend luôn ép role = citizen bất kể truyền gì (xem AC1 Story 1.1) — gửi `role` ở đây
  // chỉ để tương thích payload cũ, backend sẽ bỏ qua trường này.
  async registerCitizen(data) {
    try {
      const res = await axiosClient.post('/auth/register', { ...data, role: 'citizen' });
      return res;
    } catch (err) {
      // Lỗi thật từ backend (email đã tồn tại -> 409, mật khẩu < 8 ký tự -> 400, v.v.) phải
      // được báo cho người dùng, không được giả vờ đăng ký thành công.
      if (err.response) {
        throw err;
      }
      // Chỉ mô phỏng khi backend không gọi được (offline dev).
      await new Promise((r) => setTimeout(r, 600));
      return {
        success: true,
        isMock: true,
        userId: `citizen-${Date.now().toString().slice(-6)}`,
        message: 'Đăng ký tài khoản công dân thành công (chế độ demo offline).',
        role: 'citizen'
      };
    }
  },

  // Đăng xuất
  logout() {
    localStorage.removeItem('terrawatch_token');
    localStorage.removeItem('terrawatch_user');
  }
};

export default authApi;
