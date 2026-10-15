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
        style: 'mapbox://styles/mapbox/outdoors-v12',
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

          // Hiệu ứng sương mù nhẹ (light atmosphere)
          if (map.setFog) {
            map.setFog({
              color: 'rgb(245, 248, 247)',
              'high-color': 'rgb(186, 220, 214)',
              'horizon-blend': 0.02,
              'space-color': 'rgb(230, 242, 240)',
              'star-intensity': 0
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

      {/* Token modal — light theme */}
      {(!hasValidToken || mapError || showTokenModal) && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(245,248,247,0.92)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 30, padding: 20
        }}>
          <div style={{
            maxWidth: 480, width: '100%',
            background: '#fff',
            border: '1px solid #DCE5E2',
            borderRadius: 16, padding: 28,
            boxShadow: '0 10px 40px rgba(23,37,36,0.12)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#E4F4F1', padding: 10, borderRadius: 10 }}>
                <Key size={22} color="#087B70" />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#172524' }}>
                  Kích hoạt bản đồ địa hình 3D
                </h3>
                <p style={{ fontSize: 11, color: '#687977', margin: '3px 0 0' }}>
                  TerraWatch dùng Mapbox GL JS · DEM 30m · Lào Cai
                </p>
              </div>
            </div>

            {mapError && (
              <div style={{
                background: '#FFF0F0', border: '1px solid #FECACA',
                padding: '8px 12px', borderRadius: 8,
                fontSize: 12, color: '#EF4444', marginBottom: 14
              }}>
                ⚠️ {mapError}
              </div>
            )}

            <div style={{
              background: '#F5F8F7', border: '1px solid #DCE5E2',
              padding: '12px 14px', borderRadius: 10,
              fontSize: 12, lineHeight: 1.7, color: '#687977', marginBottom: 16
            }}>
              <div style={{ fontWeight: 600, color: '#087B70', marginBottom: 6 }}>
                Cách lấy Token Mapbox miễn phí (dưới 1 phút):
              </div>
              <ol style={{ paddingLeft: 18, margin: 0 }}>
                <li>Vào <a href="https://account.mapbox.com/" target="_blank" rel="noreferrer" style={{ color: '#087B70', fontWeight: 600 }}>account.mapbox.com</a> · đăng ký miễn phí</li>
                <li>Tìm mục <strong style={{ color: '#172524' }}>Default public token</strong> trong dashboard</li>
                <li>Copy đoạn mã bắt đầu <code style={{ background: '#E4F4F1', padding: '1px 5px', borderRadius: 4 }}>pk.eyJ...</code> và dán vào ô dưới</li>
              </ol>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveToken(tokenInput); }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#687977', marginBottom: 6 }}>
                  Mapbox Public Token (pk.eyJ...):
                </label>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="pk.eyJ1Ijoi..."
                  autoFocus
                  style={{
                    width: '100%', background: '#F5F8F7',
                    border: '1.5px solid #087B70', borderRadius: 8,
                    padding: '10px 14px', color: '#172524',
                    fontSize: 13, fontFamily: 'monospace', outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {hasValidToken && (
                  <button type="button" onClick={() => setShowTokenModal(false)}
                    style={{
                      background: 'transparent', border: '1px solid #DCE5E2',
                      color: '#687977', padding: '8px 16px', borderRadius: 8,
                      fontSize: 12, cursor: 'pointer'
                    }}>
                    Đóng
                  </button>
                )}
                <button type="submit"
                  style={{
                    background: '#087B70', border: 'none', color: '#fff',
                    padding: '9px 20px', borderRadius: 8,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}>
                  <CheckCircle size={14} /> Kích hoạt bản đồ 3D
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating controls — right side */}
      <div style={{
        position: 'absolute', top: 14, right: 14,
        display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10
      }}>
        {[
          { label: is3D ? '3D' : '2D', action: toggle3D, active: is3D, isText: true, title: is3D ? 'Chuyển 2D' : 'Chuyển 3D' },
          { icon: <Compass size={16} />, action: resetNorth, title: 'Hướng Bắc' },
          { icon: <Key size={15} />, action: () => { setTokenInput(token); setShowTokenModal(true); }, title: 'Đổi token' },
          { label: '+', action: () => mapRef.current?.zoomIn({ duration: 500 }), isText: true, title: 'Phóng to' },
          { label: '−', action: () => mapRef.current?.zoomOut({ duration: 500 }), isText: true, title: 'Thu nhỏ' },
        ].map((btn, i) => (
          <button key={i} onClick={btn.action} title={btn.title}
            style={{
              width: 36, height: 36, borderRadius: 8,
              background: btn.active ? '#087B70' : '#fff',
              border: '1px solid #DCE5E2',
              color: btn.active ? '#fff' : '#172524',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(23,37,36,0.1)',
              fontSize: 14, fontWeight: 700
            }}>
            {btn.isText ? btn.label : btn.icon}
          </button>
        ))}
      </div>

      {/* Legend — bottom left */}
      <div style={{
        position: 'absolute', bottom: 20, left: 20,
        background: '#fff', border: '1px solid #DCE5E2',
        padding: '10px 14px', borderRadius: 10,
        fontSize: 11, color: '#687977',
        display: 'flex', flexDirection: 'column', gap: 5,
        zIndex: 5, boxShadow: '0 4px 16px rgba(23,37,36,0.1)'
      }}>
        <div style={{ fontWeight: 700, color: '#172524', marginBottom: 2, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Chú giải nguy cơ</div>
        {[
          { color: '#EF4444', label: 'Cực nguy hiểm' },
          { color: '#F97316', label: 'Cao' },
          { color: '#EAB308', label: 'Trung bình' },
          { color: '#22C55E', label: 'Thấp' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
