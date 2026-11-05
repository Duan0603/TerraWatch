import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import authApi from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('terrawatch_token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('terrawatch_user');
    return saved ? JSON.parse(saved) : null;
  });
  const navigate = useNavigate();

  const isAuthenticated = !!token;
  // Không đoán/mặc định role: nếu thiếu role thật từ backend, coi như chưa xác định quyền
  const role = user?.role || null;

  const logout = useCallback(() => {
    authApi.logout();
    localStorage.removeItem('terrawatch_token');
    localStorage.removeItem('terrawatch_user');
    setToken(null);
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  // Lắng nghe event khi axiosClient nhận 401 — logout sạch qua React Router thay vì hard redirect
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('tw:auth-expired', handler);
    return () => window.removeEventListener('tw:auth-expired', handler);
  }, [logout]);

  const login = async (email, password) => {
    const data = await authApi.login({ email, password });
    const jwtToken = data.token || data.accessToken;
    // Role luôn lấy từ backend; không đoán từ email.
    const userData = { ...data.user, role: data.role ?? data.user?.role };

    localStorage.setItem('terrawatch_token', jwtToken);
    localStorage.setItem('terrawatch_user', JSON.stringify(userData));
    setToken(jwtToken);
    setUser(userData);
    return userData;
  };

  return (
    <AuthContext.Provider value={{ user, token, role, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
