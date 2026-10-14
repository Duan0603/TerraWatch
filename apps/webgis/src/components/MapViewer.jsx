import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { 
  Compass, 
  Layers, 
  Maximize2, 
  Minimize2, 
  Eye, 
  MapPin, 
  AlertTriangle,
  RotateCw
} from 'lucide-react';
import { MAPBOX_ACCESS_TOKEN, TERRAIN_CONFIG, CAMERA_PRESETS } from '../config/mapbox';
import { COMMUNITY_REPORTS } from '../data/mockEvents';

// Kiểm tra xem token Mapbox có hợp lệ không hay đang là placeholder
const hasValidToken = MAPBOX_ACCESS_TOKEN && !MAPBOX_ACCESS_TOKEN.includes('placeholder');

if (hasValidToken) {
  mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
}

// Style ảnh vệ tinh ESRI miễn phí toàn cầu (Không cần token, luôn hiển thị ảnh vệ tinh núi đồi chân thực)
const FREE_SATELLITE_STYLE = {
  version: 8,
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution: 'Esri World Imagery'
    }
  },
  layers: [
    {
      id: 'esri-satellite-layer',
      type: 'raster',
      source: 'esri-satellite',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

export default function MapViewer({ events, selectedEvent, onSelectEvent }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [is3D, setIs3D] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);

  // 1. Khởi tạo bản đồ Mapbox GL JS
  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      const activeStyle = hasValidToken 
        ? 'mapbox://styles/mapbox/satellite-streets-v12' 
        : FREE_SATELLITE_STYLE;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: activeStyle,
        center: selectedEvent ? [selectedEvent.lng, selectedEvent.lat] : CAMERA_PRESETS.defaultCenter,
        zoom: CAMERA_PRESETS.defaultZoom,
        pitch: CAMERA_PRESETS.defaultPitch,
        bearing: CAMERA_PRESETS.defaultBearing,
        antialias: true
      });

      mapRef.current = map;

      map.on('load', () => {
        setMapLoaded(true);

        // Kích hoạt 3D Terrain từ nguồn DEM số nếu có token Mapbox
        if (hasValidToken) {
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

            // Hiệu ứng bầu trời & sương mù (Atmosphere / Sky)
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
            console.warn('Lưu ý 3D terrain:', terrainErr);
          }
        }

        // Tạo nguồn dữ liệu GeoJSON cho đa giác sạt lở
        const features = events.map(ev => ({
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
              'line-opacity': 0.9
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
            <div style="background: #ef4444; color: white; padding: 4px; border-radius: 50%; box-shadow: 0 0 10px #ef4444; cursor: pointer; border: 2px solid #fff; display: flex;">
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
        console.warn('Mapbox báo lỗi:', err);
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
  }, []);

  // 2. Camera FlyTo mượt mà khi Cán bộ chọn sự cố từ hàng đợi
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !selectedEvent) return;

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
          title={is3D ? 'Chuyển về chế độ 2D phẳng' : 'Chuyển sang địa hình 3D Terrain'}
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
