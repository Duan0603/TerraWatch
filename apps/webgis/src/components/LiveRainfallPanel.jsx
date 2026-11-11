import React, { useEffect, useState } from 'react';
import { CloudRain, RefreshCw, ChevronDown, ChevronUp, Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudLightning, Snowflake, HelpCircle } from 'lucide-react';
import { weatherKind, dayLabel, numberText, rainLevel24h, hourLabel } from '../utils/weather';
import './LiveRainfallPanel.css';

const WEATHER_ICONS = { clear: Sun, partly: CloudSun, cloudy: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, snow: Snowflake, storm: CloudLightning, unknown: HelpCircle };
function WeatherIcon({ code, size = 18 }) {
  const { kind, label } = weatherKind(code), Icon = WEATHER_ICONS[kind];
  return <Icon size={size} role="img" aria-label={label}><title>{label}</title></Icon>;
}

const valueText = value => value === null || value === undefined ? 'Chưa đủ dữ liệu' : `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value)} mm`;
const timeText = value => value ? new Date(value).toLocaleString('vi-VN', { hour12: false }) : 'Chưa có lần lấy thành công';

export default function LiveRainfallPanel({ selectedEvent }) {
  const [snapshot, setSnapshot] = useState(null), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [reload, setReload] = useState(0), [collapsed, setCollapsed] = useState(false);
  const latitude = selectedEvent?.lat, longitude = selectedEvent?.lng;
  useEffect(() => {
    let controller;
    let active = true;
    async function read() {
      controller?.abort(); controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const configured = import.meta.env.VITE_API_BASE_URL;
        const base = configured || (['5173', '5174'].includes(window.location.port)
          ? `${window.location.protocol}//${window.location.hostname}:8080` : window.location.origin);
        const params = new URLSearchParams({ latitude, longitude });
        const response = await fetch(`${base}/api/v1/gis/rainfall/live?${params}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.detail || 'Dịch vụ mưa chưa sẵn sàng.');
        if (active) { setSnapshot(body); setError(''); }
      } catch (e) {
        if (active) setError(e.name === 'AbortError' ? 'Dịch vụ mưa phản hồi chậm. Sẽ tự kiểm tra lại.' : e.message);
      } finally { clearTimeout(timer); if (active) setLoading(false); }
    }
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      read(); const interval = setInterval(read, 60000);
      return () => { active = false; controller?.abort(); clearInterval(interval); };
    }
    setError('Điểm đang xem chưa có tọa độ hợp lệ.'); setLoading(false);
    return () => { active = false; };
  }, [latitude, longitude, reload]);

  const data = snapshot?.data;
  const prediction = data?.gru_inference;
  const weather = data?.weather, now = weather?.current;
  const stale = error || snapshot?.stale;
  const chart = data?.hourly.filter(h => {
    const delta = (new Date(h.interval_end)-new Date(data.as_of))/3600000;
    return delta > -12 && delta <= 12;
  }) || [];
  const peak = Math.max(0, ...chart.map(h => h.mm || 0)), max = Math.max(peak, 1);
  const nowIndex = chart.findIndex(h => h.kind === 'forecast');
  const windowCard = (label, w) => {
    const level = rainLevel24h(w.mm);
    return <div><dt>{label}<small>{hourLabel(w.start)} → {hourLabel(w.end)}</small></dt><dd>{valueText(w.mm)}</dd>
      {level && <span className={`live-rain-level live-rain-level-${level.level}`}>{level.label}</span>}</div>;
  };
  return <section className="live-rain-panel" aria-label="Dữ liệu mưa cập nhật">
    <header><div><CloudRain size={18} /><h2>Mưa & thời tiết theo khu vực</h2></div>
      <button type="button" onClick={() => setCollapsed(v => !v)} aria-expanded={!collapsed} aria-label={collapsed ? 'Mở bảng mưa' : 'Thu gọn bảng mưa'}>{collapsed ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button>
    </header>
    {!collapsed && <div className="live-rain-body">
      <p className="live-rain-location">{selectedEvent.location}<br />{latitude?.toFixed(4)}°N, {longitude?.toFixed(4)}°E</p>
      <p className="live-rain-source">Open-Meteo · Ước tính từ mô hình khí tượng, không phải số đo trạm.</p>
      <div className="live-rain-status" role="status">
        {loading ? 'Đang đọc dữ liệu cập nhật…' : data ? (stale ? 'Dữ liệu cũ / cập nhật chưa thành công' : data.quality === 'complete' ? 'Đã có dữ liệu cập nhật' : 'Dữ liệu chưa đủ giờ') : 'Chưa có dữ liệu mưa'}
      </div>
      {error && <p className="live-rain-error" role="alert">{error}</p>}
      {snapshot?.last_error && <p className="live-rain-error">Nguồn chưa cập nhật thành công: {snapshot.last_error}. Giữ lần lấy thành công gần nhất nếu có.</p>}
      {data && <>
        <dl className="live-rain-values">
          {windowCard('Mưa 24 giờ đã qua', data.history['24'])}
          <div><dt>Mưa 72 giờ đã qua<small>{hourLabel(data.history['72'].start)} → {hourLabel(data.history['72'].end)}</small></dt><dd>{valueText(data.history['72'].mm)}</dd></div>
          {windowCard('Dự báo 24 giờ tới', data.forecast_24h)}
        </dl>
        <p className="live-rain-coverage">Lịch sử: {data.history['168'].valid_hours}/168 giờ · Dự báo: {data.forecast_24h.valid_hours}/24 giờ. Khoảng thiếu được giữ trống.<br />
          Cấp mưa theo QĐ 18/2021/QĐ-TTg: mưa to trên 50–100 mm/24h, mưa rất to trên 100 mm/24h. Đây là phân loại lượng mưa, không phải mức nguy cơ sạt lở.</p>
        <figure className="live-rain-chart"><figcaption>Mưa theo giờ · mm <span>12 giờ đã qua / 12 giờ tới · {peak > 0 ? `cột cao nhất ${valueText(peak)}/giờ` : 'không có mưa trong khoảng này'}</span></figcaption>
          <svg viewBox="0 0 312 90" role="img" aria-label="Mưa ước tính và dự báo theo giờ; khoảng trống biểu thị dữ liệu thiếu">
            {nowIndex > 0 && <g className="live-rain-now">
              <line x1={nowIndex*13} x2={nowIndex*13} y1={11} y2={67} />
              <text x={nowIndex*13} y={8} textAnchor="middle">Bây giờ</text>
            </g>}
            {chart.map((h,i) => <g key={h.interval_end}>
              {h.mm !== null ? <rect x={i*13+2} y={65-Math.max(h.mm/max*48,1)} width={9} height={Math.max(h.mm/max*48,1)} fill={h.kind === 'forecast' ? '#b45b17' : '#087b70'}><title>{timeText(h.interval_end)}: {h.mm} mm ({h.kind === 'forecast' ? 'dự báo' : 'ước tính đã qua'})</title></rect> : <text x={i*13+3} y={63}>×</text>}
              {i%4===0 && <text x={i*13+5} y={84} textAnchor="middle">{new Date(h.interval_end).getHours()}h</text>}
            </g>)}
          </svg>
          <div className="live-rain-chart-key"><span><i className="past" />Ước tính đã qua</span><span><i className="forecast" />Dự báo</span><span>× thiếu dữ liệu</span></div>
        </figure>
        {weather ? <section className="live-weather" aria-label="Thời tiết 7 ngày tới">
          <h3>Thời tiết 7 ngày tới</h3>
          {now && <div className="live-weather-now">
            <WeatherIcon code={now.weather_code} size={30} />
            <strong>{numberText(now.temperature_2m, '°C', 1)}</strong>
            <p>{weatherKind(now.weather_code).label} · lúc {timeText(now.at)}<br />
              Độ ẩm {numberText(now.relative_humidity_2m, '%')} · Gió {numberText(now.wind_speed_10m, ' km/h')} · Khả năng mưa {numberText(now.precipitation_probability, '%')}</p>
          </div>}
          <table className="live-weather-days" aria-label="Dự báo theo ngày">
            <thead><tr><th scope="col">Ngày</th><th scope="col">Trời</th><th scope="col">Nhiệt độ</th><th scope="col">Mưa</th><th scope="col">Khả năng</th></tr></thead>
            <tbody>{weather.daily.map((d, i) => <tr key={d.date}>
              <th scope="row">{dayLabel(d.date, i)}</th>
              <td><WeatherIcon code={d.weather_code} /></td>
              <td>{numberText(d.temp_min_c, '°')} – {numberText(d.temp_max_c, '°')}</td>
              <td className={`live-rain-level-${rainLevel24h(d.rain_mm)?.level || 'none'}`} title={rainLevel24h(d.rain_mm)?.label}>{d.rain_mm === null ? <span title="Thiếu giờ nên không cộng tổng">{d.rain_valid_hours}/24 giờ</span> : numberText(d.rain_mm, ' mm', 1)}</td>
              <td>{numberText(d.precip_probability_max_pct, '%')}</td>
            </tr>)}</tbody>
          </table>
          <p className="live-rain-coverage">Ngày theo giờ Việt Nam; mưa "Hôm nay" gồm cả các giờ đã qua. Ngày thiếu giờ không cộng tổng. Nhiệt độ, gió và khả năng mưa là dự báo mô hình Open-Meteo, chỉ để tham khảo, không dùng để tự phát cảnh báo.</p>
        </section> : <p className="live-rain-coverage">Chưa có bảng thời tiết cho snapshot này; sẽ có sau lần lấy dữ liệu kế tiếp.</p>}
        {prediction?.ready ? <section className="live-gru-result" aria-label="Dự báo tự động thử nghiệm">
          <h3>GRU · Dự báo tự động 24 giờ</h3>
          <p className="live-gru-equation"><span>{prediction.temporal_score.toFixed(3)} <small>Mưa</small></span><b>×</b>
            <span>{prediction.spatial_score.toFixed(3)} <small>Địa hình · đất</small></span><b>=</b>
            <span><strong>{prediction.hazard_score.toFixed(3)}</strong> <small>Điểm nguy cơ</small></span></p>
          <p className="live-gru-period">{timeText(prediction.issue_time)} → {timeText(prediction.valid_until)}<br />{prediction.unit_id}</p>
          {(stale || new Date(prediction.valid_until) <= new Date()) && <p className="live-rain-error">Kết quả cũ hoặc đầu vào chưa cập nhật. Không dùng như dự báo mới.</p>}
          <p className="live-rain-model-hold">Dự báo thử nghiệm: Open-Meteo khác nguồn IMERG + GFS khi train; mốc chạy là giờ cập nhật hiện tại. Điểm chưa phải xác suất và không tự phát cảnh báo.</p>
          <details><summary>Đất và độ dốc dùng cho ô này</summary><p className="live-gru-period">
            Dốc {prediction.static_values.slope_deg.toFixed(1)}° · Sét {prediction.static_values.clay_pct.toFixed(1)}% · Cát {prediction.static_values.sand_pct.toFixed(1)}% · Khối lượng thể tích {prediction.static_values.bulk_density_g_cm3.toFixed(2)} g/cm³.
          </p></details>
        </section> : <p className="live-rain-model-hold">GRU chưa có kết quả: {prediction?.reason || 'đang chờ đầu vào và mô hình'}. Tác vụ sẽ tự thử lại; không tạo điểm giả.</p>}
      </>}
      <footer><span>Lấy thành công: {timeText(snapshot?.last_success_at)}<br />Server tự lấy mỗi {Math.round((snapshot?.refresh_interval_seconds || 3600)/60)} phút; web kiểm tra mỗi phút.</span>
        <button type="button" onClick={() => { setLoading(true); setReload(n => n+1); }} aria-label="Đọc lại dữ liệu mưa đã lưu"><RefreshCw size={15} /></button>
      </footer>
      <a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">Nguồn dữ liệu và phương pháp</a>
    </div>}
  </section>;
}
