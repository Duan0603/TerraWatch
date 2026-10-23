import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// Cấu hình Web Worker độc lập cho MapLibre trong môi trường Vite/Rollup
if (typeof maplibregl.setWorkerUrl === 'function') {
  maplibregl.setWorkerUrl(workerUrl);
}

import {
  Compass,
  Layers,
  MapPin,
  AlertTriangle,
  RotateCcw,
  Satellite
} from 'lucide-react';
import {
  STYLE_URL,
  SATELLITE_STYLE_URL,
  HAS_SATELLITE_STYLE,
  TERRAIN_CONFIG,
  DEFAULT_CAMERA,
  INCIDENT_CAMERA,
  ERROR_MESSAGE,
  ATTRIBUTIONS
} from '../config/mapConfig';
import { COMMUNITY_REPORTS } from '../data/mockEvents';
import { DEFAULT_LOCATION_ID } from '../data/mountainLocations';
import LocationSelector from './LocationSelector';

export default function MapViewer({ events, selectedEvent, onSelectEvent }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const clickMarkerRef = useRef(null);
  const startTimeRef = useRef(performance.now());
  const hasMeasuredIdleRef = useRef(false);

  const [is3D, setIs3D] = useState(true);
  const [isSatellite, setIsSatellite] = useState(false);
  const [currentLocationId, setCurrentLocationId] = useState(DEFAULT_LOCATION_ID);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [idleLoadTime, setIdleLoadTime] = useState(null);

  // Tham chiếu luôn cập nhật cho events và callback onSelectEvent (AC 1.5.2, AC 1.5.3)
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const onSelectEventRef = useRef(onSelectEvent);
  useEffect(() => {
    onSelectEventRef.current = onSelectEvent;
  }, [onSelectEvent]);

  // Chuyển đổi danh sách sự cố sang chuẩn GeoJSON FeatureCollection (AC 1.5.1)
  const createFeatureCollection = (eventList) => ({
    type: 'FeatureCollection',
    features: (eventList || [])
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
      }))
  });

  // Thiết lập địa hình 3D Terrarium DEM & Bầu trời khí quyển (AC 1.1.3, AC 1.1.4, AC 1.5.2)
  const setupTerrainAndSky = (map) => {
    if (!map) return;
    try {
      if (!map.getSource(TERRAIN_CONFIG.sourceId)) {
        map.addSource(TERRAIN_CONFIG.sourceId, TERRAIN_CONFIG.source);
        map.setTerrain({ 
          source: TERRAIN_CONFIG.sourceId, 
          exaggeration: TERRAIN_CONFIG.exaggeration 
        });
      }

      if (typeof map.setSky === 'function') {
        map.setSky({
          'sky-color': '#199EE0',
          'horizon-color': '#FFFFFF',
          'fog-color': '#E8F2EF'
        });
      }
    } catch (terrainErr) {
      console.warn('Lưu ý khi bật 3D terrain/sky:', terrainErr);
    }
  };

  // Nạp an toàn các lớp phân vùng nguy cơ sạt lở (AC 1.5.1, AC 1.5.2, AC 1.5.3, Rule R6)
  const ensureLandslideLayers = (map, eventList) => {
    if (!map) return;
    const style = map.getStyle();
    if (!style) return;

    const data = createFeatureCollection(eventList);

    if (!map.getSource('landslide-hazards')) {
      map.addSource('landslide-hazards', {
        type: 'geojson',
        data
      });
    } else {
      map.getSource('landslide-hazards').setData(data);
    }

    // Lớp màu nền đa giác sạt lở (Fill layer)
    if (!map.getLayer('landslide-polygons-fill')) {
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
          'fill-opacity': 0.45
        }
      });

      // Click vào đa giác sạt lở -> Chọn sự cố (AC 1.5.3)
      map.on('click', 'landslide-polygons-fill', (e) => {
        if (e.features && e.features[0] && onSelectEventRef.current) {
          const eventId = e.features[0].properties.id;
          onSelectEventRef.current(eventId);
        }
      });

      map.on('mouseenter', 'landslide-polygons-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'landslide-polygons-fill', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // Lớp viền nét đa giác (Line layer)
    if (!map.getLayer('landslide-polygons-outline')) {
      map.addLayer({
        id: 'landslide-polygons-outline',
        type: 'line',
        source: 'landslide-hazards',
        paint: {
          'line-color': '#ffffff',
          'line-width': 2.0,
          'line-opacity': 0.95
        }
      });
    }
  };

  // Nạp các marker Báo cáo hiện trường cộng đồng (AC 1.5.4)
  const renderCommunityReportMarkers = (map) => {
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    COMMUNITY_REPORTS.forEach(rep => {
      const el = document.createElement('div');
      el.className = 'community-report-marker';
      el.innerHTML = `
        <div style="background: #ef4444; color: white; padding: 4px; border-radius: 50%; box-shadow: 0 0 12px #ef4444; cursor: pointer; border: 2px solid #fff; display: flex;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
        <div style="color: #0f172a; padding: 4px; font-family: sans-serif;">
          <div style="font-weight: 700; font-size: 12px; margin-bottom: 2px; color: #dc2626;">📍 BÁO CÁO CỘNG ĐỒNG</div>
          <div style="font-size: 11px; font-weight: 600; margin-bottom: 2px;">${rep.reporterName}</div>
          <div style="font-size: 10px; color: #475569; margin-bottom: 4px;">${rep.description}</div>
          <div style="font-size: 9px; color: #64748b;">Gửi lúc: ${rep.time}</div>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(rep.coords)
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  };

  // 1. Khởi tạo bản đồ MapLibre GL JS 3D không cần Token
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    startTimeRef.current = performance.now();
    hasMeasuredIdleRef.current = false;

    try {
      const initialCenter = (selectedEvent && typeof selectedEvent.lng === 'number' && !isNaN(selectedEvent.lng) && typeof selectedEvent.lat === 'number' && !isNaN(selectedEvent.lat))
        ? [selectedEvent.lng, selectedEvent.lat]
        : DEFAULT_CAMERA.center;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: STYLE_URL,
        center: initialCenter,
        zoom: DEFAULT_CAMERA.zoom,
        pitch: DEFAULT_CAMERA.pitch,
        bearing: DEFAULT_CAMERA.bearing,
        antialias: true,
        customAttribution: ATTRIBUTIONS
      });

      // Thêm thanh công cụ NavigationControl chuẩn (AC 1.2.3)
      const navControl = new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true
      });
      map.addControl(navControl, 'top-right');

      mapRef.current = map;

      // Đo thời gian nạp xong bản đồ nền qua sự kiện 'idle' lần đầu (AC 1.1.2)
      map.once('idle', () => {
        if (!hasMeasuredIdleRef.current) {
          hasMeasuredIdleRef.current = true;
          const duration = Math.round(performance.now() - startTimeRef.current);
          setIdleLoadTime(duration);
          console.log(`[Performance] MapLibre initial 'idle' event fired in ${duration}ms`);
        }
      });

      // Lắng nghe tải style (hỗ trợ khôi phục an toàn sau khi đổi hoặc nạp lại style) (AC 1.5.2)
      map.on('style.load', () => {
        setupTerrainAndSky(map);
        ensureLandslideLayers(map, eventsRef.current);
        if (markersRef.current.length === 0) {
          renderCommunityReportMarkers(map);
        }
      });

      map.on('load', () => {
        setMapLoaded(true);
        setMapError(null);

        setupTerrainAndSky(map);
        ensureLandslideLayers(map, eventsRef.current);
        if (markersRef.current.length === 0) {
          renderCommunityReportMarkers(map);
        }
      });

      // Lọc lỗi nạp Style/DEM chính vs lỗi tile đơn lẻ (AC 1.1.6)
      map.on('error', (err) => {
        const status = err.error?.status;
        const isCriticalSource = err.sourceId === TERRAIN_CONFIG.sourceId || err.dataType === 'style' || status === 401 || status === 403;
        if (isCriticalSource) {
          console.error('Lỗi nghiêm trọng khi tải tài nguyên bản đồ:', err);
          setMapError(ERROR_MESSAGE);
        } else {
          console.warn('Cảnh báo nạp tile bản đồ:', err);
        }
      });

      // 1.4 Click chọn điểm trên bản đồ để xem tọa độ không gian (Story 1.4, AC 1.4.1 - 1.4.5, Rule R10)
      map.on('click', (e) => {
        // Ưu tiên click vào polygon sự cố sạt lở (AC 1.4.4, FR-MAP-13)
        const features = map.queryRenderedFeatures(e.point, { layers: ['landslide-polygons-fill'] });
        if (features && features.length > 0) {
          return;
        }

        // Ưu tiên click vào marker báo cáo cộng đồng (AC 1.4.4, FR-MAP-13)
        if (e.originalEvent && e.originalEvent.target) {
          const isCommunityMarker = e.originalEvent.target.closest('.community-report-marker');
          if (isCommunityMarker) {
            return;
          }
        }

        // Xóa Marker ghim điểm cũ (nếu có) - Đảm bảo duy nhất 1 Marker (AC 1.4.1, Rule R10)
        if (clickMarkerRef.current) {
          clickMarkerRef.current.remove();
          clickMarkerRef.current = null;
        }

        const lng = e.lngLat.lng;
        const lat = e.lngLat.lat;

        // Popup hiển thị tọa độ định dạng 5 chữ số thập phân, không có nút clipboard (AC 1.4.2)
        const popupContent = `
          <div class="coordinate-inspector-popup" style="color: #172524; padding: 4px 6px; font-family: Inter, sans-serif;">
            <div style="font-size: 10px; font-weight: 700; color: #087B70; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
              <span>📍</span> TỌA ĐỘ ĐIỂM CHỌN
            </div>
            <div style="font-size: 12px; font-weight: 600; color: #172524; line-height: 1.4;">
              Kinh độ: <span style="color: #087B70; font-family: monospace;">${lng.toFixed(5)}°Đ</span>
            </div>
            <div style="font-size: 12px; font-weight: 600; color: #172524; line-height: 1.4;">
              Vĩ độ: <span style="color: #087B70; font-family: monospace;">${lat.toFixed(5)}°B</span>
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({
          offset: 25,
          closeButton: true,
          closeOnClick: false,
          className: 'coord-popup-box'
        }).setHTML(popupContent);

        // Tạo Marker mới tại vị trí click (màu thương hiệu GeoSentry #087B70)
        const marker = new maplibregl.Marker({
          color: '#087B70'
        })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map);

        marker.togglePopup();
        clickMarkerRef.current = marker;
      });

      return () => {
        if (clickMarkerRef.current) {
          clickMarkerRef.current.remove();
          clickMarkerRef.current = null;
        }
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch (err) {
      console.error('Không thể khởi tạo MapLibre GL:', err);
      setMapError(ERROR_MESSAGE);
    }
  }, []); // Run once on mount (R3)

  // 1b. Đồng bộ nguồn GeoJSON sạt lở khi prop events thay đổi (AC 1.5.2)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const source = map.getSource('landslide-hazards');
    if (source) {
      source.setData(createFeatureCollection(events));
    } else {
      ensureLandslideLayers(map, events);
    }
  }, [events, mapLoaded]);

  // 2. Camera FlyTo mượt mà khi Cán bộ chọn sự cố từ hàng đợi (AC 1.5.5, FR-MAP-12)
  const prevSelectedEventIdRef = useRef(null);
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !selectedEvent) return;
    if (selectedEvent.id === prevSelectedEventIdRef.current) return;
    prevSelectedEventIdRef.current = selectedEvent.id;

    if (typeof selectedEvent.lng !== 'number' || isNaN(selectedEvent.lng) || typeof selectedEvent.lat !== 'number' || isNaN(selectedEvent.lat)) return;

    mapRef.current.flyTo({
      center: [selectedEvent.lng, selectedEvent.lat],
      zoom: INCIDENT_CAMERA.zoom,
      pitch: is3D ? INCIDENT_CAMERA.pitch : 0,
      bearing: is3D ? 35 : 0,
      duration: INCIDENT_CAMERA.duration,
      essential: true
    });
  }, [selectedEvent, mapLoaded, is3D]);

  // Đảm bảo canvas bản đồ tự động co giãn theo kích thước container (AC 1.2.5, R8)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });
    resizeObserver.observe(mapContainerRef.current);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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

  // 3b. Chuyển đổi nền bản đồ Vector (topo) <-> Ảnh vệ tinh (raster, phủ lên terrain 3D)
  const toggleSatellite = () => {
    if (!mapRef.current || !HAS_SATELLITE_STYLE) return;
    const nextSatellite = !isSatellite;
    setIsSatellite(nextSatellite);
    mapRef.current.setStyle(nextSatellite ? SATELLITE_STYLE_URL : STYLE_URL);
  };

  // 4. Về góc nhìn toàn cảnh mặc định (Toàn Việt Nam) (AC 1.2.1, AC 1.2.4)
  const resetDefaultView = () => {
    if (!mapRef.current) return;
    setIs3D(true);
    setCurrentLocationId(DEFAULT_LOCATION_ID);
    prevSelectedEventIdRef.current = null;
    mapRef.current.flyTo({
      center: DEFAULT_CAMERA.center,
      zoom: DEFAULT_CAMERA.zoom,
      pitch: DEFAULT_CAMERA.pitch,
      bearing: DEFAULT_CAMERA.bearing,
      duration: 1500,
      essential: true
    });
  };

  // 4b. Điều hướng camera tới khu vực miền núi được chọn (Story 1.3 AC 1.3.3, AC 1.3.4, R3, R4)
  const handleSelectLocation = (loc) => {
    if (!mapRef.current || !loc) return;
    setCurrentLocationId(loc.id);
    prevSelectedEventIdRef.current = null;

    // Kích hoạt 3D terrain nếu chọn một trong các tỉnh miền núi (Task 3.2)
    if (loc.id !== 'vietnam') {
      setIs3D(true);
    }

    mapRef.current.flyTo({
      center: loc.center,
      zoom: loc.zoom,
      pitch: loc.pitch,
      bearing: loc.bearing,
      duration: 1800,
      essential: true
    });
  };

  // 5. Thử lại nạp style trên cùng instance khi có lỗi (AC 1.1.6)
  const handleRetry = () => {
    setMapError(null);
    if (mapRef.current) {
      try {
        mapRef.current.setStyle(STYLE_URL);
      } catch (e) {
        console.error('Lỗi khi nạp lại style:', e);
      }
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Khung chứa canvas MapLibre (R8) */}
      <div 
        ref={mapContainerRef} 
        style={{ width: '100%', height: '100%', minHeight: 400 }}
      />

      {/* Fallback Overlay khi lỗi nạp Style/DEM chính (AC 1.1.6) */}
      {mapError && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(245,248,247,0.92)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 30, padding: 20
        }}>
          <div style={{
            maxWidth: 420, width: '100%',
            background: '#fff',
            border: '1px solid #DCE5E2',
            borderRadius: 16, padding: 24,
            boxShadow: '0 10px 40px rgba(23,37,36,0.12)',
            textAlign: 'center'
          }}>
            <AlertTriangle size={36} color="#EF4444" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: '#172524' }}>
              Thông báo
            </h3>
            <p style={{ fontSize: 13, color: '#475569', margin: '0 0 16px', lineHeight: 1.5 }}>
              {ERROR_MESSAGE}
            </p>
            <button
              onClick={handleRetry}
              style={{
                background: '#087B70', color: '#fff',
                border: 'none', borderRadius: 8,
                padding: '8px 22px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* Cụm công cụ điều khiển bản đồ nổi (AC 1.2.3, 1.2.4, 1.2.5, 1.3.2) */}
      <div 
        className="map-floating-controls"
        style={{
          position: 'absolute',
          top: 10,
          right: 58,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 10
        }}
      >
        {/* Bộ chọn khu vực miền núi & góc nhìn toàn cảnh (Story 1.3 AC 1.3.2, 1.3.4) */}
        <LocationSelector
          selectedLocationId={currentLocationId}
          onSelectLocation={handleSelectLocation}
        />

        {/* Nút Về góc nhìn mặc định (AC 1.2.4) */}
        <button
          onClick={resetDefaultView}
          title="Về góc nhìn toàn cảnh mặc định (Toàn Việt Nam)"
          className="map-ctrl-btn"
          style={{
            background: 'rgba(255,255,255,0.92)',
            color: '#172524',
            border: '1px solid #DCE5E2',
            padding: '7px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            backdropFilter: 'blur(4px)'
          }}
        >
          <RotateCcw size={14} color="#087B70" />
          <span className="btn-text">Góc nhìn mặc định</span>
        </button>

        {/* Nút bật/tắt 3D Terrain */}
        <button
          onClick={toggle3D}
          title={is3D ? "Chuyển về góc nhìn phẳng 2D" : "Bật góc nhìn khối địa hình 3D"}
          className="map-ctrl-btn"
          style={{
            background: is3D ? '#087B70' : 'rgba(255,255,255,0.92)',
            color: is3D ? '#fff' : '#172524',
            border: '1px solid #DCE5E2',
            padding: '7px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            backdropFilter: 'blur(4px)'
          }}
        >
          <Layers size={14} />
          <span className="btn-text">{is3D ? '3D Terrain: BẬT' : '2D Map'}</span>
        </button>

        {/* Nút bật/tắt nền ảnh vệ tinh (chỉ hiện khi có MapTiler key) */}
        {HAS_SATELLITE_STYLE && (
          <button
            onClick={toggleSatellite}
            title={isSatellite ? "Chuyển về bản đồ địa hình (vector)" : "Bật nền ảnh vệ tinh thực địa"}
            className="map-ctrl-btn"
            style={{
              background: isSatellite ? '#087B70' : 'rgba(255,255,255,0.92)',
              color: isSatellite ? '#fff' : '#172524',
              border: '1px solid #DCE5E2',
              padding: '7px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              backdropFilter: 'blur(4px)'
            }}
          >
            <Satellite size={14} />
            <span className="btn-text">{isSatellite ? 'Vệ tinh: BẬT' : 'Vệ tinh'}</span>
          </button>
        )}
      </div>

      {/* Chỉ báo trạng thái nạp & hiệu năng */}
      {idleLoadTime && (
        <div style={{
          position: 'absolute', bottom: 26, left: 16,
          background: 'rgba(255,255,255,0.85)',
          padding: '3px 8px', borderRadius: 4,
          fontSize: 10, color: '#64748b',
          zIndex: 5, pointerEvents: 'none'
        }}>
          MapLibre 3D Ready ({idleLoadTime}ms)
        </div>
      )}
    </div>
  );
}
