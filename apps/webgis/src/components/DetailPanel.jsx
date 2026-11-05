import React, { useState } from 'react';
import { MapPin, Clock, Ruler } from 'lucide-react';
import MapViewer from './MapViewer';
import RainfallEvidencePanel from './RainfallEvidencePanel';
import LiveRainfallPanel from './LiveRainfallPanel';
import { fmtVN } from '../utils/time';

export default function DetailPanel({ selectedEvent, events, onSelectEvent, fieldReports, aoi, className = '' }) {
  const [evidenceOpen, setEvidenceOpen] = useState(true);
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
      />

      {/* Hai nguồn bằng chứng: dự báo đã lưu của hệ thống (trên) và mưa cập nhật theo tọa độ (dưới) */}
      {selectedEvent && (
        <div className="map-evidence-stack">
          {evidenceOpen
            ? <RainfallEvidencePanel selectedEvent={selectedEvent} onClose={() => setEvidenceOpen(false)} />
            : (
              <button className="btn-ghost" style={{ background: '#fff' }} onClick={() => setEvidenceOpen(true)}>
                Xem bằng chứng dự báo & địa hình
              </button>
            )}
          <LiveRainfallPanel key={`${selectedEvent.lat},${selectedEvent.lng}`} selectedEvent={selectedEvent} />
        </div>
      )}
    </main>
  );
}
