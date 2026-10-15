import React from 'react';
import { Mountain, MapPin, Satellite, ShieldAlert } from 'lucide-react';
import MapViewer from './MapViewer';
import RainfallEvidencePanel from './RainfallEvidencePanel';

export default function DetailPanel({ selectedEvent, events, onSelectEvent }) {
  if (!selectedEvent) return null;

  return (
    <main className="map-canvas-area" style={{ position: 'relative', flex: 1, height: '100%', overflow: 'hidden', background: '#E8F2EF' }}>
      {/* HUD Top-Left Overlay */}
      <div className="map-hud-overlay">
        <div>
          <div className="hud-label">Khu vực</div>
          <div className="hud-value">
            <MapPin size={13} color="#087B70" /> {selectedEvent.location}
          </div>
        </div>

        <div className="hud-divider" />

        <div>
          <div className="hud-label">Viễn thám</div>
          <div className="hud-value" style={{ color: '#087B70' }}>
            <Satellite size={13} /> {selectedEvent.satelliteScene}
          </div>
        </div>

        <div className="hud-divider" />

        <div>
          <div className="hud-label">Geofencing</div>
          <div className="hud-value" style={{ color: '#EF4444' }}>
            R = 500m
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
