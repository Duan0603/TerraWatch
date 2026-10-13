import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, Mail, ArrowRight, UserCheck, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('officer@terrawatch.vn');
  const [password, setPassword] = useState('Password123!');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg('');
      await login(email, password);
      navigate('/');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (role) => {
    if (role === 'officer') {
      setEmail('officer@terrawatch.vn');
      setPassword('Password123!');
    } else {
      setEmail('admin@terrawatch.vn');
      setPassword('Password123!');
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(14, 165, 233, 0.12) 0%, transparent 70%)',
      padding: 20
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
        background: 'rgba(19, 27, 46, 0.85)',
        border: '1px solid var(--border-color)',
        borderRadius: 16,
        padding: 32,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(16px)'
      }}>
        {/* Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex',
            background: 'rgba(14, 165, 233, 0.15)',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            padding: 12,
            borderRadius: 14,
            marginBottom: 12
          }}>
            <ShieldAlert size={36} color="#38bdf8" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.03em', marginBottom: 4 }}>
            TERRAWATCH <span style={{ color: '#38bdf8' }}>GEOSENTRY</span>
          </h1>
          <p style={{ fontSize: 12, color: '#94a3b8' }}>
            Hệ thống Viễn thám & AI Giám sát Cảnh báo Sớm Sạt lở Đất
          </p>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 12,
            marginBottom: 16
          }}>
            {errorMsg}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Tài khoản Cán bộ / Admin
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 12, top: 11, color: '#64748b' }}>
                <Mail size={16} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@terrawatch.vn"
                style={{
                  width: '100%',
                  background: 'rgba(13, 19, 34, 0.9)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '10px 12px 10px 38px',
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Mật khẩu bảo mật
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 12, top: 11, color: '#64748b' }}>
                <Lock size={16} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  background: 'rgba(13, 19, 34, 0.9)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '10px 12px 10px 38px',
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              padding: '12px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background 0.2s ease'
            }}
          >
            {isLoading ? 'Đang xác thực JWT...' : (
              <>
                Vào Trung Tâm Chỉ Huy <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Helper (Hữu ích khi demo cho Hội đồng chấm thi) */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, textAlign: 'center' }}>
            Nút chọn nhanh tài khoản diễn tập:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('officer')}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '8px',
                borderRadius: 6,
                color: '#38bdf8',
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}
            >
              <UserCheck size={13} /> Cán Bộ (Officer)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin')}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '8px',
                borderRadius: 6,
                color: '#f87171',
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}
            >
              <ShieldCheck size={13} /> Quản Trị (Admin)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
