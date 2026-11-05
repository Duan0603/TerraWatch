import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export const axiosClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: tự động gắn Authorization header nếu có JWT token
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('terrawatch_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: bóc tách dữ liệu và xử lý lỗi phân quyền 401
axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('terrawatch_token');
      localStorage.removeItem('terrawatch_user');
      // Dùng custom event thay vì hard-redirect để React Router xử lý điều hướng đúng cách
      // và ReviewDialog có thể hiện thông báo lỗi trước khi chuyển trang
      if (window.location.pathname !== '/login') {
        window.dispatchEvent(new CustomEvent('tw:auth-expired'));
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
