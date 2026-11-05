import React, { createContext, useContext, useState, useEffect } from 'react';
import authApi from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('terrawatch_token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('terrawatch_user');
    return saved ? JSON.parse(saved) : null;
  });

  const isAuthenticated = !!token;
  // Không đoán/mặc định role: nếu thiếu role thật từ backend, coi như chưa xác định quyền
  // (least privilege) thay vì âm thầm gán 'officer' cho một tài khoản không rõ vai trò.
  const role = user?.role || null;

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

  const logout = () => {
    authApi.logout();
    setToken(null);
    setUser(null);
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
