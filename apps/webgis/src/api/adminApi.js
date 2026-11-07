import axiosClient from './axiosClient';

export const adminApi = {
  // Lấy danh sách người dùng kèm bộ lọc tìm kiếm và trạng thái
  async getUsers(params = {}) {
    return axiosClient.get('/admin/users', { params });
  },

  // Khóa hoặc mở khóa tài khoản người dùng
  async updateUserStatus(userId, isActive) {
    return axiosClient.patch(`/admin/users/${userId}/status`, { isActive });
  },

  // Phân quyền vai trò người dùng (admin, officer, citizen)
  async updateUserRole(userId, role) {
    return axiosClient.patch(`/admin/users/${userId}/role`, { role });
  },

  // Phê duyệt tài khoản cán bộ
  async approveOfficer(userId) {
    return axiosClient.post(`/admin/users/${userId}/approve`);
  },

  // Từ chối phê duyệt tài khoản cán bộ
  async rejectOfficer(userId) {
    return axiosClient.post(`/admin/users/${userId}/reject`);
  }
};

export default adminApi;
