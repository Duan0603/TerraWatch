import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { hourlySlots, forecastChecks, linePaths } from '../utils/rainHistory';
import { numberText, scoreText } from '../utils/weather';
import { fmtVN } from '../utils/time';
import { toCsv, downloadCsv } from '../utils/csv';

const VN = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', hourCycle: 'h23' });
const vnParts = t => Object.fromEntries(VN.formatToParts(new Date(t)).map(p => [p.type, p.value]));
const W = 312, X0 = 6, PLOT_W = 262, Y0 = 12, Y1 = 82;
const mm = v => numberText(v, ' mm', 1);
const ORIGIN_TEXT = { live: 'máy chủ lấy đúng giờ', github_archive: 'GitHub Actions lấy đúng giờ', backfill: 'bù sau từ lần lấy muộn hơn' };

const CSV_COLUMNS = [
  { label: 'Giờ dữ liệu (UTC+7)', value: r => fmtVN(r.as_of) }, { label: 'Lấy lúc (UTC+7)', value: r => fmtVN(r.fetched_at) },
  { label: 'Mưa 1h (mm)', value: r => r.rain_1h_mm }, { label: 'Mưa 24h (mm)', value: r => r.rain_24h_mm },
  { label: 'Mưa 72h (mm)', value: r => r.rain_72h_mm }, { label: 'Mưa 168h (mm)', value: r => r.rain_168h_mm },
  { label: 'Dự báo 24h (mm)', value: r => r.forecast_24h_mm }, { label: 'Chất lượng', value: r => r.quality },
  { label: 'Điểm GRU', value: r => r.hazard_score }, { label: 'Điểm mưa GRU', value: r => r.temporal_score },
  { label: 'Mã mô hình', value: r => r.model_id }, { label: 'Nguồn ghi', value: r => ORIGIN_TEXT[r.origin] || r.origin }
];

// Lịch sử mưa máy chủ đã ghi mỗi giờ. Công dân xem biểu đồ; cán bộ thêm điểm GRU, dự báo so với thực tế và CSV.
export default function RainHistory({ apiBase, latitude, longitude, showModel }) {
  const [body, setBody] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ latitude, longitude, days: 7 });
    fetch(`${apiBase}/api/v1/gis/rainfall/live/history?${params}`, { signal: controller.signal })
      .then(async response => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.detail || 'Chưa đọc được lịch sử mưa.');
        setBody(json); setError('');
      })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [apiBase, latitude, longitude]);

  if (error) return <p className="live-rain-error" role="alert">{error}</p>;
  if (!body) return <div className="live-rain-status" role="status">Đang đọc lịch sử mưa…</div>;
  const items = body.items, th = body.thresholds_24h;
  if (!items.length) return <p className="live-rain-coverage">Điểm này chưa có giờ nào được ghi. Máy chủ ghi mỗi giờ một lần khi đang chạy.</p>;

  const slots = hourlySlots(items), n = slots.length, gaps = slots.filter(s => !s.row).length;
  const filled = items.filter(r => r.origin === 'backfill').length;
  const peak = items.reduce((m, r) => r.rain_24h_mm != null && (!m || r.rain_24h_mm > m.rain_24h_mm) ? r : m, null);
  const top = Math.max(1, (th?.p99 || 0) * 1.15, peak?.rain_24h_mm || 0);
  const step = n > 1 ? PLOT_W / (n - 1) : 0;
  const x = i => X0 + i * step, y = v => Y1 - v / top * (Y1 - Y0);
  // Start and end always carry hour + date; midnights in between only the date, dropped if they would touch an end label.
  const midnights = slots.map((s, i) => [s, i]).filter(([s, i]) => vnParts(s.t).hour === '00' && x(i) - x(0) > 60 && x(n - 1) - x(i) > 60);
  const ticks = [[slots[0], 0, false], ...midnights.map(([s, i]) => [s, i, true]), ...(n > 1 ? [[slots.at(-1), n - 1, false]] : [])];
  const tickText = (s, short) => { const p = vnParts(s.t); return short ? `${p.day}/${p.month}` : `${p.hour}h ${p.day}/${p.month}`; };
  const checks = forecastChecks(items).reverse();
  const scored = items.filter(r => r.hazard_score != null);
  const scoreTop = Math.max(0.01, ...scored.map(r => r.hazard_score));
  const best = scored.reduce((m, r) => !m || r.hazard_score > m.hazard_score ? r : m, null);
  const models = [...new Set(scored.map(r => r.model_id))];

  return <section className="rain-history" aria-label="Lịch sử mưa đã ghi">
    <p className="live-rain-coverage">
      {n - gaps} giờ đã ghi từ {fmtVN(slots[0].t)}{filled ? `, trong đó ${filled} giờ bù sau` : ''}{gaps ? ` · ${gaps} giờ trống vì máy chủ không chạy` : ''}.<br />
      Mưa 24h cao nhất: <strong>{mm(peak?.rain_24h_mm)}</strong>{peak && ` lúc ${fmtVN(peak.as_of)}`}.
    </p>
    <figure className="live-rain-chart"><figcaption>Mưa 24 giờ tích lũy · mm <span>Mỗi điểm là một lần ghi theo giờ{th ? ` · đường nét đứt: ngưỡng 95% và 99% của nơi này (${th.period})` : ''}</span></figcaption>
      <svg viewBox={`0 0 ${W} 100`} role="img" aria-label={`Mưa 24 giờ theo từng giờ đã ghi, cao nhất ${mm(peak?.rain_24h_mm)}`}>
        {slots.map((s, i) => !s.row && <rect key={s.t} className="rain-history-gap" x={x(i) - step / 2} y={Y0} width={Math.max(step, 1)} height={Y1 - Y0}><title>{fmtVN(s.t)}: không có dữ liệu</title></rect>)}
        {th && [['p95', '95%'], ['p99', '99%']].map(([k, label]) => <g key={k} className="rain-history-threshold">
          <line x1={X0} x2={X0 + PLOT_W} y1={y(th[k])} y2={y(th[k])} />
          <text x={X0 + PLOT_W + 4} y={y(th[k]) + 3}>{label} · {Math.round(th[k])}</text>
        </g>)}
        {linePaths(slots, r => r.rain_24h_mm, x, y).map(d => <path key={d} className="rain-history-line" d={d} />)}
        {slots.map((s, i) => s.row?.rain_24h_mm != null && <circle key={s.t} className={`rain-history-dot${s.row.origin === 'backfill' ? ' is-backfill' : ''}`} cx={x(i)} cy={y(s.row.rain_24h_mm)} r={n > 48 ? 1.2 : 2}>
          <title>{fmtVN(s.t)}: mưa 24h {mm(s.row.rain_24h_mm)}, dự báo 24h tới {mm(s.row.forecast_24h_mm)} · {ORIGIN_TEXT[s.row.origin] || s.row.origin}</title></circle>)}
        <line className="rain-history-axis" x1={X0} x2={X0 + PLOT_W} y1={Y1} y2={Y1} />
        {ticks.map(([s, i, short]) => <text key={s.t} x={x(i)} y={Y1 + 13} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{tickText(s, short)}</text>)}
      </svg>
      <div className="live-rain-chart-key"><span><i className="past" />Mưa 24h đã qua (Open-Meteo, lúc ghi)</span><span><i className="backfill" />Bù sau</span><span><i className="gap" />Không có dữ liệu</span></div>
    </figure>

    {showModel && <>
      <h3 className="rain-history-h">Dự báo so với thực tế</h3>
      {checks.length ? <table className="live-weather-days rain-history-checks" aria-label="Dự báo 24 giờ so với mưa ghi được 24 giờ sau">
        <thead><tr><th scope="col">Dự báo lúc</th><th scope="col">Dự báo 24h</th><th scope="col">Thực tế sau đó</th><th scope="col">Chênh</th></tr></thead>
        <tbody>{checks.slice(0, 8).map(c => <tr key={c.issued}>
          <th scope="row">{tickText({ t: Date.parse(c.issued) }, false)}</th><td>{mm(c.forecast)}</td><td>{mm(c.actual)}</td>
          <td>{`${c.actual - c.forecast > 0 ? '+' : ''}${numberText(c.actual - c.forecast, ' mm', 1)}`}</td></tr>)}</tbody>
      </table> : <p className="live-rain-coverage">Chưa có cặp nào: cần một giờ đã ghi và đúng 24 giờ sau đó cũng được ghi. Hiện có {n - gaps} giờ.</p>}
      {checks.length > 0 && <p className="live-rain-coverage">{checks.length} cặp. "Thực tế" là mưa 24h Open-Meteo ước tính lúc ghi 24 giờ sau, không phải số đo trạm.</p>}

      <h3 className="rain-history-h">Điểm GRU theo giờ</h3>
      {scored.length ? <figure className="live-rain-chart">
        <svg viewBox={`0 0 ${W} 44`} role="img" aria-label={`Điểm GRU theo giờ, cao nhất ${scoreText(best.hazard_score)}`}>
          {linePaths(slots, r => r.hazard_score, x, v => 38 - v / scoreTop * 30).map(d => <path key={d} className="rain-history-score" d={d} />)}
          <text x={X0 + PLOT_W + 4} y={11}>{scoreText(scoreTop)}</text><text x={X0 + PLOT_W + 4} y={40}>0</text>
        </svg>
        <figcaption><span>Cao nhất {scoreText(best.hazard_score)} lúc {fmtVN(best.as_of)} · mô hình {models.join(', ')}. Điểm thử nghiệm, chưa phải xác suất.</span></figcaption>
      </figure> : <p className="live-rain-coverage">Chưa có giờ nào có điểm GRU cho điểm này.</p>}

      <button type="button" className="rain-history-csv" onClick={() => downloadCsv(`lich-su-mua_${latitude.toFixed(4)}_${longitude.toFixed(4)}.csv`, toCsv(CSV_COLUMNS, items))}>
        <Download size={14} /> Tải CSV ({items.length} giờ)
      </button>
    </>}
  </section>;
}
