import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { Undo2, Trash2 } from 'lucide-react';
import { areaKm2, parseRing, ringToJson, selfIntersects } from '../utils/aoiRing';

if (typeof maplibregl.setWorkerUrl === 'function') maplibregl.setWorkerUrl(workerUrl);

// Nền raster tự chứa: không cần tải style JSON, nên polygon vẫn vẽ được khi mạng chập chờn.
const BASEMAP = {
  version: 8,
  sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19,
    attribution: '© OpenStreetMap contributors' } },
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#1e293b' } }, { id: 'osm', type: 'raster', source: 'osm' }]
};

const outline = (pts) => ({
  type: 'FeatureCollection',
  features: pts.length < 2 ? [] : [
    { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] } }
  ]
});

// Vẽ ranh giới vùng giám sát: bấm để thêm điểm, kéo điểm để chỉnh. `value` là chuỗi JSON của ô tọa độ,
// `onChange` nhận chuỗi JSON mới -> ô nhập tay và bản đồ luôn khớp nhau.
export default function AoiDrawMap({ value, onChange, others }) {
  const host = useRef(null);
  const mapRef = useRef(null);
  const markers = useRef([]);
  const fromMap = useRef(false); // thay đổi do chính bản đồ gây ra: không cần zoom lại
  const [ready, setReady] = useState(false);
  const pts = useMemo(() => parseRing(value), [value]);
  const crossing = useMemo(() => selfIntersects(pts), [pts]);
  const area = areaKm2(pts);
  const ptsRef = useRef(pts);
  ptsRef.current = pts;
  const emit = (next) => { fromMap.current = true; onChange(ringToJson(next)); };
  const emitRef = useRef(emit);
  emitRef.current = emit;

  useEffect(() => {
    const map = new maplibregl.Map({ container: host.current, style: BASEMAP, center: [104.0, 21.9], zoom: 7,
      attributionControl: { compact: true }, doubleClickZoom: false }); // bấm đúp dùng để xóa điểm
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('style.load', () => { // style nhúng sẵn: không phải đợi tải ô bản đồ nền
      map.addSource('others', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }); // các vùng khác, làm mốc
      map.addLayer({ id: 'others-fill', type: 'fill', source: 'others', paint: { 'fill-color': '#64748b', 'fill-opacity': 0.18 } });
      map.addLayer({ id: 'others-line', type: 'line', source: 'others', paint: { 'line-color': '#94a3b8', 'line-width': 1.2, 'line-dasharray': [2, 2] } });
      map.addSource('aoi', { type: 'geojson', data: outline([]) });
      map.addLayer({ id: 'aoi-fill', type: 'fill', source: 'aoi', paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.25 } });
      map.addLayer({ id: 'aoi-line', type: 'line', source: 'aoi', paint: { 'line-color': '#38bdf8', 'line-width': 2 } });
      setReady(true);
    });
    map.on('click', (e) => emitRef.current([...ptsRef.current, [e.lngLat.lng, e.lngLat.lat]]));
    return () => { markers.current = []; map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (ready && others) mapRef.current?.getSource('others')?.setData(others);
  }, [others, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.getSource('aoi').setData(outline(pts));
    markers.current.forEach(m => m.remove());
    markers.current = pts.map((p, i) => {
      const el = document.createElement('div');
      el.title = `Điểm ${i + 1} — kéo để di chuyển, bấm đúp để xóa`;
      el.textContent = String(i + 1);
      el.style.cssText = 'width:22px;height:22px;border-radius:50%;background:#0284c7;border:2px solid #fff;color:#fff;font:700 11px/18px sans-serif;text-align:center;cursor:grab;user-select:none;box-shadow:0 1px 4px rgba(0,0,0,.5)';
      el.addEventListener('click', (ev) => ev.stopPropagation()); // bấm vào điểm có sẵn không được thêm điểm mới
      el.addEventListener('dblclick', (ev) => { ev.stopPropagation(); emitRef.current(ptsRef.current.filter((_, j) => j !== i)); });
      const marker = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(p).addTo(map);
      marker.on('dragend', () => {
        const { lng, lat } = marker.getLngLat();
        emitRef.current(ptsRef.current.map((q, j) => (j === i ? [lng, lat] : q)));
      });
      return marker;
    });
    if (fromMap.current) { fromMap.current = false; return; }
    if (pts.length) {
      const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
      pts.forEach(p => b.extend(p));
      map.fitBounds(b, { padding: 40, maxZoom: 12, duration: 600 });
    }
  }, [pts, ready]);

  const btn = { background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', color: '#cbd5e1',
    padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          Bấm vào bản đồ để thêm điểm · kéo điểm để chỉnh · bấm đúp điểm để xóa · {pts.length} điểm{pts.length < 3 ? ' (cần ít nhất 3)' : ` · ≈ ${area < 10 ? area.toFixed(2) : Math.round(area)} km²`}
          {crossing && <b role="alert" style={{ color: '#f87171' }}> · Ranh giới tự cắt nhau, hãy chỉnh lại các điểm</b>}
        </span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={btn} disabled={!pts.length} onClick={() => emit(pts.slice(0, -1))}><Undo2 size={12} /> Hoàn tác điểm cuối</button>
          <button type="button" style={btn} disabled={!pts.length} onClick={() => emit([])}><Trash2 size={12} /> Xóa hết</button>
        </span>
      </div>
      <div ref={host} data-testid="aoi-draw-map" style={{ height: 280, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,.12)' }} />
    </div>
  );
}
