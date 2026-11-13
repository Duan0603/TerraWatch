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
  Satellite,
  MapPinned,
  FlaskConical
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
import { DEFAULT_LOCATION_ID } from '../data/mountainLocations';
import LocationSelector from './LocationSelector';
import { describeConfirmed, confirmedBounds, confirmedCentres } from '../utils/confirmedLandslides';
import MapErrorBoundary from './MapErrorBoundary';
import { describeRisk, RISK_COLOR, RAIN_COLOR, usableCount } from '../utils/experimentalRisk';

/**
 * @typedef {Object} GeoEvent
 * @property {string} id - Mã định danh sự cố sạt lở
 * @property {string} location - Tên địa điểm hành chính
 * @property {'CRITICAL'|'HIGH'|'MODERATE'|'LOW'} [risk] - Cấp độ rủi ro sạt trượt
 * @property {string} [status] - Trạng thái xác minh hoặc cảnh báo
 * @property {Array<[number, number]>} [polygon] - Tọa độ đa giác vùng cảnh báo
 * @property {number} [lat] - Vĩ độ tâm điểm
 * @property {number} [lng] - Kinh độ tâm điểm
 */

/**
 * @typedef {Object} MapViewerProps
 * @property {GeoEvent[]} [events] - Danh sách các sự cố sạt lở thực địa
 * @property {GeoEvent|null} [selectedEvent] - Sự cố hiện đang được người dùng chọn
 * @property {(event: GeoEvent) => void} [onSelectEvent] - Callback khi click chọn sự cố
 * @property {Array<{id: number, coords: [number, number], description: string, time: string}>} [fieldReports] - Báo cáo hiện trường của người dân
 * @property {Object|null} [aoi] - GeoJSON FeatureCollection ranh giới vùng giám sát
 */

// Story 4.38/4.39: một bản đồ chỉ gắn popup một lần (React StrictMode tạo bản đồ hai lần); màu theo mức rủi ro dùng chung cho vùng và chấm.
const confirmedClickBound = new WeakSet();
const CONFIRMED_LAYERS = ['confirmed-landslides-fill', 'confirmed-landslides-line', 'confirmed-landslides-dot'];
const riskClickBound = new WeakSet();
const RISK_LAYERS = ['gru-risk-fill', 'gru-risk-line', 'gru-risk-dot'];
// Story 4.40: popup mở ra phía trên điểm bấm; nếu điểm quá gần mép trên thì kéo bản đồ xuống để popup không chui dưới thanh điều khiển.
const POPUP_ROOM_PX = 260;
const focusPopup = (map, lngLat) => {
  const h = map.getCanvas().clientHeight;
  if (map.project(lngLat).y < POPUP_ROOM_PX) map.easeTo({ center: lngLat, offset: [0, POPUP_ROOM_PX - h / 2], duration: 300 });
};
const CONFIRMED_COLOR = ['match', ['get', 'risk_level'], 'extreme', '#b91c1c', 'high', '#c2410c', 'medium', '#a16207', '#4b5563'];

/**
 * Component MapViewer - Bản đồ viễn thám giám sát trượt lở 3D thời gian thực (Story 1.1, 1.2, 1.3)
 * @param {MapViewerProps} props
 */
export default function MapViewer({ events, selectedEvent, onSelectEvent, fieldReports = [], aoi = null, confirmed = null, experimentalRisk = null }) {
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

  const fieldReportsRef = useRef(fieldReports);
  const aoiRef = useRef(aoi);
  const confirmedRef = useRef(confirmed);
  const [showConfirmed, setShowConfirmed] = useState(false); // tắt sẵn: nút bật sẽ bay tới các điểm
  const showConfirmedRef = useRef(false);
  const riskRef = useRef(experimentalRisk);
  const aoiFittedRef = useRef(false);
  const [showRisk, setShowRisk] = useState(false); // tắt sẵn: điểm thử nghiệm, chỉ bật khi cán bộ muốn xem
  const showRiskRef = useRef(false);
  const [riskMode, setRiskMode] = useState('gru'); // 'gru' = điểm mô hình, 'rain' = mưa 24h tới theo QĐ 18
  const riskModeRef = useRef('gru');
  const riskCount = usableCount(experimentalRisk?.features, riskMode);

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
          expired: Boolean(ev.expired) || ev.status === 'superseded'
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
            'unavailable', '#94a3b8',
            /* default */ '#10b981'
          ],
          // Hết hạn / bị thay thế: mờ hẳn để không bị nhầm với cảnh báo đang hiệu lực
          'fill-opacity': ['case', ['get', 'expired'], 0.12, 0.45]
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

  // Ranh giới vùng giám sát (AOI) thật từ backend
  const ensureAoiLayer = (map) => {
    if (!map || !map.getStyle()) return;
    const data = aoiRef.current || { type: 'FeatureCollection', features: [] };
    if (map.getSource('aoi-boundaries')) {
      map.getSource('aoi-boundaries').setData(data);
      return;
    }
    map.addSource('aoi-boundaries', { type: 'geojson', data });
    map.addLayer({
      id: 'aoi-boundaries-line',
      type: 'line',
      source: 'aoi-boundaries',
      paint: { 'line-color': '#087B70', 'line-width': 2, 'line-dasharray': [3, 2] }
    });
  };

  // Story 4.38: sạt lở đã được cán bộ xác nhận (phát hiện từ ảnh vệ tinh) - lớp riêng, bật/tắt được
  const ensureConfirmedLayer = (map) => {
    if (!map || !map.getStyle()) return;
    const data = confirmedRef.current || { type: 'FeatureCollection', features: [] };
    const visibility = showConfirmedRef.current ? 'visible' : 'none';
    if (map.getSource('confirmed-landslides')) {
      map.getSource('confirmed-landslides').setData(data);
      map.getSource('confirmed-centres')?.setData(confirmedCentres(data));
      CONFIRMED_LAYERS.forEach(id => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', visibility));
      return;
    }
    map.addSource('confirmed-landslides', { type: 'geojson', data });
    map.addLayer({
      id: 'confirmed-landslides-fill', type: 'fill', source: 'confirmed-landslides', layout: { visibility },
      paint: {
        'fill-color': CONFIRMED_COLOR,
        'fill-opacity': 0.55
      }
    });
    map.addLayer({
      id: 'confirmed-landslides-line', type: 'line', source: 'confirmed-landslides', layout: { visibility },
      paint: { 'line-color': '#111827', 'line-width': 2, 'line-dasharray': [1, 1] }
    });
    // Chấm tròn ở tâm: vùng sạt lở chỉ rộng vài trăm mét, zoom xa sẽ không thấy đa giác
    map.addSource('confirmed-centres', { type: 'geojson', data: confirmedCentres(data) });
    map.addLayer({
      id: 'confirmed-landslides-dot', type: 'circle', source: 'confirmed-centres', layout: { visibility },
      paint: {
        'circle-radius': 9, 'circle-stroke-width': 2.5, 'circle-stroke-color': '#ffffff',
        'circle-color': CONFIRMED_COLOR
      }
    });
    if (!confirmedClickBound.has(map)) {
      confirmedClickBound.add(map);
      map.on('click', ['confirmed-landslides-fill', 'confirmed-landslides-dot'], (e) => {
        const props = e.features?.[0]?.properties;
        if (!props) return;
        // Báo cáo hiện trường nằm đè lên điểm này: chỉ mở một popup (của ghim), tránh hai khung chồng nhau
        if (e.originalEvent?.target?.closest?.('.community-report-marker')) return;
        const { title, lines } = describeConfirmed(props);
        const box = document.createElement('div');
        box.style.cssText = 'color:#0f172a;padding:4px;font-family:sans-serif;max-width:260px';
        const h = document.createElement('div');
        h.style.cssText = 'font-weight:700;font-size:12px;margin-bottom:4px;color:#b91c1c';
        h.textContent = title;
        box.append(h);
        lines.forEach(l => {
          const p = document.createElement('div');
          p.style.cssText = 'font-size:11px;color:#475569';
          p.textContent = l;
          box.append(p);
        });
        new maplibregl.Popup({ offset: 12 }).setLngLat(e.lngLat).setDOMContent(box).addTo(map);
        focusPopup(map, e.lngLat);
      });
    }
  };

  // Điểm GRU thử nghiệm (mưa Open-Meteo + đất/độ dốc), chỉ cán bộ. Nằm dưới vùng dự báo đã duyệt để không che quyết định thật.
  const ensureRiskLayer = (map) => {
    if (!map || !map.getStyle()) return;
    const data = riskRef.current || { type: 'FeatureCollection', features: [] };
    const visibility = showRiskRef.current ? 'visible' : 'none';
    const color = riskModeRef.current === 'rain' ? RAIN_COLOR : RISK_COLOR;
    if (map.getSource('gru-risk')) {
      map.getSource('gru-risk').setData(data);
      map.getSource('gru-risk-centres')?.setData(confirmedCentres(data));
      RISK_LAYERS.forEach(id => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', visibility));
      if (map.getLayer('gru-risk-fill')) map.setPaintProperty('gru-risk-fill', 'fill-color', color);
      if (map.getLayer('gru-risk-dot')) map.setPaintProperty('gru-risk-dot', 'circle-color', color);
      return;
    }
    const below = map.getLayer('landslide-polygons-fill') ? 'landslide-polygons-fill' : undefined;
    const polygons = ['==', ['geometry-type'], 'Polygon'];
    map.addSource('gru-risk', { type: 'geojson', data });
    map.addLayer({ id: 'gru-risk-fill', type: 'fill', source: 'gru-risk', filter: polygons, layout: { visibility },
      paint: { 'fill-color': color, 'fill-opacity': 0.6 } }, below);
    map.addLayer({ id: 'gru-risk-line', type: 'line', source: 'gru-risk', filter: polygons, layout: { visibility },
      paint: { 'line-color': '#4c1d95', 'line-width': 1.5, 'line-dasharray': [2, 1] } }, below);
    // Ô 1 km gần như không thấy khi zoom xa: thêm chấm ở tâm mọi điểm (cả ô lẫn điểm chỉ có toạ độ)
    map.addSource('gru-risk-centres', { type: 'geojson', data: confirmedCentres(data) });
    map.addLayer({ id: 'gru-risk-dot', type: 'circle', source: 'gru-risk-centres', layout: { visibility },
      paint: { 'circle-radius': 9, 'circle-color': color, 'circle-stroke-width': 2, 'circle-stroke-color': '#4c1d95' } }, below);
    if (!riskClickBound.has(map)) {
      riskClickBound.add(map);
      map.on('click', ['gru-risk-fill', 'gru-risk-dot'], (e) => {
        const props = e.features?.[0]?.properties;
        // Vùng dự báo đã duyệt nằm trên: nhường click cho nó (chọn sự cố), không mở thêm popup chồng lên
        if (!props || map.queryRenderedFeatures(e.point, { layers: ['landslide-polygons-fill'].filter(id => map.getLayer(id)) }).length) return;
        const { title, lines } = describeRisk(props);
        const box = document.createElement('div');
        box.style.cssText = 'color:#0f172a;padding:4px;font-family:sans-serif;max-width:280px';
        const h = document.createElement('div');
        h.style.cssText = 'font-weight:700;font-size:12px;margin-bottom:4px;color:#5b21b6';
        h.textContent = title;
        box.append(h);
        lines.forEach(l => {
          const p = document.createElement('div');
          p.style.cssText = 'font-size:11px;color:#475569;margin-top:2px';
          p.textContent = l;
          box.append(p);
        });
        new maplibregl.Popup({ offset: 12 }).setLngLat(e.lngLat).setDOMContent(box).addTo(map);
        focusPopup(map, e.lngLat);
      });
    }
  };

  const toggleRisk = () => {
    if (!showRisk) {
      const bounds = confirmedBounds(riskRef.current);
      if (bounds && mapRef.current) mapRef.current.fitBounds(bounds, { padding: 90, maxZoom: 11, duration: 1500 });
    }
    setShowRisk(v => !v);
  };

  // Bật lớp thì bay tới các điểm (chúng thường nằm xa vùng đang xem); tắt thì chỉ ẩn lớp.
  const toggleConfirmed = () => {
    if (!showConfirmed) {
      const bounds = confirmedBounds(confirmedRef.current);
      if (bounds && mapRef.current) mapRef.current.fitBounds(bounds, { padding: 90, maxZoom: 13, duration: 1500 });
    }
    setShowConfirmed(v => !v);
  };

  // Marker báo cáo hiện trường của người dân (tách biệt với vùng dự báo)
  const renderCommunityReportMarkers = (map) => {
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    fieldReportsRef.current.forEach(rep => {
      const el = document.createElement('div');
      el.className = 'community-report-marker';
      el.innerHTML = `
        <div style="background: #ef4444; color: white; padding: 4px; border-radius: 50%; box-shadow: 0 0 12px #ef4444; cursor: pointer; border: 2px solid #fff; display: flex;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        </div>
      `;

      // Nội dung do người dân nhập: dùng textContent, không bao giờ innerHTML.
      const box = document.createElement('div');
      box.style.cssText = 'color:#0f172a;padding:4px;font-family:sans-serif;max-width:220px';
      const title = document.createElement('div');
      title.style.cssText = 'font-weight:700;font-size:12px;margin-bottom:2px;color:#dc2626';
      title.textContent = '📍 BÁO CÁO HIỆN TRƯỜNG (chưa kiểm chứng)';
      const desc = document.createElement('div');
      desc.style.cssText = 'font-size:11px;color:#475569;margin-bottom:4px';
      desc.textContent = rep.description || '(không có mô tả)';
      const when = document.createElement('div');
      when.style.cssText = 'font-size:9px;color:#64748b';
      when.textContent = 'Thời điểm: ' + (rep.time ? new Date(rep.time).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) + ' (UTC+7)' : '—');
      box.append(title, desc, when);
      const popup = new maplibregl.Popup({ offset: 25 }).setDOMContent(box);
      popup.on('open', () => focusPopup(map, rep.coords));

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
        ensureAoiLayer(map);
        ensureLandslideLayers(map, eventsRef.current);
        ensureConfirmedLayer(map); // sau vùng dự báo để nằm trên: sạt lở thật không bị vùng dự báo che mờ
        ensureRiskLayer(map);
        if (markersRef.current.length === 0) {
          renderCommunityReportMarkers(map);
        }
      });

      map.on('load', () => {
        setMapLoaded(true);
        setMapError(null);

        setupTerrainAndSky(map);
        ensureAoiLayer(map);
        ensureLandslideLayers(map, eventsRef.current);
        ensureConfirmedLayer(map); // sau vùng dự báo để nằm trên: sạt lở thật không bị vùng dự báo che mờ
        ensureRiskLayer(map);
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
        const layers = ['landslide-polygons-fill', 'confirmed-landslides-fill', 'confirmed-landslides-dot', 'gru-risk-fill', 'gru-risk-dot'].filter(id => map.getLayer(id));
        const features = map.queryRenderedFeatures(e.point, { layers });
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
        popup.on('open', () => focusPopup(map, [lng, lat]));

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
      CONFIRMED_LAYERS.forEach(id => map.getLayer(id) && map.moveLayer(id)); // vùng dự báo vừa thêm: đưa lớp xác nhận lên trên
    }
  }, [events, mapLoaded]);

  // 1c. Đồng bộ lớp AOI và marker báo cáo hiện trường khi dữ liệu từ API đến sau
  useEffect(() => {
    aoiRef.current = aoi;
    fieldReportsRef.current = fieldReports;
    if (!mapRef.current || !mapLoaded) return;
    ensureAoiLayer(mapRef.current);
    renderCommunityReportMarkers(mapRef.current);
    // Nothing selected (e.g. no active warning): frame the monitored areas once instead of the wide default view.
    const bounds = !selectedEvent && !aoiFittedRef.current && confirmedBounds(aoi);
    if (bounds) {
      aoiFittedRef.current = true;
      mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 1200 });
    }
  }, [aoi, fieldReports, mapLoaded]);

  // 1d. Lớp sạt lở đã xác nhận: dữ liệu đến sau hoặc người dùng bật/tắt
  useEffect(() => {
    confirmedRef.current = confirmed;
    showConfirmedRef.current = showConfirmed;
    if (!mapRef.current || !mapLoaded) return;
    ensureConfirmedLayer(mapRef.current);
  }, [confirmed, showConfirmed, mapLoaded]);

  // 1e. Lớp GRU thử nghiệm: dữ liệu mới mỗi phút hoặc cán bộ bật/tắt
  useEffect(() => {
    riskRef.current = experimentalRisk;
    showRiskRef.current = showRisk;
    riskModeRef.current = riskMode;
    if (!mapRef.current || !mapLoaded) return;
    ensureRiskLayer(mapRef.current);
  }, [experimentalRisk, showRisk, riskMode, mapLoaded]);

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
          aria-label="Về góc nhìn toàn cảnh mặc định (Toàn Việt Nam)"
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
          aria-label={is3D ? "Chuyển về góc nhìn phẳng 2D" : "Bật góc nhìn khối địa hình 3D"}
          aria-pressed={is3D}
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
            aria-label={isSatellite ? "Chuyển về bản đồ địa hình (vector)" : "Bật nền ảnh vệ tinh thực địa"}
            aria-pressed={isSatellite}
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

        {/* Story 4.38: bật/tắt lớp sạt lở đã xác nhận (chỉ hiện khi có dữ liệu) */}
        {confirmed?.features?.length > 0 && (
          <button
            onClick={toggleConfirmed}
            title="Bật để bay tới các điểm sạt lở đã được cán bộ xác nhận (phát hiện từ ảnh vệ tinh)"
            aria-label={`Sạt lở đã xác nhận (${confirmed.features.length})`}
            aria-pressed={showConfirmed}
            className="map-ctrl-btn"
            style={{
              background: showConfirmed ? '#b91c1c' : 'rgba(255,255,255,0.92)',
              color: showConfirmed ? '#fff' : '#172524',
              border: '1px solid #DCE5E2', padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)', backdropFilter: 'blur(4px)'
            }}
          >
            <MapPinned size={14} />
            <span className="btn-text">Sạt lở đã xác nhận</span>
            <span className="map-ctrl-count">{confirmed.features.length}</span>
          </button>
        )}

        {/* Điểm GRU thử nghiệm từ mưa cập nhật: chỉ cán bộ (trang công dân không truyền dữ liệu này) */}
        {experimentalRisk?.features?.length > 0 && (
          <button
            onClick={toggleRisk}
            title={`Lớp thử nghiệm cho cán bộ: điểm mô hình GRU hoặc mưa 24h tới, cập nhật mỗi giờ. ${riskCount}/${experimentalRisk.features.length} điểm có dữ liệu hiện tại. Không phải xác suất, không phải cảnh báo.`}
            aria-label={`Nguy cơ thử nghiệm GRU (${riskCount} trên ${experimentalRisk.features.length} điểm có dữ liệu hiện tại)`}
            aria-pressed={showRisk}
            className="map-ctrl-btn"
            style={{
              background: showRisk ? '#5b21b6' : 'rgba(255,255,255,0.92)',
              color: showRisk ? '#fff' : '#172524',
              border: '1px solid #DCE5E2', padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)', backdropFilter: 'blur(4px)'
            }}
          >
            <FlaskConical size={14} />
            <span className="btn-text">GRU thử nghiệm</span>
            <span className="map-ctrl-count">{riskCount}/{experimentalRisk.features.length}</span>
          </button>
        )}
      </div>

      {showRisk && experimentalRisk?.features?.length > 0 && (
        <div role="note" aria-label="Chú giải lớp GRU thử nghiệm" style={{
          position: 'absolute', bottom: 52, left: 16, zIndex: 5, background: 'rgba(255,255,255,0.94)',
          border: '1px solid #DCE5E2', borderRadius: 8, padding: '8px 10px', fontSize: 10, color: '#334155', maxWidth: 230
        }}>
          <div role="group" aria-label="Tô màu theo" style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {[['gru', 'Điểm mô hình'], ['rain', 'Mưa 24h tới']].map(([id, label]) => (
              <button key={id} type="button" aria-pressed={riskMode === id} onClick={() => setRiskMode(id)} style={{
                flex: 1, padding: '3px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                border: '1px solid #DCE5E2', background: riskMode === id ? '#5b21b6' : '#fff', color: riskMode === id ? '#fff' : '#334155'
              }}>{label}</button>
            ))}
          </div>
          {riskMode === 'gru' ? <>
            <div style={{ fontWeight: 700, color: '#5b21b6', marginBottom: 4 }}>Điểm mô hình thử nghiệm 0 → 1 (không phải mức nguy cơ)</div>
            <div style={{ height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#ede9fe,#a78bfa,#6d28d9,#3b0764)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}><span>0</span><span>0,3</span><span>0,6</span><span>1</span></div>
            <div style={{ marginTop: 4, color: '#64748b' }}>Đậm thường do đất/địa hình: phần mưa của mô hình hay ở mức 0 hoặc tối đa. Bấm vào ô để xem từng phần.</div>
          </> : <>
            <div style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: 4 }}>Mưa dự báo 24 giờ tới (QĐ 18/2021/QĐ-TTg)</div>
            {[['#dbeafe', 'Chưa tới mưa lớn (≤ 50 mm)'], ['#60a5fa', 'Mưa to (trên 50–100 mm)'], ['#1d4ed8', 'Mưa rất to (trên 100 mm)']].map(([c, t]) => (
              <div key={c}><span style={{ display: 'inline-block', width: 10, height: 10, background: c, borderRadius: 2, verticalAlign: -1, marginRight: 4, border: '1px solid #cbd5e1' }} />{t}</div>
            ))}
            <div style={{ marginTop: 4, color: '#64748b' }}>Lưới mưa Open-Meteo khoảng chục km: các ô gần nhau thường cùng màu.</div>
          </>}
          <div style={{ marginTop: 4 }}><span style={{ display: 'inline-block', width: 10, height: 10, background: '#9ca3af', borderRadius: 2, verticalAlign: -1, marginRight: 4 }} />Xám: chưa có số liệu hoặc số liệu cũ</div>
          <div style={{ marginTop: 4, color: '#64748b' }}>Chỉ để cán bộ tham khảo; không phải xác suất, không phải cảnh báo.</div>
        </div>
      )}

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
