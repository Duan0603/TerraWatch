import React from 'react';
import { Mountain, MapPin, Radio, Activity, Wind, AlertOctagon } from 'lucide-react';

export default function DetailPanel({ selectedEvent, events, onSelectEvent }) {
  if (!selectedEvent) return null;

  return (
    <main className="map-canvas-area">
      {/* 1. HUD Top-Right Info Overlay */}
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

      {/* 2. Interactive Map Viewport (Chuẩn bị tích hợp Mapbox 3D Terrain ở Story 4.3) */}
      <div className="interactive-map-mock">
        {/* Radar Scanner Animation */}
        <div className="radar-scan-line"></div>

        {/* Hotspots */}
        {events.map((ev) => (
          <div 
            key={ev.id} 
            className="map-hotspot"
            style={{ 
              top: `${ev.mapY}%`, 
              left: `${ev.mapX}%`,
              opacity: selectedEvent.id === ev.id ? 1 : 0.65
            }}
            onClick={() => onSelectEvent(ev.id)}
          >
            {selectedEvent.id === ev.id && <div className="danger-buffer-ring"></div>}
            <div 
              className="hotspot-circle"
              style={{
                backgroundColor: ev.risk === 'extreme' ? '#ef4444' : (ev.risk === 'high' ? '#f97316' : '#eab308')
              }}
            >
              {ev.risk === 'extreme' ? '!' : '▲'}
            </div>
          </div>
        ))}

        {/* Floating Quick Legend */}
        <div style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          background: 'rgba(13, 19, 34, 0.9)',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '12px 16px',
          borderRadius: 8,
          fontSize: 11,
          color: '#94a3b8',
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>Phân cấp Nguy cơ Sạt lở:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444' }}></span> Cực kỳ nguy hiểm (Extreme) - Độ dốc &gt; 40°
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f97316' }}></span> Nguy cơ cao (High) - ΔNDVI sụt giảm mạnh
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#eab308' }}></span> Nguy cơ trung bình (Medium)
          </div>
        </div>

        {/* Selected Event Bottom Inspector Card */}
        <div style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          width: 380,
          background: 'rgba(13, 19, 34, 0.92)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          backdropFilter: 'blur(12px)',
          padding: 16,
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Mountain size={18} color="#38bdf8" />
            <span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>Đặc Điểm Địa Chất & Mô Phỏng AI</span>
          </div>
          <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 12 }}>
            {selectedEvent.geology}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: 8, borderRadius: 6 }}>
              <div style={{ color: '#94a3b8' }}>Dân số ảnh hưởng:</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#f87171' }}>~{selectedEvent.estPopulation} người</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: 8, borderRadius: 6 }}>
              <div style={{ color: '#94a3b8' }}>Thời điểm phát hiện:</div>
              <div style={{ fontWeight: 600, color: '#f8fafc' }}>{selectedEvent.detectedAt.split(' ')[1]}</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
