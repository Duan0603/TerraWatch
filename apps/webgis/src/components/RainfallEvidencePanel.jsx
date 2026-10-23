import React from 'react';
import { CloudRain, Droplets, Mountain, Calendar, X } from 'lucide-react';

export default function RainfallEvidencePanel({ selectedEvent, onClose }) {
  if (!selectedEvent) return null;

  const rainfall = selectedEvent.rainfall24h || {
    observedTotal: 186,
    forecastTotal: 142,
    threshold: 150,
    hourly: []
  };

  const windowInfo = selectedEvent.forecastWindow || {
    issuedAt: '2025-08-15 08:00:00 UTC',
    validUntil: '2025-08-16 08:00:00 UTC',
    status: 'fresh'
  };

  const maxVal = Math.max(
    ...rainfall.hourly.map(h => Math.max(h.observed || 0, h.forecast || 0)),
    100
  );

  const isOverThreshold = rainfall.observedTotal > rainfall.threshold;

  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      right: 20,
      width: 380,
      maxHeight: 'calc(100vh - 110px)',
      overflowY: 'auto',
      background: '#fff',
      border: '1px solid #DCE5E2',
      borderRadius: 14,
      boxShadow: '0 8px 32px rgba(23,37,36,0.12)',
      zIndex: 10,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 10px',
        borderBottom: '1px solid #DCE5E2',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: '#E4F4F1', padding: 7, borderRadius: 8 }}>
            <CloudRain size={16} color="#087B70" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#172524' }}>Bằng chứng mưa & địa hình</div>
            <div style={{ fontSize: 10, color: '#687977' }}>{selectedEvent.aoiName || selectedEvent.location}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700,
            padding: '3px 8px', borderRadius: 20,
            background: windowInfo.status === 'fresh' ? '#F0FDF4' : '#FEFCE8',
            color: windowInfo.status === 'fresh' ? '#15803D' : '#92400E',
            border: `1px solid ${windowInfo.status === 'fresh' ? '#BBF7D0' : '#FEF08A'}`,
            letterSpacing: '0.03em',
          }}>
            {windowInfo.status === 'fresh' ? '● Mới' : '▲ Cũ'}
          </span>
          {onClose && (
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9BB0AD' }}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* Rainfall metrics */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14
        }}>
          {[
            { label: 'Mưa 24h', value: `${rainfall.observedTotal} mm`, alert: isOverThreshold },
            { label: 'Mưa 72h', value: `${selectedEvent.rain72h || 324} mm`, alert: true },
            { label: 'Dự báo 24h', value: `${rainfall.forecastTotal} mm`, warn: true },
          ].map(({ label, value, alert, warn }) => (
            <div key={label} style={{
              background: alert ? '#FFF0F0' : warn ? '#FFF4ED' : '#F5F8F7',
              border: `1px solid ${alert ? '#FECACA' : warn ? '#FED7AA' : '#DCE5E2'}`,
              borderRadius: 8, padding: '8px 10px', textAlign: 'center'
            }}>
              <div style={{
                fontSize: 16, fontWeight: 800,
                color: alert ? '#EF4444' : warn ? '#F97316' : '#172524'
              }}>{value}</div>
              <div style={{ fontSize: 10, color: '#687977', marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Threshold bar */}
        {isOverThreshold && (
          <div style={{
            background: '#FFF0F0', border: '1px solid #FECACA',
            borderRadius: 8, padding: '8px 12px', marginBottom: 12,
            fontSize: 12, color: '#EF4444', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            ⚠️ Vượt ngưỡng kích hoạt ({rainfall.threshold} mm)
          </div>
        )}

        {/* Bar chart */}
        {rainfall.hourly.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 8, fontSize: 11
            }}>
              <span style={{ fontWeight: 600, color: '#172524' }}>Diễn biến mưa theo giờ</span>
              <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#687977' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, background: '#087B70', borderRadius: 2 }} /> Thực đo
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, background: '#F97316', borderRadius: 2 }} /> Dự báo
                </span>
              </div>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
              height: 80, background: '#F5F8F7', padding: '8px 6px 4px',
              borderRadius: 8, border: '1px solid #DCE5E2'
            }}>
              {rainfall.hourly.map((h, i) => {
                const hObs = Math.round(((h.observed || 0) / maxVal) * 60);
                const hFc = Math.round(((h.forecast || 0) / maxVal) * 60);
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
                      <div style={{ width: 8, height: `${Math.max(hObs, 3)}px`, background: '#087B70', borderRadius: '2px 2px 0 0' }} />
                      <div style={{ width: 8, height: `${Math.max(hFc, 3)}px`, background: '#F97316', borderRadius: '2px 2px 0 0', opacity: 0.7 }} />
                    </div>
                    <span style={{ fontSize: 8, color: '#9BB0AD' }}>{h.hour}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Terrain + moisture */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ background: '#F5F8F7', border: '1px solid #DCE5E2', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: '#687977', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Droplets size={12} color="#087B70" /> Độ bão hòa đất
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#EF4444' }}>
              {selectedEvent.soilMoisture || '88.5%'}
            </div>
            <div style={{ fontSize: 10, color: '#9BB0AD' }}>Rất cao</div>
          </div>
          <div style={{ background: '#F5F8F7', border: '1px solid #DCE5E2', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: '#687977', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Mountain size={12} color="#087B70" /> Độ dốc địa hình
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#172524' }}>
              {selectedEvent.slope}°
            </div>
            <div style={{ fontSize: 10, color: '#9BB0AD' }}>Ta-luy dốc đứng</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          fontSize: 10, color: '#9BB0AD',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 10, borderTop: '1px solid #DCE5E2'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Calendar size={11} /> Phát: {windowInfo.issuedAt.split(' ')[0]}
          </span>
          <span style={{ color: '#087B70', fontWeight: 600 }}>
            Đến: {windowInfo.validUntil.split(' ')[0]}
          </span>
        </div>
      </div>
    </div>
  );
}
