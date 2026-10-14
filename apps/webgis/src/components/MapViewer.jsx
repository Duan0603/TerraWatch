import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { 
  Compass, 
  Layers, 
  MapPin, 
  AlertTriangle,
  Key,
  ExternalLink,
  CheckCircle,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import { getMapboxToken, TERRAIN_CONFIG, CAMERA_PRESETS } from '../config/mapbox';
import { COMMUNITY_REPORTS } from '../data/mockEvents';

export default function MapViewer({ events, selectedEvent, onSelectEvent }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const [token, setToken] = useState(() => getMapboxToken());
  const [tokenInput, setTokenInput] = useState('');
  const [is3D, setIs3D] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [showTokenModal, setShowTokenModal] = useState(false);

  const hasValidToken = token && !token.includes('placeholder') && token.startsWith('pk.');

  // Lưu token mới
  const handleSaveToken = (newToken) => {
    const trimmed = (newToken || '').trim();
    if (!trimmed.startsWith('pk.')) {
      alert('Token Mapbox không hợp lệ! Token chuẩn phải bắt đầu bằng chữ "pk.eyJ..."');
      return;
    }
    localStorage.setItem('terrawatch_mapbox_token', trimmed);
    setToken(trimmed);
    setShowTokenModal(false);
    setMapError(null);
  };

  // 1. Khởi tạo bản đồ Mapbox GL JS 3D
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!hasValidToken) {
      setMapLoaded(false);
      return;
    }

    mapboxgl.accessToken = token;

    try {
      const initialCenter = (selectedEvent && typeof selectedEvent.lng === 'number' && !isNaN(selectedEvent.lng) && typeof selectedEvent.lat === 'number' && !isNaN(selectedEvent.lat))
        ? [selectedEvent.lng, selectedEvent.lat]
        : CAMERA_PRESETS.defaultCenter;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: initialCenter,
        zoom: CAMERA_PRESETS.defaultZoom,
        pitch: CAMERA_PRESETS.defaultPitch,
        bearing: CAMERA_PRESETS.defaultBearing,
        antialias: true
      });

      mapRef.current = map;

      map.on('load', () => {
        setMapLoaded(true);
        setMapError(null);

        // Kích hoạt 3D Terrain từ nguồn DEM số (độ phóng đại 1.5x)
        try {
          if (!map.getSource(TERRAIN_CONFIG.sourceId)) {
            map.addSource(TERRAIN_CONFIG.sourceId, {
              type: 'raster-dem',
              url: TERRAIN_CONFIG.sourceUrl,
              tileSize: TERRAIN_CONFIG.tileSize,
              maxzoom: TERRAIN_CONFIG.maxzoom
            });
            map.setTerrain({ source: TERRAIN_CONFIG.sourceId, exaggeration: TERRAIN_CONFIG.exaggeration });
          }

          // Hiệu ứng khí quyển bầu trời & sương mù (Atmosphere / Sky)
          if (map.setFog) {
            map.setFog({
              color: 'rgb(186, 210, 235)',
              'high-color': 'rgb(36, 92, 223)',
              'horizon-blend': 0.02,
              'space-color': 'rgb(11, 11, 25)',
              'star-intensity': 0.6
            });
          }
        } catch (terrainErr) {
          console.warn('Lưu ý khi bật 3D terrain:', terrainErr);
        }

        // Tạo nguồn dữ liệu GeoJSON cho đa giác sạt lở
        const features = (events || [])
          .filter(ev => ev && Array.isArray(ev.polygon) && ev.polygon.length >= 3)
          .map(ev => ({
            type: 'Feature',
            properties: {
              id: ev.id,
              location: ev.location,
              risk: ev.risk,
              status: ev.status,
              confidence: ev.confidence,
              slope: ev.slope,
              areaM2: ev.areaM2
            },
            geometry: {
              type: 'Polygon',
              coordinates: [ev.polygon]
            }
          }));

        if (!map.getSource('landslide-hazards')) {
          map.addSource('landslide-hazards', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features
            }
          });

          // Lớp màu nền đa giác sạt lở (Fill layer)
          map.addLayer({
            id: 'landslide-polygons-fill',
            type: 'fill',
            source: 'landslide-hazards',
            paint: {
              'fill-color': [
                'match',
                ['get', 'risk'],
                'extreme', '#ef4444',
                'high', '#f97316',
                'medium', '#eab308',
                /* default */ '#10b981'
              ],
              'fill-opacity': 0.65
            }
          });

          // Lớp viền nét đa giác (Line layer)
          map.addLayer({
            id: 'landslide-polygons-outline',
            type: 'line',
            source: 'landslide-hazards',
            paint: {
              'line-color': '#ffffff',
              'line-width': 2.5,
              'line-opacity': 0.95
            }
          });

          // Click vào đa giác sạt lở -> Chọn sự cố
          map.on('click', 'landslide-polygons-fill', (e) => {
            if (e.features && e.features[0]) {
              const eventId = e.features[0].properties.id;
              onSelectEvent(eventId);
            }
          });

          map.on('mouseenter', 'landslide-polygons-fill', () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'landslide-polygons-fill', () => {
            map.getCanvas().style.cursor = '';
          });
        }

        // Thêm marker Báo cáo hiện trường cộng đồng (community_reports)
        COMMUNITY_REPORTS.forEach(rep => {
          const el = document.createElement('div');
          el.className = 'community-report-marker';
          el.innerHTML = `
            <div style="background: #ef4444; color: white; padding: 4px; border-radius: 50%; box-shadow: 0 0 12px #ef4444; cursor: pointer; border: 2px solid #fff; display: flex;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            </div>
          `;

          const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="color: #0f172a; padding: 4px; font-family: sans-serif;">
              <div style="font-weight: 700; font-size: 12px; margin-bottom: 2px; color: #dc2626;">📍 BÁO CÁO CỘNG ĐỒNG</div>
              <div style="font-size: 11px; font-weight: 600; margin-bottom: 2px;">${rep.reporterName}</div>
              <div style="font-size: 10px; color: #475569; margin-bottom: 4px;">${rep.description}</div>
              <div style="font-size: 9px; color: #64748b;">Gửi lúc: ${rep.time}</div>
            </div>
          `);

          const marker = new mapboxgl.Marker(el)
            .setLngLat(rep.coords)
            .setPopup(popup)
            .addTo(map);

          markersRef.current.push(marker);
        });
      });

      map.on('error', (err) => {
        console.warn('Mapbox báo lỗi tải tài nguyên:', err);
        if (err.error?.status === 401) {
          setMapError('Khóa Mapbox Access Token không hợp lệ hoặc đã hết hạn.');
        }
      });

      return () => {
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];
        map.remove();
      };
    } catch (err) {
      console.error('Không thể khởi tạo Mapbox GL:', err);
      setMapError(err.message);
    }
  }, [token]);

  // 2. Camera FlyTo mượt mà khi Cán bộ chọn sự cố từ hàng đợi
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !selectedEvent) return;
    if (typeof selectedEvent.lng !== 'number' || isNaN(selectedEvent.lng) || typeof selectedEvent.lat !== 'number' || isNaN(selectedEvent.lat)) return;

    mapRef.current.flyTo({
      center: [selectedEvent.lng, selectedEvent.lat],
      zoom: 14.0,
      pitch: is3D ? 62 : 0,
      bearing: is3D ? 35 : 0,
      duration: 1800,
      essential: true
    });
  }, [selectedEvent, mapLoaded, is3D]);

  // 3. Chuyển đổi chế độ xem 2D / 3D
  const toggle3D = () => {
    if (!mapRef.current) return;
    const next3D = !is3D;
    setIs3D(next3D);

    mapRef.current.easeTo({
      pitch: next3D ? 60 : 0,
      bearing: next3D ? 30 : 0,
      duration: 1000
    });
  };

  // 4. Xoay về hướng Bắc
  const resetNorth = () => {
    if (!mapRef.current) return;
    mapRef.current.resetNorthPitch({ duration: 1000 });
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Khung chứa canvas Mapbox */}
      <div 
        ref={mapContainerRef} 
        style={{ width: '100%', height: '100%' }}
      />

      {/* Khi chưa cấu hình Token hoặc Token lỗi -> Hiển thị hộp thoại kích hoạt bản đồ ngay trên giao diện */}
      {(!hasValidToken || mapError || showTokenModal) && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(6, 9, 17, 0.88)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30,
          padding: 20
        }}>
          <div style={{
            maxWidth: 520,
            width: '100%',
            background: 'rgba(13, 19, 34, 0.96)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: 16,
            padding: 28,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
            color: '#f8fafc'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ background: 'rgba(2, 132, 199, 0.2)', padding: 10, borderRadius: 10 }}>
                <Key size={24} color="#38bdf8" />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                  KÍCH HOẠT BẢN ĐỒ 3D TERRAIN YÊN BÁI - LÀO CAI
                </h3>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0 0' }}>
                  Đồ án TerraWatch GeoSentry sử dụng mô hình độ cao số DEM & ảnh vệ tinh Mapbox GL JS
                </p>
              </div>
            </div>

            {mapError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                color: '#f87171',
                marginBottom: 14
              }}>
                ⚠️ {mapError}
              </div>
            )}

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '12px 14px',
              borderRadius: 10,
              fontSize: 12,
              lineHeight: 1.6,
              color: '#cbd5e1',
              marginBottom: 16
            }}>
              <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: 4 }}>
                👉 Cách lấy Token Mapbox miễn phí (mất chưa đầy 1 phút):
              </div>
              <ol style={{ paddingLeft: 18, margin: 0 }}>
                <li>Truy cập <a href="https://account.mapbox.com/" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'underline' }}>account.mapbox.com</a> (đăng ký tài khoản miễn phí).</li>
                <li>Đăng nhập vào bảng điều khiển, bạn sẽ thấy mục <strong>Default public token</strong>.</li>
                <li>Bấm nút <strong>Copy</strong> đoạn mã bắt đầu bằng <code>pk.eyJ...</code> rồi dán vào ô bên dưới:</li>
              </ol>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveToken(tokenInput); }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
                  Dán Mapbox Public Access Token (pk.eyJ...):
                </label>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="pk.eyJ1Ijoi..."
                  autoFocus
                  style={{
                    width: '100%',
                    background: 'rgba(6, 9, 17, 0.95)',
                    border: '1px solid #0284c7',
                    borderRadius: 8,
                    padding: '11px 14px',
                    color: '#38bdf8',
                    fontSize: 13,
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxShadow: '0 0 15px rgba(2, 132, 199, 0.25)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                {hasValidToken && (
                  <button
                    type="button"
                    onClick={() => setShowTokenModal(false)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#94a3b8',
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    Đóng
                  </button>
                )}
                <button
                  type="submit"
                  style={{
                    background: '#0284c7',
                    border: 'none',
                    color: '#fff',
                    padding: '9px 20px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <CheckCircle size={14} /> Lưu Token & Kích Hoạt Bản Đồ 3D
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating 3D Map Controls (Góc trên bên phải) */}
      <div style={{
        position: 'absolute',
        top: 80,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 10
      }}>
        {/* Toggle 2D / 3D */}
        <button
          onClick={toggle3D}
          style={{
            background: is3D ? '#0284c7' : 'rgba(13, 19, 34, 0.9)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            width: 38,
            height: 38,
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            fontSize: 12,
            fontWeight: 800
          }}
          title={is3D ? 'Chuyển về 2D phẳng' : 'Chuyển sang 3D Terrain'}
        >
          {is3D ? '3D' : '2D'}
        </button>

        {/* Reset North */}
        <button
          onClick={resetNorth}
          style={{
            background: 'rgba(13, 19, 34, 0.9)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#38bdf8',
            width: 38,
            height: 38,
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
          }}
          title="Xoay thẳng hướng Bắc"
        >
          <Compass size={18} />
        </button>

        {/* Cấu hình / Đổi Token Mapbox */}
        <button
          onClick={() => { setTokenInput(token); setShowTokenModal(true); }}
          style={{
            background: 'rgba(13, 19, 34, 0.9)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fb923c',
            width: 38,
            height: 38,
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
          }}
          title="Cấu hình Access Token Mapbox"
        >
          <Key size={16} />
        </button>

        {/* Zoom In */}
        <button
          onClick={() => mapRef.current?.zoomIn({ duration: 500 })}
          style={{
            background: 'rgba(13, 19, 34, 0.9)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            width: 38,
            height: 38,
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            fontSize: 18,
            fontWeight: 700
          }}
          title="Phóng to"
        >
          +
        </button>

        {/* Zoom Out */}
        <button
          onClick={() => mapRef.current?.zoomOut({ duration: 500 })}
          style={{
            background: 'rgba(13, 19, 34, 0.9)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            width: 38,
            height: 38,
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            fontSize: 18,
            fontWeight: 700
          }}
          title="Thu nhỏ"
        >
          -
        </button>
      </div>

      {/* Floating Bottom Left Legend */}
      <div style={{
        position: 'absolute',
        bottom: 24,
        left: 24,
        background: 'rgba(13, 19, 34, 0.92)',
        border: '1px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(10px)',
        padding: '10px 14px',
        borderRadius: 8,
        fontSize: 11,
        color: '#94a3b8',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        zIndex: 5,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
      }}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: 2 }}>Phân cấp Nguy cơ Sạt lở 3D:</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444' }}></span> Cực kỳ nguy hiểm (Extreme) - Độ dốc &gt; 40°
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f97316' }}></span> Nguy cơ cao (High) - Sụt giảm NDVI
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#eab308' }}></span> Nguy cơ trung bình (Medium)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '1px solid #fff' }}></span> Báo cáo hiện trường người dân (GPS)
        </div>
      </div>
    </div>
  );
}
