import React from 'react';
import { 
  CloudRain, 
  Clock, 
  Droplets, 
  Mountain, 
  AlertOctagon, 
  ShieldCheck, 
  Layers,
  Calendar
} from 'lucide-react';

export default function RainfallEvidencePanel({ selectedEvent }) {
  if (!selectedEvent) return null;

  const rainfall = selectedEvent.rainfall24h || {
    observedTotal: 180,
    forecastTotal: 120,
    threshold: 150,
    hourly: []
  };

  const windowInfo = selectedEvent.forecastWindow || {
    issuedAt: '2026-10-14 06:00:00 UTC',
    validUntil: '2026-10-15 06:00:00 UTC',
    status: 'fresh'
  };

  const maxVal = Math.max(
    ...rainfall.hourly.map(h => Math.max(h.observed, h.forecast)),
    100
  );

  return (
    <div style={{
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 420,
      maxHeight: 'calc(100vh - 120px)',
      overflowY: 'auto',
      background: 'rgba(13, 19, 34, 0.94)',
      border: '1px solid rgba(56, 189, 248, 0.3)',
      backdropFilter: 'blur(16px)',
      padding: '16px 18px',
      borderRadius: 14,
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65)',
      zIndex: 10,
      color: '#f8fafc'
    }}>
      {/* 1. Header: Vùng Giám Sát & Trạng Thái 24h */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: 6, borderRadius: 8 }}>
            <CloudRain size={18} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Bằng Chứng Dự Báo Mưa 24H</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{selectedEvent.aoiName || selectedEvent.location}</div>
          </div>
        </div>

        {/* Status Tag (Fresh vs Stale) */}
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          padding: '3px 8px',
          borderRadius: 4,
          background: windowInfo.status === 'fresh' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
          color: windowInfo.status === 'fresh' ? '#4ade80' : '#facc15',
          border: `1px solid ${windowInfo.status === 'fresh' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`
        }}>
          {windowInfo.status === 'fresh' ? '● Dự báo mới (24h)' : '▲ Dữ liệu cũ'}
        </span>
      </div>

      {/* 2. Tổng Lượng Mưa Tích Lũy vs Ngưỡng Kích Hoạt */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        background: 'rgba(0, 0, 0, 0.3)',
        padding: 10,
        borderRadius: 8,
        marginBottom: 12
      }}>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>Mưa thực đo (24h)</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: rainfall.observedTotal > rainfall.threshold ? '#ef4444' : '#38bdf8' }}>
            {rainfall.observedTotal} <span style={{ fontSize: 11, fontWeight: 500 }}>mm</span>
          </div>
          <div style={{ fontSize: 10, color: '#64748b' }}>Đo từ trạm khí tượng</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>Mưa dự báo tới</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fb923c' }}>
            +{rainfall.forecastTotal} <span style={{ fontSize: 11, fontWeight: 500 }}>mm</span>
          </div>
          <div style={{ fontSize: 10, color: '#64748b' }}>Ngưỡng sạt lở: {rainfall.threshold}mm</div>
        </div>
      </div>

      {/* 3. Biểu Đồ Đối Soát Cột Lượng Mưa (SVG/CSS Flexbox thuần) */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 11 }}>
          <span style={{ fontWeight: 600, color: '#cbd5e1' }}>Diễn biến mưa theo khung giờ:</span>
          <div style={{ display: 'flex', gap: 10, fontSize: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, background: '#38bdf8', borderRadius: 2 }}></span> Thực đo
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, background: '#fb923c', borderRadius: 2 }}></span> Dự báo
            </span>
          </div>
        </div>

        {/* Thanh biểu đồ */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          height: 85,
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '8px 6px 4px',
          borderRadius: 6,
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          {rainfall.hourly.map((h, i) => {
            const hObs = Math.round((h.observed / maxVal) * 65);
            const hFc = Math.round((h.forecast / maxVal) * 65);

            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 65 }}>
                  {/* Cột thực đo */}
                  <div
                    style={{
                      width: 10,
                      height: `${Math.max(hObs, 4)}px`,
                      background: '#38bdf8',
                      borderRadius: '2px 2px 0 0',
                      transition: 'height 0.3s ease'
                    }}
                    title={`Mưa thực đo: ${h.observed}mm`}
                  />
                  {/* Cột dự báo */}
                  <div
                    style={{
                      width: 10,
                      height: `${Math.max(hFc, 4)}px`,
                      background: '#fb923c',
                      borderRadius: '2px 2px 0 0',
                      transition: 'height 0.3s ease'
                    }}
                    title={`Mưa dự báo: ${h.forecast}mm`}
                  />
                </div>
                <span style={{ fontSize: 9, color: '#94a3b8' }}>{h.hour}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Mốc Thời Gian & Độ Bão Hòa Nước Trong Đất */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        fontSize: 11,
        marginBottom: 10
      }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: 8, borderRadius: 6 }}>
          <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <Droplets size={12} color="#38bdf8" /> Độ bão hòa đất:
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#f87171' }}>
            {selectedEvent.soilMoisture || '88.5%'} (Rất cao)
          </div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: 8, borderRadius: 6 }}>
          <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <Mountain size={12} color="#fb923c" /> Độ dốc địa hình:
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc' }}>
            {selectedEvent.slope}° (Ta-luy dương dốc đứng)
          </div>
        </div>
      </div>

      {/* 5. Khung Thời Hạn Hiệu Lực Cảnh Báo */}
      <div style={{
        fontSize: 10,
        color: '#94a3b8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Calendar size={12} /> Phát hành: {windowInfo.issuedAt.split(' ')[1]}
        </span>
        <span style={{ color: '#38bdf8', fontWeight: 600 }}>
          Hiệu lực tới: {windowInfo.validUntil.split(' ')[0]} ({windowInfo.validUntil.split(' ')[1]})
        </span>
      </div>
    </div>
  );
}
