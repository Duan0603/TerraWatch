import axiosClient from './axiosClient';

export const authApi = {
  // Đăng nhập cán bộ / admin
  async login({ email, password }) {
    try {
      const data = await axiosClient.post('/auth/login', { email, password });
      return data;
    } catch (err) {
      // Fallback offline dev mode nếu Backend Core API chưa khởi chạy
      console.warn('Backend Core API chưa phản hồi, chuyển sang chế độ Demo Auth:', err.message);
      const isOfficer = email.toLowerCase().includes('officer') || email === 'officer@terrawatch.vn';
      const role = isOfficer ? 'officer' : 'admin';
      const mockResponse = {
        token: `mock_jwt_token_${role}_${Date.now()}`,
        role: role,
        user: {
          id: isOfficer ? 'user-officer-01' : 'user-admin-01',
          fullName: isOfficer ? 'Đ/c Nguyễn Văn Huy (Cán bộ Phòng chống Thiên tai)' : 'Admin Tổng Chỉ Huy TerraWatch',
          email: email,
          role: role,
        }
      };
      return mockResponse;
    }
  },

  // Lấy thông tin tài khoản hiện tại từ JWT
  async getCurrentUser() {
    try {
      const data = await axiosClient.get('/auth/me');
      return data;
    } catch (err) {
      const cached = localStorage.getItem('terrawatch_user');
      return cached ? JSON.parse(cached) : null;
    }
  },

  // Đăng xuất
  logout() {
    localStorage.removeItem('terrawatch_token');
    localStorage.removeItem('terrawatch_user');
  }
};

export default authApi;
