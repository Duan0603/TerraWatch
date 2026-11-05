import React, { Component } from 'react';
import { AlertTriangle, RotateCcw, ShieldAlert } from 'lucide-react';

/**
 * @typedef {Object} MapErrorBoundaryProps
 * @property {React.ReactNode} children - Thành phần con bên trong Error Boundary
 * @property {React.ReactNode} [fallback] - Giao diện dự phòng tùy biến
 * @property {function} [onError] - Callback khi bắt được ngoại lệ WebGL/MapLibre
 */

/**
 * @typedef {Object} MapErrorBoundaryState
 * @property {boolean} hasError - Trạng thái đã gặp lỗi WebGL/bản đồ hay chưa
 * @property {Error|null} error - Đối tượng lỗi
 * @property {React.ErrorInfo|null} errorInfo - Ngữ cảnh component stack
 */

/**
 * Error Boundary bảo vệ ứng dụng WebGIS khỏi sự cố sập WebGL hoặc lỗi rendering bản đồ
 */
export default class MapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    // Ghi log bảo mật vào console hệ thống
    console.error('[MapErrorBoundary caught error]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="map-error-boundary-container"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            minHeight: '400px',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            padding: '24px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              color: '#ef4444'
            }}
          >
            <ShieldAlert size={36} aria-hidden="true" />
          </div>

          <h3
            style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              marginBottom: '8px',
              color: '#ffffff'
            }}
          >
            Sự Cố Khởi Tạo Lớp Bản Đồ Địa Hình WebGIS
          </h3>

          <p
            style={{
              fontSize: '0.875rem',
              color: '#94a3b8',
              maxWidth: '520px',
              lineHeight: '1.5',
              marginBottom: '20px'
            }}
          >
            Trình duyệt không thể kích hoạt ngữ cảnh WebGL hoặc kết nối máy chủ dữ liệu độ cao DEM bị gián đoạn.
            Hệ thống dữ liệu cảnh báo và giám sát thực địa vẫn được bảo toàn.
          </p>

          {this.state.error && (
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: '#fca5a5',
                marginBottom: '20px',
                maxWidth: '600px',
                wordBreak: 'break-word',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}
            >
              {this.state.error.message || String(this.state.error)}
            </div>
          )}

          <button
            type="button"
            onClick={this.handleReset}
            aria-label="Tải lại giao diện bản đồ địa hình"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#0d9488',
              color: '#ffffff',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: '500',
              fontSize: '0.875rem',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
              boxShadow: '0 4px 6px -1px rgba(13, 148, 136, 0.3)'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#0f766e')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#0d9488')}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Khởi Động Lại Bản Đồ
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
