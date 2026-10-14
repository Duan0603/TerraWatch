import React from 'react';
import { Mountain, MapPin, Satellite, ShieldAlert } from 'lucide-react';
import MapViewer from './MapViewer';
import RainfallEvidencePanel from './RainfallEvidencePanel';

export default function DetailPanel({ selectedEvent, events, onSelectEvent }) {
  if (!selectedEvent) return null;

  return (
    <main className="map-canvas-area" style={{ position: 'relative', flex: 1, height: '100%', overflow: 'hidden' }}>
      {/* 1. HUD Top-Left Overlay: Thông Tin Vùng Đang Giám Sát */}
      <div className="map-hud-overlay" style={{ left: 20, right: 'auto', zIndex: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Khu Vực Chỉ Huy
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={14} color="#38bdf8" /> {selectedEvent.location}
          </div>
        </div>

        <div style={{ height: 26, width: 1, background: 'rgba(255,255,255,0.12)' }}></div>

        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>
            Nguồn Viễn Thám
          </div>
          <div style={{ fontSize: 12, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Satellite size={13} /> {selectedEvent.satelliteScene}
          </div>
        </div>

        <div style={{ height: 26, width: 1, background: 'rgba(255,255,255,0.12)' }}></div>

        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>
            Vùng Đệm Geofencing
          </div>
          <div style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>
            R = 500m (Khẩn cấp)
          </div>
        </div>
      </div>

      {/* 2. Mapbox GL JS 3D Terrain Map Viewer */}
      <MapViewer
        events={events}
        selectedEvent={selectedEvent}
        onSelectEvent={onSelectEvent}
      />

      {/* 3. Bảng Bằng Chứng Dự Báo Mưa 24H (Story 4.3 AC4) */}
      <RainfallEvidencePanel
        selectedEvent={selectedEvent}
      />
    </main>
  );
}
