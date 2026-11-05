import React, { useState, useCallback } from 'react';
import { MapPin, Clock, Ruler } from 'lucide-react';
import MapViewer from './MapViewer';
import RainfallEvidencePanel from './RainfallEvidencePanel';
import LiveRainfallPanel from './LiveRainfallPanel';
import MapInjectPanel from './MapInjectPanel';
import { fmtVN } from '../utils/time';

export default function DetailPanel({ selectedEvent, events, onSelectEvent, fieldReports, aoi, className = '' }) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [clickedPoint, setClickedPoint] = useState(null);
  const [injectMarkers, setInjectMarkers] = useState([]);
  const handleCenterChange = useCallback((c) => setMapCenter(c), []);
  const handleMapClick = useCallback((pt) => setClickedPoint(pt), []);
  const handleInjectResult = useCallback((lat, lng, result) => {
    setInjectMarkers(prev => [...prev.slice(-4), { lat, lng, ...result }]);
  }, []);
  return (
    <main className={`map-canvas-area${className ? ' ' + className : ''}`} style={{ position: 'relative', flex: 1, height: '100%', overflow: 'hidden', background: '#E8F2EF' }}>
      {selectedEvent && (
        <div className="map-hud-overlay">
          <div>
            <div className="hud-label">Khu vực</div>
            <div className="hud-value"><MapPin size={13} color="#087B70" /> {selectedEvent.location}</div>
          </div>
          <div className="hud-divider" />
          <div>
            <div className="hud-label">Hiệu lực đến</div>
            <div className="hud-value" style={{ color: selectedEvent.expired ? '#B91C1C' : '#087B70' }}>
              <Clock size={13} /> {fmtVN(selectedEvent.validUntil)}
            </div>
          </div>
          {selectedEvent.unit?.effectiveResolutionM != null && (
            <>
              <div className="hud-divider" />
              <div>
                <div className="hud-label">Độ phân giải</div>
                <div className="hud-value"><Ruler size={13} /> ≈ {Math.round(selectedEvent.unit.effectiveResolutionM)} m</div>
              </div>
            </>
          )}
        </div>
      )}

      <MapViewer
        events={events}
        selectedEvent={selectedEvent}
        onSelectEvent={onSelectEvent}
        fieldReports={fieldReports}
        aoi={aoi}
        onCenterChange={handleCenterChange}
        onMapClick={handleMapClick}
        injectMarkers={injectMarkers}
      />

      {/* Nút inject mưa nổi trên bản đồ — dùng vị trí click trên bản đồ */}
      <MapInjectPanel
        mapCenter={mapCenter}
        selectedEvent={selectedEvent}
        clickedPoint={clickedPoint}
        onInjectResult={handleInjectResult}
      />

      {/* LiveRainfallPanel (với Inject Tool) đặt trên; bằng chứng lưu trữ thu gọn mặc định */}
      {selectedEvent && (
        <div className="map-evidence-stack">
          <LiveRainfallPanel key={`${selectedEvent.lat},${selectedEvent.lng}`} selectedEvent={selectedEvent} />
          {evidenceOpen
            ? <RainfallEvidencePanel selectedEvent={selectedEvent} onClose={() => setEvidenceOpen(false)} />
            : (
              <button className="btn-ghost" style={{ background: '#fff', fontSize: 12, padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', width: '100%', textAlign: 'left' }}
                onClick={() => setEvidenceOpen(true)}>
                📋 Xem bằng chứng dự báo & địa hình đã lưu
              </button>
            )}
        </div>
      )}
    </main>
  );
}
