import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Satellite, 
  Layers, 
  Radio, 
  FileText, 
  Volume2, 
  VolumeX, 
  CheckCircle, 
  XCircle, 
  MapPin, 
  AlertOctagon, 
  Activity, 
  Wind, 
  Mountain,
  Share2
} from 'lucide-react';

export default function App() {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  
  const [events, setEvents] = useState([
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      location: 'Mù Cang Chải (Yên Bái) - Sườn Đèo Khau Phạ',
      coords: '104.085°E, 21.845°N',
      risk: 'high',
      status: 'pending',
      confidence: 0.89,
      slope: 37.2,
      ndviDrop: -0.48,
      areaM2: 1850,
      detectedAt: '2026-10-02 08:30:15 UTC',
      satelliteScene: 'Sentinel-2A L2A (10m Multi-spectral)',
      estPopulation: 120,
      mapX: 42,
      mapY: 55,
      geology: 'Đất đá phong hóa nứt nẻ, ta-luy dương cao'
    },
    {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      location: 'Quốc Lộ 32 - Bản Dế Xu Phình',
      coords: '104.110°E, 21.860°N',
      risk: 'extreme',
      status: 'verified',
      confidence: 0.96,
      slope: 43.5,
      ndviDrop: -0.62,
      areaM2: 3400,
      detectedAt: '2026-10-02 06:15:00 UTC',
      satelliteScene: 'Sentinel-2B L2A (10m Multi-spectral)',
      estPopulation: 350,
      mapX: 48,
      mapY: 48,
      geology: 'Sạt trượt đất đá khối lượng lớn chia cắt giao thông'
    },
    {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      location: 'Bản Tả Phìn (Sa Pa, Lào Cai)',
      coords: '103.820°E, 22.340°N',
      risk: 'medium',
      status: 'verified',
      confidence: 0.78,
      slope: 28.0,
      ndviDrop: -0.35,
      areaM2: 920,
      detectedAt: '2026-10-01 19:40:22 UTC',
      satelliteScene: 'Sentinel-2A L2A (10m Multi-spectral)',
      estPopulation: 45,
      mapX: 30,
      mapY: 28,
      geology: 'Mưa dầm xói lở ta-luy âm đường bê tông'
    }
  ]);

  const selectedEvent = events.find(e => e.id === selectedEventId) || events[0];

  const handleVerify = (id, newStatus, risk) => {
    setEvents(events.map(ev => {
      if (ev.id === id) {
        return {
          ...ev,
          status: newStatus,
          risk: risk || ev.risk,
          verifiedAt: new Date().toLocaleTimeString(),
          verifiedBy: 'Cán bộ trực ban Quốc gia (Duan0603)'
        };
      }
      return ev;
    }));
    if (newStatus === 'verified') {
      alert(`[HỆ THỐNG PHÁT TÁN QUỐC GIA]\nĐã xác thực sự kiện sạt lở: ${id}\nKích hoạt FCM Push Notifications, Cell Broadcast và SMS đến 1,250 người dân trong vùng bán kính 500m!`);
    } else {
      alert(`Đã đánh dấu báo động giả (False Alarm) cho sự kiện ${id}.`);
    }
  };

  const pendingCount = events.filter(e => e.status === 'pending').length;
  const verifiedCount = events.filter(e => e.status === 'verified').length;
  const totalPopulationAtRisk = events.filter(e => e.status === 'verified').reduce((acc, curr) => acc + curr.estPopulation, 0);

  return (
    <div className="dashboard-root">
      {/* 1. TOP HEADER / STATUS BAR */}
      <header className="top-nav">
        <div className="nav-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
              GS
            </div>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>GeoSentry (TerraWatch)</h1>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Trung Tâm Giám Sát & Cảnh Báo Sạt Lở Đất Viễn Thám Quốc Gia</span>
            </div>
          </div>

          <div className="national-badge">
            <span className="live-pulse"></span>
            Trực Giám Sát 24/7: Sẵn sàng
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#38bdf8' }}>
            <Satellite size={15} />
            <span>Nguồn Vệ Tinh: Sentinel-2A/B (10m) + Landsat-8</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            {soundEnabled ? <Volume2 size={15} color="#22c55e" /> : <VolumeX size={15} color="#94a3b8" />}
            {soundEnabled ? 'Còi báo: Bật' : 'Còi báo: Tắt'}
          </button>

          <button 
            onClick={() => alert('Đang xuất Báo cáo Thẩm định Địa không gian (PDF/GeoJSON) chuẩn Bộ Tài nguyên Môi trường...')}
            style={{ background: '#0284c7', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}
          >
            <FileText size={15} />
            Xuất Báo Cáo Thẩm Định
          </button>
        </div>
      </header>

      {/* 2. MAIN LAYOUT */}
      <div className="main-layout">
        {/* LEFT SIDEBAR: Verification Queue & Live Operations */}
        <aside className="sidebar">
          {/* Top Quick Stats */}
          <div className="sidebar-stats">
            <div className="stat-box">
              <div className="lbl">Chờ thẩm định</div>
              <div className="num" style={{ color: '#fb923c' }}>{pendingCount}</div>
            </div>
            <div className="stat-box">
              <div className="lbl">Đã cảnh báo</div>
              <div className="num" style={{ color: '#ef4444' }}>{verifiedCount}</div>
            </div>
            <div className="stat-box">
              <div className="lbl">Dân số nguy cơ</div>
              <div className="num" style={{ color: '#38bdf8' }}>{totalPopulationAtRisk}</div>
            </div>
          </div>

          <div style={{ padding: '12px 16px 4px', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Hàng đợi AI phân tích ({events.length} điểm)
          </div>

          {/* Event List */}
          <div className="queue-container">
            {events.map(ev => (
              <div 
                key={ev.id}
                className={`event-card ${selectedEventId === ev.id ? 'selected' : ''}`}
                onClick={() => setSelectedEventId(ev.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className={`risk-tag ${ev.risk}`}>Nguy cơ {ev.risk}</span>
                  <span style={{ fontSize: 11, color: ev.status === 'pending' ? '#fb923c' : '#22c55e', fontWeight: 600 }}>
                    {ev.status === 'pending' ? '● Chờ cán bộ duyệt' : '✓ Đã thẩm định'}
                  </span>
                </div>

                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{ev.location}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={12} /> {ev.coords}
                </div>

                <div className="grid-metrics">
                  <div>Độ dốc: <span>{ev.slope}°</span></div>
                  <div>Giảm NDVI: <span>{ev.ndviDrop}</span></div>
                  <div>Độ tin cậy AI: <span style={{ color: '#38bdf8' }}>{(ev.confidence * 100).toFixed(0)}%</span></div>
                  <div>Diện tích: <span>{ev.areaM2} m²</span></div>
                </div>

                {ev.status === 'pending' && (
                  <div className="action-btn-row">
                    <button 
                      className="btn-approve"
                      onClick={(e) => { e.stopPropagation(); handleVerify(ev.id, 'verified', 'extreme'); }}
                    >
                      <CheckCircle size={14} /> Phê duyệt & Phát lệnh
                    </button>
                    <button 
                      className="btn-reject"
                      onClick={(e) => { e.stopPropagation(); handleVerify(ev.id, 'false_alarm'); }}
                    >
                      <XCircle size={14} /> Bác bỏ
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* RIGHT CANVAS: Interactive Map & HUD Inspector */}
        <main className="map-canvas-area">
          {/* HUD Top-Right Info Overlay */}
          <div className="map-hud-overlay">
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Khu vực đang xem</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{selectedEvent.location}</div>
            </div>
            <div style={{ height: 28, width: 1, background: 'rgba(255,255,255,0.1)' }}></div>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Ảnh Vệ Tinh Gốc</div>
              <div style={{ fontSize: 13, color: '#38bdf8' }}>{selectedEvent.satelliteScene}</div>
            </div>
            <div style={{ height: 28, width: 1, background: 'rgba(255,255,255,0.1)' }}></div>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Vùng đệm Geofencing</div>
              <div style={{ fontSize: 13, color: '#f87171', fontWeight: 600 }}>Bán kính 500m (Point-in-Polygon)</div>
            </div>
          </div>

          {/* Interactive Map Simulation */}
          <div className="interactive-map-mock">
            {/* Topographic grid background */}
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(rgba(56, 189, 248, 0.1) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
              opacity: 0.7
            }}></div>

            {/* Radar scanner sweep */}
            <div className="radar-scan-line"></div>

            {/* Hotspots plotted from events list */}
            {events.map(ev => (
              <div 
                key={ev.id}
                className="map-hotspot"
                style={{ left: `${ev.mapX}%`, top: `${ev.mapY}%` }}
                onClick={() => setSelectedEventId(ev.id)}
              >
                {/* 500m Danger buffer zone */}
                <div className="danger-buffer-ring" style={{
                  borderColor: ev.risk === 'extreme' ? '#ef4444' : (ev.risk === 'high' ? '#f97316' : '#eab308')
                }}></div>

                {/* Hotspot core icon */}
                <div className="hotspot-circle" style={{
                  backgroundColor: ev.risk === 'extreme' ? '#ef4444' : (ev.risk === 'high' ? '#f97316' : '#eab308')
                }}>
                  !
                </div>

                <div style={{
                  position: 'absolute',
                  top: 28,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                  background: 'rgba(6, 9, 17, 0.9)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600
                }}>
                  {ev.location.split('-')[0]}
                </div>
              </div>
            ))}

            {/* Bottom floating details card */}
            <div style={{
              position: 'absolute',
              bottom: 24,
              left: 24,
              right: 24,
              background: 'rgba(13, 19, 34, 0.92)',
              border: '1px solid var(--border-color)',
              backdropFilter: 'blur(16px)',
              borderRadius: 12,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)'
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                  Đặc tính trắc địa & Mô hình DeepLabV3+
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
                  {selectedEvent.location} ({selectedEvent.coords})
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  {selectedEvent.geology} | Ước tính có <strong>{selectedEvent.estPopulation} hộ dân</strong> trong bán kính nguy hiểm 500m.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Độ dốc trượt lở</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#f87171' }}>{selectedEvent.slope}°</div>
                </div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }}></div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Diện tích ảnh hưởng</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8' }}>{selectedEvent.areaM2} m²</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
