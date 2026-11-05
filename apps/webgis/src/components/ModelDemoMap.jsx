import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { Map, Grid2X2 } from 'lucide-react';
import { scoreColor } from '../data/modelDemo';

if (typeof maplibregl.setWorkerUrl === 'function') maplibregl.setWorkerUrl(workerUrl);

const basemap = { version: 8, sources: {
  osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256,
    attribution: '© OpenStreetMap contributors', maxzoom: 19 },
}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e9efeb' } },
  { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': .72 } }] };

function GridPreview({ features, selected, threshold, onlyFlagged, showInventory, onSelect }) {
  const cells = features.map(f => {
    const parts = f.properties.unit_id.split('_');
    return { f, x: Number(parts[2]) / 1000, y: Number(parts[3]) / 1000 };
  });
  if (!cells.length) return null;
  const minX = Math.min(...cells.map(c => c.x)) - 1, maxY = Math.max(...cells.map(c => c.y)) + 2;
  const width = Math.max(...cells.map(c => c.x)) - minX + 2;
  const height = maxY - Math.min(...cells.map(c => c.y)) + 1;
  return <svg className="model-grid-preview" viewBox={`${minX} 0 ${width} ${height}`} aria-label="Sơ đồ các ô thật trên lưới UTM 1 km, không có nền bản đồ">
    {cells.map(({ f, x, y }) => {
      const p = f.properties, chosen = p.unit_id === selected;
      return <g key={p.unit_id} role="button" tabIndex={0} aria-label={`Chọn ${p.unit_id}, điểm ${p.p_hazard_slope_soil.toFixed(3)}`}
        onClick={() => onSelect(p.unit_id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.unit_id); } }}>
        <rect x={x} y={maxY-y-1} width={.94} height={.94} fill={scoreColor(p.p_hazard_slope_soil)}
          opacity={onlyFlagged && p.p_hazard_slope_soil < threshold ? .12 : .78}
          stroke={chosen || (showInventory && p.mapped_proxy_label === 1) ? '#142c42' : 'white'}
          strokeWidth={chosen ? .14 : showInventory && p.mapped_proxy_label === 1 ? .08 : .04} />
      </g>;
    })}
  </svg>;
}

export default function ModelDemoMap({ features, selected, threshold, onlyFlagged, showInventory, onSelect }) {
  const host = useRef(null), mapRef = useRef(null), selectRef = useRef(onSelect);
  const [grid, setGrid] = useState(false), [mapError, setMapError] = useState(false);
  const [tilesUnavailable, setTilesUnavailable] = useState(false), [loaded, setLoaded] = useState(false);
  selectRef.current = onSelect;
  useEffect(() => {
    if (grid || !host.current) return undefined;
    let map;
    try {
      map = new maplibregl.Map({ container: host.current, style: basemap, center: [107, 17], zoom: 8,
        attributionControl: { compact: true } });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.on('load', () => {
        map.addSource('demo-cells', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'demo-fill', type: 'fill', source: 'demo-cells', paint: {
          'fill-color': ['step', ['get', 'p_hazard_slope_soil'], '#268378', .26, '#aa800c', .5, '#d46522', .65, '#ad352b'],
          'fill-opacity': .65 } });
        map.addLayer({ id: 'demo-line', type: 'line', source: 'demo-cells', paint: { 'line-color': '#ffffff', 'line-width': .6 } });
        map.addLayer({ id: 'demo-inventory', type: 'line', source: 'demo-cells', filter: ['==', ['get', 'mapped_proxy_label'], 1],
          paint: { 'line-color': '#152d43', 'line-width': 2 } });
        map.addLayer({ id: 'demo-selected', type: 'line', source: 'demo-cells', filter: ['==', ['get', 'unit_id'], ''],
          paint: { 'line-color': '#102a43', 'line-width': 4 } });
        map.on('click', 'demo-fill', e => { if (e.features?.[0]) selectRef.current(e.features[0].properties.unit_id); });
        map.on('mouseenter', 'demo-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'demo-fill', () => { map.getCanvas().style.cursor = ''; });
        setLoaded(true);
      });
      map.on('error', () => setTilesUnavailable(true));
    } catch {
      setMapError(true);
      setGrid(true);
    }
    const observer = new ResizeObserver(() => map?.resize());
    if (host.current) observer.observe(host.current);
    return () => { observer.disconnect(); map?.remove(); mapRef.current = null; setLoaded(false); };
  }, [grid]);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map?.getSource('demo-cells')) return;
    map.getSource('demo-cells').setData({ type: 'FeatureCollection', features });
    if (features.length) {
      const bounds = new maplibregl.LngLatBounds();
      features.forEach(f => f.geometry.coordinates[0].forEach(c => bounds.extend(c)));
      map.fitBounds(bounds, { padding: 48, duration: 0, maxZoom: 12 });
    }
  }, [features, loaded]);
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map?.getLayer('demo-fill')) return;
    map.setFilter('demo-selected', ['==', ['get', 'unit_id'], selected || '']);
    map.setPaintProperty('demo-fill', 'fill-opacity', onlyFlagged
      ? ['case', ['>=', ['get', 'p_hazard_slope_soil'], threshold], .75, .08] : .65);
    map.setLayoutProperty('demo-inventory', 'visibility', showInventory ? 'visible' : 'none');
  }, [selected, threshold, onlyFlagged, showInventory, loaded]);

  return <div className="model-map-shell">
    {grid ? <GridPreview {...{ features, selected, threshold, onlyFlagged, showInventory, onSelect }} /> : <div ref={host} className="model-map-canvas" />}
    <div className="model-map-switch" aria-label="Chế độ bản đồ">
      <button type="button" className={!grid ? 'active' : ''} disabled={mapError} onClick={() => setGrid(false)}><Map size={15} /> Bản đồ</button>
      <button type="button" className={grid ? 'active' : ''} onClick={() => setGrid(true)}><Grid2X2 size={15} /> Lưới ngoại tuyến</button>
    </div>
    {(grid || tilesUnavailable) && <p className="model-map-note">{grid ? 'Sơ đồ ô UTM 1 km, không có nền bản đồ.' : 'Nếu nền bản đồ chưa tải, bạn vẫn xem được các ô hoặc chọn Lưới ngoại tuyến.'}</p>}
    <div className="model-map-legend"><strong>Điểm mô hình</strong>
      {[['#268378', '< 0,26'], ['#aa800c', '0,26–0,50'], ['#d46522', '0,50–0,65'], ['#ad352b', '≥ 0,65']].map(([color, text]) => <span key={text}><i style={{ background: color }} />{text}</span>)}
      <small>Viền đậm: ô có điểm kiểm kê · Không phải xác suất</small>
    </div>
  </div>;
}
