import React, { useState } from 'react';
import { MapPin, Clock, Ruler, ChevronDown, ChevronUp } from 'lucide-react';
import MapViewer from './MapViewer';
import RainfallEvidencePanel from './RainfallEvidencePanel';
import LiveRainfallPanel from './LiveRainfallPanel';
import { fmtVN } from '../utils/time';

const TABS = [['issue', 'Lúc phát hành dự báo'], ['now', 'Hiện tại & 7 ngày tới']];

export default function DetailPanel({ selectedEvent, events, onSelectEvent, fieldReports, aoi, confirmed, className = '' }) {
  const [tab, setTab] = useState('issue');
  const [open, setOpen] = useState(true);
  const pick = (id) => { setTab(id); setOpen(true); };
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
        confirmed={confirmed}
      />

      {/* Hai góc nhìn cùng khu vực: ảnh chụp lúc phát hành (cố định) và mưa/thời tiết hiện tại (cập nhật mỗi giờ) */}
      {selectedEvent && (
        <div className="map-evidence-stack">
          <div className="evidence-tabs" role="tablist" aria-label="Bằng chứng và thời tiết của khu vực">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" id={`evidence-tab-${id}`} aria-controls="evidence-tabpanel"
                aria-selected={open && tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => pick(id)}
                onKeyDown={e => {
                  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                  const other = id === 'issue' ? 'now' : 'issue';
                  pick(other);
                  document.getElementById(`evidence-tab-${other}`)?.focus();
                }}>
                {label}
              </button>
            ))}
            <button type="button" className="evidence-tabs-toggle" onClick={() => setOpen(v => !v)}
              aria-expanded={open} aria-controls="evidence-tabpanel" aria-label={open ? 'Thu gọn bảng' : 'Mở bảng'}>
              {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
          {open && (
            <div id="evidence-tabpanel" role="tabpanel" aria-labelledby={`evidence-tab-${tab}`}>
              {tab === 'issue'
                ? <RainfallEvidencePanel selectedEvent={selectedEvent} />
                : <LiveRainfallPanel key={`${selectedEvent.lat},${selectedEvent.lng}`} selectedEvent={selectedEvent} />}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
