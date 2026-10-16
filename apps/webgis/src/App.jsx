import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CitizenPage from './pages/CitizenPage';

// Route bảo vệ: yêu cầu đăng nhập trước khi vào Trung tâm Chỉ huy
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Trang chủ sau đăng nhập khác nhau theo role: citizen xem bản đồ cảnh báo đã duyệt
// (CitizenPage), officer/admin vào Trung tâm Chỉ huy đầy đủ (DashboardPage).
function HomeByRole() {
  const { role } = useAuth();
  const isCitizen = role?.toLowerCase()?.includes('citizen');
  return isCitizen ? <CitizenPage /> : <DashboardPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomeByRole />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
