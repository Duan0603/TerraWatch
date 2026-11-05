import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Download, Mountain, RefreshCw, ShieldCheck } from 'lucide-react';
import ModelDemoMap from '../components/ModelDemoMap';
import { dateText, loadDemoJson, numberText, scoreText, summarize } from '../data/modelDemo';
import './ModelDemoPage.css';

const percent = value => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
const numericRow = (label, value, unit) => <div><dt>{label}</dt><dd>{numberText(value)} <small>{unit}</small></dd></div>;

function CellDetail({ cell, threshold }) {
  if (!cell) return <section className="model-cell-detail"><h2>Chi tiết ô lưới</h2><p>Chọn một ô trên bản đồ hoặc trong danh sách để xem đầu vào và kết quả.</p></section>;
  const p = cell.properties, daily = p.history_24h_totals;
  const maxRain = daily ? Math.max(...daily, 1) : 1;
  return <section className="model-cell-detail" aria-label="Chi tiết ô đã chọn">
    <h2>Ô đang xem <span>1 km × 1 km</span></h2>
    <p className="model-unit-id">{p.unit_id}</p>
    <div className="model-score-equation" aria-label="Điểm hai nhánh và điểm nguy cơ">
      <div><strong>{scoreText(p.p_temporal_gru)}</strong><span>Mưa · GRU</span></div><b>×</b>
      <div><strong>{scoreText(p.p_spatial_12dist_slope_soil)}</strong><span>Địa hình · đất</span></div><b>=</b>
      <div className="model-score-result"><strong>{scoreText(p.p_hazard_slope_soil)}</strong><span>Điểm nguy cơ</span></div>
    </div>
    <p className="model-cell-status">{p.p_hazard_slope_soil >= threshold ? 'Vượt' : 'Dưới'} ngưỡng thử {threshold.toFixed(2)} · {p.mapped_proxy_label ? 'Ô có điểm trong kiểm kê' : 'Ô nền proxy, chưa xác minh không sạt lở'}</p>
    <h3>Đầu vào của ô</h3>
    <dl className="model-inputs">
      {numericRow('Độ dốc', p.slope_deg, '°')}
      {numericRow('Tỷ lệ sét', p.clay_pct, '%')}
      {numericRow('Tỷ lệ cát', p.sand_pct, '%')}
      {numericRow('Khối lượng thể tích', p.bulk_density_g_cm3, 'g/cm³')}
      {numericRow('Mưa 24 giờ trước', p.rain_past_24h_mm, 'mm')}
      {numericRow('Mưa 168 giờ trước', p.rain_past_168h_mm, 'mm')}
      {numericRow('GFS 24 giờ mục tiêu', p.forecast_24h_mm, 'mm')}
    </dl>
    {daily && <figure className="model-rain-chart">
      <figcaption>Mưa trước mốc dự báo <span>7 khoảng × 24 giờ · mm</span></figcaption>
      <svg viewBox="0 0 280 98" role="img" aria-label={`Mưa trong bảy khoảng 24 giờ: ${daily.map(numberText).join(', ')} milimét`}>
        {daily.map((rain, i) => {
          const height = Math.max(rain / maxRain * 55, 1);
          return <g key={i}><rect x={i*40+4} y={70-height} width={29} height={height} rx={2} />
            <text x={i*40+18} y={Math.max(70-height-5, 10)} textAnchor="middle">{Math.round(rain)}</text>
            <text x={i*40+18} y={89} textAnchor="middle">−{7-i}</text></g>;
        })}
      </svg>
    </figure>}
    <p className="model-detail-footnote">Điểm đã tính sẵn từ checkpoint. Dữ liệu nền của mô hình không bao gồm độ ẩm đất tức thời hay khảo sát địa kỹ thuật tại ô này.</p>
  </section>;
}

export default function ModelDemoPage() {
  const [index, setIndex] = useState(null), [scenarioId, setScenarioId] = useState('');
  const [features, setFeatures] = useState([]), [selectedId, setSelectedId] = useState('');
  const [threshold, setThreshold] = useState(.5), [onlyFlagged, setOnlyFlagged] = useState(false);
  const [showInventory, setShowInventory] = useState(true), [query, setQuery] = useState('');
  const [visibleRows, setVisibleRows] = useState(30), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(''); setLoading(true);
    loadDemoJson('index.json', controller.signal).then(data => {
      setIndex(data); setScenarioId(data.defaultScenario);
    }).catch(e => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false); } });
    return () => controller.abort();
  }, [retry]);
  const scenario = index?.scenarios.find(s => s.id === scenarioId);
  useEffect(() => {
    if (!scenario) return undefined;
    const controller = new AbortController();
    setLoading(true); setError(''); setFeatures([]); setSelectedId(''); setQuery(''); setVisibleRows(30);
    loadDemoJson(scenario.url, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length) throw new Error('Kịch bản chưa có ô dữ liệu. Hãy chọn ngày khác.');
      setFeatures(data.features);
      const best = [...data.features].sort((a,b) => b.properties.p_hazard_slope_soil-a.properties.p_hazard_slope_soil)[0];
      setSelectedId(best.properties.unit_id); setLoading(false);
    }).catch(e => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false); } });
    return () => controller.abort();
  }, [scenario, retry]);

  const stats = useMemo(() => summarize(features, threshold), [features, threshold]);
  const selected = features.find(f => f.properties.unit_id === selectedId);
  const sorted = useMemo(() => features.filter(f => f.properties.unit_id.toLowerCase().includes(query.toLowerCase()))
    .sort((a,b) => b.properties.p_hazard_slope_soil - a.properties.p_hazard_slope_soil), [features, query]);
  const districts = [...new Set(index?.scenarios.map(s => s.district) || [])];
  const download = () => {
    const csv = ['unit_id,target_local_date,hazard_score,temporal_score,spatial_score,mapped_proxy_label,above_experimental_threshold',
      ...features.map(({properties:p}) => [p.unit_id,p.target_local_date,p.p_hazard_slope_soil,p.p_temporal_gru,p.p_spatial_12dist_slope_soil,p.mapped_proxy_label,Number(p.p_hazard_slope_soil>=threshold)].join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `terrawatch-replay-${scenario.id}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return <div className="model-demo-page">
    <header className="model-demo-header">
      <Link to="/" className="model-back-link"><ArrowLeft size={17} /><span>TerraWatch</span></Link>
      <div className="model-demo-title"><h1>Demo mô hình sạt lở</h1><span>GRU–MIL × địa hình và đất · Lưới 1 km</span></div>
      <span className="model-replay-tag">Phát lại dữ liệu lịch sử</span>
    </header>
    <p className="model-research-notice"><ShieldCheck size={17} />Mô hình nghiên cứu, chưa dùng để cảnh báo thực tế. Điểm nguy cơ không phải xác suất sạt lở.</p>
    <main className="model-demo-layout">
      <aside className="model-demo-controls" aria-label="Chọn kịch bản demo">
        <h2>Kịch bản lịch sử</h2>
        <label htmlFor="model-district">Khu vực</label>
        <select id="model-district" value={scenario?.district || ''} disabled={!index || loading} onChange={e => {
          const next = index.scenarios.find(s => s.district === e.target.value && s.eventDay); setScenarioId(next.id);
        }}>{districts.map(d => <option key={d}>{d}</option>)}</select>
        <label htmlFor="model-date">Ngày mục tiêu · giờ Việt Nam</label>
        <select id="model-date" value={scenarioId} disabled={!index || loading} onChange={e => setScenarioId(e.target.value)}>
          {index?.scenarios.filter(s => s.district === scenario?.district).map(s => <option key={s.id} value={s.id}>{dateText(s.date)} · {s.eventDay ? 'Ngày sự kiện nguồn' : 'Ngày nền chọn mẫu'}</option>)}
        </select>
        <p className="model-scenario-meta">{scenario ? `${scenario.split === 'test' ? 'Tập test' : 'Tập validation'} · ${scenario.cells} ô · 00:00–24:00` : 'Đang đọc danh mục…'}</p>
        <div className="model-threshold-heading"><label htmlFor="model-threshold">Ngưỡng thử nghiệm</label><output htmlFor="model-threshold">{threshold.toFixed(2)}</output></div>
        <input id="model-threshold" type="range" min="0.05" max="0.95" step="0.01" value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
        <div className="model-presets">{[.26,.5,.65].map(t => <button type="button" key={t} aria-pressed={threshold === t} onClick={() => setThreshold(t)}>{t.toFixed(2)}</button>)}</div>
        <label className="model-check"><input type="checkbox" checked={onlyFlagged} onChange={e => setOnlyFlagged(e.target.checked)} />Làm mờ ô dưới ngưỡng</label>
        <label className="model-check"><input type="checkbox" checked={showInventory} onChange={e => setShowInventory(e.target.checked)} />Đối chiếu ô có điểm kiểm kê</label>
        <div className="model-scenario-stats" aria-live="polite">
          <p><span>Ô vượt ngưỡng</span><strong>{stats.flagged} / {stats.total}</strong></p>
          <p><span>Khớp ô dương proxy</span><strong>{stats.tp} / {stats.tp+stats.fn}</strong></p>
          <p><span>Ô nền bị báo dương</span><strong>{stats.fp}</strong></p>
          <p><span>Precision / Recall</span><strong>{percent(stats.precision)} / {percent(stats.recall)}</strong></p>
          <small>Chỉ số của khu vực/ngày đang xem, đối chiếu nhãn proxy.</small>
        </div>
        <div className="model-cell-list-heading"><h3>Danh sách ô</h3><span>{sorted.length}</span></div>
        <label className="model-search-label" htmlFor="model-cell-search">Tìm theo mã ô</label>
        <input id="model-cell-search" type="search" placeholder="Ví dụ: 665000_1850000" value={query} onChange={e => { setQuery(e.target.value); setVisibleRows(30); }} />
        <div className="model-cell-list">
          {sorted.slice(0,visibleRows).map(f => {
            const p=f.properties;
            return <button type="button" key={p.unit_id} aria-pressed={p.unit_id === selectedId} className={`model-cell-row ${p.unit_id === selectedId ? 'selected' : ''}`} onClick={() => setSelectedId(p.unit_id)}>
              <span><strong>{p.unit_id.replace('UTM48N_1km_', '')}</strong><small>{p.mapped_proxy_label ? 'Có điểm kiểm kê' : 'Nền proxy'}</small></span><b>{scoreText(p.p_hazard_slope_soil)}</b><ChevronRight size={14} />
            </button>;
          })}
          {!sorted.length && !loading && <p className="model-no-results">Không có ô khớp mã tìm kiếm.</p>}
          {sorted.length > visibleRows && <button type="button" className="model-load-more" onClick={() => setVisibleRows(n => n+30)}>Xem thêm 30 ô</button>}
        </div>
        <button type="button" className="model-export" disabled={!features.length || loading} onClick={download}><Download size={16} />Tải kết quả đang xem</button>
      </aside>
      <section className="model-demo-map-area" aria-label="Bản đồ kết quả mô hình">
        {loading ? <div className="model-map-state" role="status"><RefreshCw size={28} /><h2>Đang tải kịch bản lịch sử</h2><p>Đọc kết quả thật đã xuất từ mô hình…</p></div>
          : error ? <div className="model-map-state" role="alert"><Mountain size={30} /><h2>Chưa tải được kịch bản</h2><p>{error}</p><button type="button" onClick={() => setRetry(n => n+1)}>Thử lại</button></div>
            : <ModelDemoMap {...{ features, threshold, onlyFlagged, showInventory }} selected={selectedId} onSelect={setSelectedId} />}
      </section>
      <aside className="model-demo-detail-area"><CellDetail cell={selected} threshold={threshold} />
        <details className="model-about"><summary>Về mô hình và kết quả đánh giá</summary>
          <p>GRU học lịch sử mưa 168 giờ và GFS 24 giờ bằng MIL theo túi sự kiện. Logistic Regression học độ dốc và ba biến đất trên 7.060 ô.</p>
          <p>Tập test: 2.521 dòng; tại ngưỡng 0,50, recall 87,28%, precision 40,11%. Nhãn nền là proxy; đây chưa phải đánh giá cảnh báo liên tục.</p>
          <p>Đang phát lại điểm đã tính sẵn, không gọi dự báo thời tiết hiện tại hay phát cảnh báo tới người dân.</p>
          <a href="https://github.com/Duan0603/TerraWatch/blob/demo/landslide-two-branch-model/gpu-training-kit/experiments/vietnam_1km_two_branch_gru/THUYET_TRINH_MO_HINH_VI.md" target="_blank" rel="noreferrer">Tài liệu mô hình và thuyết trình</a>
        </details>
      </aside>
    </main>
  </div>;
}
