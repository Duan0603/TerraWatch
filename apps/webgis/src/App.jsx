import React, { useState } from 'react';
import { ShieldAlert, MapPin, CheckCircle2, XCircle, Satellite, Layers, AlertTriangle, Users } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'active' | 'reports'
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [queueItems, setQueueItems] = useState([
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      locationName: 'Mù Cang Chải (Yên Bái) - Sườn ta-luy Km 12',
      risk: 'high',
      confidence: 0.88,
      slope: 34.5,
      ndviDrop: -0.42,
      areaM2: 1250,
      detectedAt: '2026-10-02 08:30',
      satelliteScene: 'Sentinel-2A L2A',
      coordinates: '104.086°E, 21.846°N'
    },
    {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      locationName: 'Đèo Khau Phạ - Ta-luy dương cung sạt nứt',
      risk: 'extreme',
      confidence: 0.94,
      slope: 41.2,
      ndviDrop: -0.56,
      areaM2: 2400,
      detectedAt: '2026-10-02 07:15',
      satelliteScene: 'Sentinel-2B L2A',
      coordinates: '104.112°E, 21.862°N'
    }
  ]);

  const [verifiedItems, setVerifiedItems] = useState([
    {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      locationName: 'Xã Púng Luông - Điểm sạt lở chia cắt giao thông',
      risk: 'extreme',
      areaM2: 3100,
      verifiedAt: '2026-10-01 14:20',
      verifiedBy: 'Cán bộ Kiểm định Yên Bái'
    }
  ]);

  const handleApprove = (id, e) => {
    e.stopPropagation();
    const item = queueItems.find(i => i.id === id);
    if (!item) return;
    setQueueItems(queueItems.filter(i => i.id !== id));
    setVerifiedItems([
      {
        id: item.id,
        locationName: item.locationName,
        risk: item.risk,
        areaM2: item.areaM2,
        verifiedAt: new Date().toLocaleTimeString(),
        verifiedBy: 'Cán bộ hiện tại (Duan0603)'
      },
      ...verifiedItems
    ]);
    alert(`Đã phê duyệt sự kiện sạt lở ${id} và kích hoạt phát tán cảnh báo FCM/Cell Broadcast!`);
  };

  const handleReject = (id, e) => {
    e.stopPropagation();
    setQueueItems(queueItems.filter(i => i.id !== id));
    alert(`Đã đánh dấu cảnh báo giả (False Alarm) cho sự kiện ${id}.`);
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar: Officers Verification & Queue */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-area">
            <div className="logo-icon">GS</div>
            <div className="logo-title">
              <h1>GeoSentry</h1>
              <span>WebGIS Dashboard</span>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Chờ thẩm định</div>
            <div className="stat-value" style={{ color: '#fb923c' }}>{queueItems.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Điểm đã công bố</div>
            <div className="stat-value" style={{ color: '#ef4444' }}>{verifiedItems.length}</div>
          </div>
        </div>

        <nav className="tabs-nav">
          <button 
            className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('queue')}
          >
            Hàng đợi AI ({queueItems.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Bản đồ công bố ({verifiedItems.length})
          </button>
        </nav>

        <div className="content-scroll">
          {activeTab === 'queue' && (
            <div>
              {queueItems.length === 0 ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 40 }}>
                  Không còn điểm sạt lở nào chờ thẩm định.
                </p>
              ) : (
                queueItems.map(item => (
                  <div 
                    key={item.id} 
                    className="card-item"
                    onClick={() => setSelectedEvent(item)}
                    style={{ cursor: 'pointer', borderLeft: item.risk === 'extreme' ? '4px solid #ef4444' : '4px solid #fb923c' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <span className={`badge ${item.risk}`}>Nguy cơ {item.risk}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{item.detectedAt}</span>
                    </div>

                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{item.locationName}</h3>
                    
                    <div style={{ fontSize: 12, color: '#9ca3af', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                      <div>Độ dốc: <strong style={{ color: '#fff' }}>{item.slope}°</strong></div>
                      <div>Giảm NDVI: <strong style={{ color: '#fff' }}>{item.ndviDrop}</strong></div>
                      <div>Độ tin cậy AI: <strong style={{ color: '#38bdf8' }}>{(item.confidence * 100).toFixed(0)}%</strong></div>
                      <div>Diện tích: <strong style={{ color: '#fff' }}>{item.areaM2} m²</strong></div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button 
                        className="btn btn-approve" 
                        style={{ flex: 1 }}
                        onClick={(e) => handleApprove(item.id, e)}
                      >
                        <CheckCircle2 size={15} /> Phê duyệt
                      </button>
                      <button 
                        className="btn btn-reject"
                        onClick={(e) => handleReject(item.id, e)}
                      >
                        <XCircle size={15} /> Bác bỏ
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'active' && (
            <div>
              {verifiedItems.map(item => (
                <div key={item.id} className="card-item" style={{ borderLeft: '4px solid #ef4444' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="badge extreme">Đã xác thực</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{item.verifiedAt}</span>
                  </div>
                  <h4 style={{ fontSize: 14, marginBottom: 6 }}>{item.locationName}</h4>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    <div>Diện tích ảnh hưởng: <strong style={{ color: '#fff' }}>{item.areaM2} m²</strong></div>
                    <div style={{ marginTop: 4 }}>Người duyệt: <em>{item.verifiedBy}</em></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Map Viewport */}
      <main className="main-map-area">
        <div className="map-placeholder">
          <Satellite size={48} color="#06b6d4" style={{ marginBottom: 16 }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Bản Đồ WebGIS Sentinel-2 & PostGIS</h2>
          <p style={{ color: '#9ca3af', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            Tích hợp Vector Tile (MVT) từ PostGIS Server, lớp phủ ảnh quang học đa phổ Sentinel-2 
            và phân đoạn sạt lở đất (DeepLabV3+ / U-Net).
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <span style={{ background: 'rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: 20, fontSize: 12 }}>
              AOI: Mù Cang Chải
            </span>
            <span style={{ background: 'rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: 20, fontSize: 12 }}>
              EPSG:4326 (WGS84)
            </span>
            <span style={{ background: 'rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: 20, fontSize: 12 }}>
              OGC WMS/WFS
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
