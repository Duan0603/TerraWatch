import React, { useEffect, useMemo, useState } from 'react';
import { X, Play, Pause, Radio, History, AlertTriangle } from 'lucide-react';
import rainWarningApi from '../api/rainWarningApi';
import {
  LEVEL_INFO, levelKey, warningFacts, rolling72, onsetBefore, fmtVnTime, fmtVnDate, fmtMm, dayTicks, indexOf, actionFor, eventRelation, leadHours, runoutStep, runoutAction
} from '../utils/rainWarning';

// Story 4.41: rain-threshold warning card (live now / next 24 h, or replay of a recorded event).
const W = 316, TOP = 118, BARS = 30, H = TOP + BARS + 16;
const BANDS = [['p95', '#dcfce7'], ['p99', '#fef9c3'], ['p99_9', '#ffedd5'], [null, '#fee2e2']];

function Chart({ times, r72, rain, th, cursor, nowIdx, eventIdx, eventEndIdx }) {
  const n = Math.max(times.length - 1, 1);
  const vals = r72.filter(v => v != null);
  const max = Math.max(th.p99_9 * 1.15, ...vals, 1);
  const maxRain = Math.max(5, ...rain.filter(v => v != null));
  const x = (i) => (i / n) * W;
  const y = (v) => TOP - (Math.min(v, max) / max) * TOP;
  let d = '';
  r72.forEach((v, i) => { if (v != null) d += `${i && r72[i - 1] != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `; });
  let low = 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
      aria-label="Mưa tích lũy 72 giờ (đường xanh) trên nền các mức, mưa từng giờ (cột) và các mốc thời gian">
      {BANDS.map(([k, fill]) => {
        const top = k ? th[k] : max;
        const rect = <rect key={fill} x="0" width={W} y={y(top)} height={Math.max(y(low) - y(top), 0)} fill={fill} />;
        low = top;
        return rect;
      })}
      {[['p95', '#a16207', 'Theo dõi'], ['p99', '#c2410c', 'Cảnh báo'], ['p99_9', '#b91c1c', 'Nguy hiểm']].map(([k, c, t]) => (
        <g key={k}>
          <line x1="0" x2={W} y1={y(th[k])} y2={y(th[k])} stroke={c} strokeDasharray="4 3" strokeWidth="1" />
          <text x="3" y={y(th[k]) - 2} fontSize="8.5" fontWeight="700" fill={c} stroke="#fff" strokeWidth="2.5" paintOrder="stroke">{t} ≥ {fmtMm(th[k])} mm</text>
        </g>
      ))}
      {nowIdx != null && nowIdx < n && <>
        <rect x={x(nowIdx)} width={W - x(nowIdx)} y="0" height={TOP + BARS} fill="#64748b" opacity="0.10" />
        <text x={x(nowIdx) + 3} y="10" fontSize="8.5" fill="#475569">Dự báo</text>
      </>}
      {dayTicks(times).map(t => (
        <g key={t.i}>
          <line x1={x(t.i)} x2={x(t.i)} y1="0" y2={TOP + BARS} stroke="#94a3b8" strokeWidth="0.5" />
          <text x={x(t.i) + 2} y={H - 3} fontSize="8.5" fill="#475569">{t.label}</text>
        </g>
      ))}
      {rain.map((v, i) => v ? <rect key={i} x={x(i) - 0.6} width="1.6" y={TOP + BARS - (v / maxRain) * BARS} height={(v / maxRain) * BARS} fill="#60a5fa" /> : null)}
      <text x={W - 2} y={TOP + 9} fontSize="8" fill="#2563eb" textAnchor="end">mưa từng giờ (tối đa {fmtMm(maxRain)} mm)</text>
      <path d={d} fill="none" stroke="#1d4ed8" strokeWidth="2" />
      {eventIdx != null && eventEndIdx != null && <rect x={x(eventIdx)} width={Math.max(x(eventEndIdx) - x(eventIdx), 2)} y="0" height={TOP + BARS} fill="#0f172a" opacity="0.08" />}
      {eventIdx != null && <>
        <line x1={x(eventIdx)} x2={x(eventIdx)} y1="0" y2={TOP + BARS} stroke="#0f172a" strokeWidth="1.5" strokeDasharray="3 2" />
        <text x={x(eventIdx) - 2} y="10" fontSize="9" fontWeight="700" fill="#0f172a" textAnchor="end">{eventEndIdx != null ? "⚠ ngày sạt" : "⚠ sạt lở"}</text>
      </>}
      {cursor != null && r72[cursor] != null && <>
        <line x1={x(cursor)} x2={x(cursor)} y1="0" y2={TOP + BARS} stroke="#0f172a" strokeWidth="1" />
        <circle cx={x(cursor)} cy={y(r72[cursor])} r="3.5" fill="#1d4ed8" stroke="#fff" strokeWidth="1.5" />
      </>}
    </svg>
  );
}

const box = (bg, color) => ({ padding: '6px 8px', borderRadius: 8, background: bg, color, marginTop: 8 });

const TRUTH_REPLAY = 'lang_nu_2024'; // the replay whose landslide area is mapped (the black outline)

export default function RainWarningCard({ site, meta, onClose, sites = [], siteLevels = {}, onPickSite, onLevel, onZone }) {
  const [mode, setMode] = useState('live');
  const [live, setLive] = useState(null);
  const [replay, setReplay] = useState(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { setMode('live'); setLive(null); }, [site.key]); // another site: start from its live state

  useEffect(() => {
    setError(null);
    setReplay(null); // nothing of a previous replay may show in another mode
    setPlaying(false);
    if (mode === 'live') {
      rainWarningApi.getLive(site.latitude, site.longitude)
        .then(r => setLive(r.data))
        .catch(() => setError('Chưa có số liệu mưa cập nhật cho điểm này (tác vụ tự động có thể đang khởi tạo).'));
    } else {
      rainWarningApi.getReplay(mode)
        .then(r => { setReplay(r); setIdx(0); setPlaying(true); })
        .catch(() => setError('Không tải được dữ liệu phát lại.'));
    }
  }, [mode, site.latitude, site.longitude]);

  useEffect(() => {
    if (!playing || !replay) return undefined;
    const t = setInterval(() => setIdx(i => Math.min(i + 1, replay.hours.length - 1)), 110);
    return () => clearInterval(t);
  }, [playing, replay]);
  useEffect(() => { if (replay && idx >= replay.hours.length - 1) setPlaying(false); }, [idx, replay]);

  const th = site.thresholds['72'];
  const view = useMemo(() => {
    if (mode === 'live') {
      const w = live?.rain_warning;
      if (!w) return null;
      const hourly = live.hourly || [];
      const rain = hourly.map(h => h.mm);
      const nowIdx = hourly.filter(h => h.kind === 'past_estimate').length - 1;
      return { kind: 'live', a: w.now, next: w.next_24h, times: hourly.map(h => h.interval_end), rain, r72: rolling72(rain), cursor: nowIdx, nowIdx, at: live.as_of };
    }
    if (!replay) return null;
    const hours = replay.hours;
    const h = hours[idx];
    const rate = h.level && meta?.hit_rates?.[h.level];
    const times = hours.map(x => x.interval_end);
    return {
      kind: 'replay', times, rain: hours.map(x => x.mm), r72: hours.map(x => x.totals_mm['72']), cursor: idx, at: h.interval_end,
      eventIdx: indexOf(times, replay.event_utc), eventEndIdx: replay.event_end_utc ? indexOf(times, replay.event_end_utc) : null,
      first: null, // filled below once the event index is known
      peak72: Math.max(...hours.map(x => x.totals_mm['72'] ?? 0)),
      a: { totals_mm: h.totals_mm, level: h.level, complete: h.totals_mm['72'] != null, percent_days_below: h.percent_days_below,
        recorded_landslides_one_in: rate?.one_in, last_event: null }
    };
  }, [mode, live, replay, idx, meta]);

  if (view?.kind === 'replay') view.first = onsetBefore(replay.hours, view.eventEndIdx ?? view.eventIdx);
  const lk = levelKey(view?.a);
  const info = LEVEL_INFO[lk];
  useEffect(() => { onLevel?.(view ? lk : null); }, [lk, view, onLevel]);
  // Story 4.41: where a rain-dependent extent model exists (Làng Nủ), the zone and the people/houses follow the 72 h rain
  const runout = site.runout;
  const step = runout ? runoutStep(runout, view?.a?.totals_mm?.['72']) : null;
  const nextStep = runout && view?.kind === 'live' && view.next ? runoutStep(runout, view.next.totals_mm?.['72']) : null;
  // live mode draws the extent expected over the next 24 h when it is larger than now (the forecast is what matters)
  const shownStep = nextStep && (!step || nextStep.area_ha > step.area_ha) ? nextStep : step;
  const shownIsForecast = shownStep && shownStep === nextStep && shownStep !== step;
  // what the extent is compared with depends on the mode: the 2024 replay has the mapped footprint, other events do not
  const peakStep = runout ? runoutStep(runout, runout.calibration.rain72_peak_mm) : null;
  const pct = (x) => `${Math.round(x * 100)}%`;
  const compareNote = !runout || !view ? null
    : mode === TRUTH_REPLAY
      ? (shownStep ? `So với vùng sạt thật 10/9/2024 (viền đen) ở mức mưa này: mô hình phủ ${pct(shownStep.recall_vs_2024)} vùng thật.` : 'Chưa có phạm vi: mưa lúc này chưa đủ để hình thành dòng bùn đá. Kéo thanh thời gian tới gần lúc sạt để so với vùng thật (viền đen).')
      : view.kind === 'replay'
        ? `Vụ sạt ${replay.event_utc ? fmtVnDate(replay.event_utc) : replay.label} chưa có vùng sạt khoanh từ ảnh vệ tinh, nên chỉ so được mức mưa, không so được phạm vi. Viền đen trên bản đồ là vụ 10/9/2024 để tham khảo.`
        : `Mô hình đã kiểm chứng với vụ 10/9/2024: ở đỉnh mưa Yagi phủ ${pct(runout.calibration.recall)} vùng sạt thật (${pct(runout.calibration.village_recall)} phần bản làng), tính ra ~${peakStep?.people}/${runout.truth_2024.people} người và ${peakStep?.buildings}/${runout.truth_2024.buildings} nhà.`;
  useEffect(() => { if (runout) onZone?.(shownStep ? shownStep.geometry : null); }, [runout, shownStep, onZone]);
  useEffect(() => () => onZone?.(null), [onZone]);
  const action = runout ? runoutAction(lk === 'none' ? null : lk, step) : actionFor(lk === 'none' ? null : lk, site.impact_zone);
  const nextKey = view?.kind === 'live' && view.next ? levelKey(view.next) : null;
  const rank = { none: 0, missing: 0, watch: 1, warning: 2, danger: 3 };
  const zone = site.impact_zone;
  const replays = (meta?.replays || []).filter(r => r.site_key === site.key);
  const jump = (iso) => { const i = indexOf(view.times, iso); if (i != null) { setPlaying(false); setIdx(i); } };
  const milestones = view?.kind === 'replay' ? [
    ['watch', view.first.watch], ['warning', view.first.warning], ['danger', view.first.danger], ['event', replay?.event_utc && { at: replay.event_utc }]
  ] : [];
  const lead = (lvl) => (view?.kind === 'replay' ? leadHours(view.first[lvl]?.at, replay) : null);
  const heldFromStart = (lvl) => !!view?.first?.[lvl]?.at_start;
  const dayOnly = replay?.event_precision === 'day';

  return (
    <section className="rain-warning-card" aria-label={`Cảnh báo theo mưa ${site.name}`} style={{
      position: 'absolute', top: 84, left: 16, zIndex: 12, width: 348, maxHeight: 'calc(100% - 110px)', overflowY: 'auto',
      background: '#fff', border: '1px solid #DCE5E2', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: 12, fontSize: 12, color: '#0f172a'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>Cảnh báo sạt lở theo mưa</div>
          <div style={{ color: '#64748b' }}>{site.name}</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng cảnh báo theo mưa" className="btn-ghost" style={{ padding: 4 }}><X size={14} /></button>
      </div>

      {sites.length > 1 && (
        <label style={{ display: 'block', marginTop: 8, fontSize: 11, color: '#334155' }}>Điểm cảnh báo ({sites.length} điểm có ngưỡng riêng):
          <select value={site.key} onChange={(e) => onPickSite?.(e.target.value)} aria-label="Chọn điểm cảnh báo" style={{ width: '100%', marginTop: 2, padding: '4px 6px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}>
            {sites.map(x => <option key={x.key} value={x.key}>{x.name} — {LEVEL_INFO[siteLevels[x.key] || 'missing'].label}</option>)}
          </select>
        </label>
      )}

      <div role="group" aria-label="Chế độ xem" style={{ display: 'grid', gridTemplateColumns: `repeat(${1 + replays.length}, 1fr)`, gap: 4, margin: '8px 0' }}>
        {[['live', 'Hiện tại', Radio], ...replays.map(r => [r.replay_id, `Phát lại: ${r.label}`, History])].map(([id, label, Icon]) => (
          <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)} title={label} aria-label={label} style={{
            padding: '5px 4px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', border: '1px solid #DCE5E2',
            background: mode === id ? (id === 'live' ? '#087B70' : '#b45309') : '#fff', color: mode === id ? '#fff' : '#334155',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, lineHeight: 1.2
          }}><Icon size={12} aria-hidden="true" />{label.replace('Phát lại: ', '')}</button>
        ))}
      </div>

      {error && <div role="alert" style={{ color: '#b91c1c' }}>{error}</div>}
      {!error && !view && <div>Đang tải…</div>}
      {view && <>
        {view.kind === 'live'
          ? <div style={{ fontSize: 11, color: '#047857', fontWeight: 600 }}>● Đang theo dõi trực tiếp · mưa Open-Meteo cập nhật mỗi giờ</div>
          : <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600 }}>⏪ Đang phát lại mưa thật đã qua: {replay.label}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: info.bg, color: info.color, marginTop: 6, border: `1px solid ${info.color}33` }}>
          <span aria-label="Mức cảnh báo" style={{ fontSize: 20, fontWeight: 800 }}>{info.label}</span>
          <span style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 11, color: '#334155' }}>
            <b style={{ fontSize: 13 }}>{fmtVnTime(view.at)}</b>
            {view.kind === 'replay' && replay.event_utc && <div>{eventRelation(view.at, replay)}</div>}
            {view.kind === 'live' && <div>số liệu mới nhất</div>}
          </span>
        </div>

        <ul style={{ margin: '8px 0 0', paddingLeft: 16, lineHeight: 1.5 }}>
          {warningFacts(view.a, meta?.period, meta?.hit_rate_sites).map(f => <li key={f}>{f}</li>)}
        </ul>

        {runout && (
          <div role="note" aria-label="Phạm vi ước tính" style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: shownStep ? '#fef2f2' : '#f8fafc', border: `1px solid ${shownStep ? '#dc2626' : '#cbd5e1'}55` }}>
            <div style={{ fontWeight: 800 }}>{shownIsForecast ? `Phạm vi dòng bùn đá theo dự báo 24 giờ tới (mưa 72 giờ ${fmtMm(view.next.totals_mm['72'])} mm)` : `Phạm vi dòng bùn đá ước tính (theo mưa 72 giờ ${fmtMm(view.a?.totals_mm?.['72'])} mm)`}</div>
            {shownStep ? <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginTop: 4, textAlign: 'center' }}>
                {[[`${fmtMm(shownStep.area_ha)} ha`, 'phạm vi'], [`${shownStep.lowest_elev_m} m`, 'xuống tới độ cao'], [`~${shownStep.people}`, 'người'], [`${shownStep.buildings}`, 'nhà'], [`${fmtMm(shownStep.roads_km)} km`, 'đường'], [`${fmtMm(shownStep.alpha_deg)}°`, 'góc trượt']].map(([v, l]) => (
                  <div key={l} style={{ background: '#fff', borderRadius: 6, padding: '3px 2px' }}><div style={{ fontSize: 14, fontWeight: 800 }}>{v}</div><div style={{ fontSize: 10, color: '#64748b' }}>{l}</div></div>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: '#475569', marginTop: 4 }}>Vụ thật 10/9/2024 (viền đen đứt trên bản đồ): {fmtMm(runout.truth_2024.area_ha)} ha · ~{runout.truth_2024.people} người · {runout.truth_2024.buildings} nhà.</div>
            </> : <div style={{ marginTop: 2 }}>Mưa chưa tới ngưỡng hình thành dòng bùn đá theo mô hình: không có phạm vi nguy hiểm.</div>}
            {shownIsForecast && <div style={{ marginTop: 4, fontWeight: 700, color: '#9a3412' }}>Hiện tại: {step ? `${fmtMm(step.area_ha)} ha, ~${step.people} người` : 'chưa có phạm vi nguy hiểm'}; vùng trên bản đồ là phạm vi dự kiến trong 24 giờ tới.</div>}
            <div aria-label="So với vụ thật" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #fca5a5', fontSize: 11, color: '#334155' }}>{compareNote}</div>
          </div>
        )}

        <div role="note" aria-label="Việc cần làm" style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, borderLeft: `4px solid ${info.color}`, background: '#f8fafc' }}>
          <div style={{ fontWeight: 800, color: info.color }}>Việc cần làm: {action.title}</div>
          <div style={{ marginTop: 2, lineHeight: 1.45 }}>{action.text}</div>
        </div>

        {view.kind === 'live' && view.next && (
          <div style={box('#f1f5f9', '#0f172a')}>
            <b>24 giờ tới (theo dự báo):</b>{' '}
            <b style={{ color: LEVEL_INFO[levelKey(view.next)].color }}>{LEVEL_INFO[levelKey(view.next)].label}</b>
            {view.next.totals_mm?.['72'] != null && <> — mưa 72 giờ dự kiến {fmtMm(view.next.totals_mm['72'])} mm (mức Theo dõi bắt đầu từ {fmtMm(th.p95)} mm)</>}
            {rank[nextKey] > rank[lk] && <div style={{ marginTop: 4, color: LEVEL_INFO[nextKey].color, fontWeight: 700 }}>Sắp lên {LEVEL_INFO[nextKey].label}: {(runout ? runoutAction(nextKey, nextStep) : actionFor(nextKey, site.impact_zone)).title.toLowerCase()} trong 24 giờ tới.</div>}
          </div>
        )}

        {view.kind === 'replay' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8 }}>
            {milestones.map(([k, m]) => {
              const iso = m?.at;
              const ev = k === 'event';
              const c = ev ? { color: '#fff', bg: '#0f172a' } : LEVEL_INFO[k];
              return (
                <button key={k} type="button" disabled={!iso} onClick={() => jump(iso)} title={iso ? 'Nhảy tới thời điểm này' : ''} style={{
                  textAlign: 'left', padding: '4px 6px', borderRadius: 6, border: `1px solid ${ev ? '#0f172a' : c.color}55`,
                  background: iso ? c.bg : '#f8fafc', color: iso ? c.color : '#94a3b8', cursor: iso ? 'pointer' : 'default', fontSize: 10.5
                }}>
                  <b>{ev ? (dayOnly ? '⚠ Ngày sạt' : '⚠ Sạt lở') : `Lên ${c.label}`}</b><br />{iso ? (ev && dayOnly ? `${fmtVnDate(iso)} (không rõ giờ)` : `${m.at_start ? 'từ trước ' : ''}${fmtVnTime(iso)}`) : 'không đạt'}
                </button>
              );
            })}
          </div>
          {view.first.warning && lead('warning') > 0
            ? <div style={box('#ecfdf5', '#065f46')}>✔ Lần lên mức cuối trước khi sạt: <b>Cảnh báo {heldFromStart('warning') ? '≥ ' : ''}{lead('warning')} giờ</b>{lead('danger') > 0 && <> và <b>Nguy hiểm {heldFromStart('danger') ? '≥ ' : ''}{lead('danger')} giờ</b></>} trước {dayOnly ? 'đầu ngày sạt (chỉ biết ngày, không rõ giờ)' : 'khi sạt'}.
                {(heldFromStart('warning') || heldFromStart('danger')) && <div style={{ marginTop: 3, fontSize: 11 }}>Đợt mưa kéo dài: mức này đã có từ đầu đoạn phát lại (6 ngày trước), nên thời gian báo trước thực tế còn dài hơn.</div>}</div>
            : view.first.warning ? <div style={box('#fffbeb', '#92400e')}>Lên Cảnh báo lúc {fmtVnTime(view.first.warning.at)}, {dayOnly ? 'trong ngày sạt' : 'không sớm hơn thời điểm sạt'}: có tín hiệu nhưng không kịp báo trước.</div>
            : <div style={box('#fef2f2', '#991b1b')}><AlertTriangle size={12} style={{ verticalAlign: -2 }} /> <b>Bỏ sót:</b> mưa Open-Meteo cao nhất đợt này chỉ {fmtMm(view.peak72)} mm/72 giờ, dưới mức Theo dõi ({fmtMm(th.p95)} mm), nên hệ thống không cảnh báo trước vụ sạt. Đây là giới hạn của cảnh báo chỉ dựa vào mưa (mưa dông cục bộ, ô lưới khí tượng ~10 km).</div>}
        </>}

        <div style={{ marginTop: 8 }}>
          <Chart times={view.times} r72={view.r72} rain={view.rain} th={th} cursor={view.cursor}
            nowIdx={view.kind === 'live' ? view.nowIdx : null} eventIdx={view.kind === 'replay' ? view.eventIdx : null}
            eventEndIdx={view.kind === 'replay' ? view.eventEndIdx : null} />
          <div style={{ color: '#64748b', fontSize: 10 }}>Đường xanh: mưa cộng dồn 72 giờ; cột: mưa từng giờ; nền màu: các mức của riêng điểm này{view.kind === 'live' ? '; vùng xám: 24 giờ dự báo' : (dayOnly ? '; dải xám đậm: ngày sạt' : '; vạch đen đứt: thời điểm sạt')}.</div>
        </div>

        {view.kind === 'replay' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <button type="button" className="btn-ghost" onClick={() => { if (idx >= replay.hours.length - 1) setIdx(0); setPlaying(p => !p); }} aria-label={playing ? 'Tạm dừng' : 'Phát'} style={{ padding: 4 }}>
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <input type="range" min="0" max={replay.hours.length - 1} value={idx} aria-label="Thời điểm phát lại"
              onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }} style={{ flex: 1 }} />
          </div>
        )}
      </>}

      {zone && !runout && (
        <details style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
            {zone.label}: {zone.footprint.area_ha.toLocaleString('vi-VN')} ha · ~{zone.footprint.people_estimate}{zone.footprint.people_from_buildings ? `–${zone.footprint.people_from_buildings}` : ''} người
          </summary>
          <div style={{ marginTop: 6, lineHeight: 1.5 }}>
            <div><span style={{ display: 'inline-block', width: 10, height: 10, background: info.color, opacity: 0.6, marginRight: 4 }} />{zone.label} ({zone.footprint.area_ha.toLocaleString('vi-VN')} ha): ~<b>{zone.footprint.people_estimate} người</b> (WorldPop){zone.footprint.buildings != null && <>, <b>{zone.footprint.buildings} nhà</b> (~{zone.footprint.people_from_buildings} người)</>}.</div>
            <div><span style={{ display: 'inline-block', width: 10, height: 10, border: `2px dashed ${info.color}`, marginRight: 4 }} />Mở rộng 100 m ({zone.buffer_100m.area_ha.toLocaleString('vi-VN')} ha): ~<b>{zone.buffer_100m.people_estimate} người</b>{zone.buffer_100m.buildings != null && <>, <b>{zone.buffer_100m.buildings} nhà</b> (~{zone.buffer_100m.people_from_buildings} người)</>}.</div>
            <div style={{ color: '#64748b', fontSize: 10 }}>Màu vùng trên bản đồ đổi theo mức đang xem. Dân số: WorldPop 2025 (ước tính); số theo nhà (chỉ Làng Nủ, Google Open Buildings) là mức trần 3,5 người/nhà. Vùng vẽ từ ảnh vệ tinh hoặc bản đồ công bố, chưa chuyên gia duyệt; số liệu dân/nhà có thể trước thời điểm sạt.</div>
          </div>
        </details>
      )}
      <details style={{ marginTop: 6 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Cách tính và giới hạn</summary>
        <div style={{ marginTop: 6, color: '#334155', lineHeight: 1.5 }}>
          Mức = mưa cộng dồn 72 giờ và 120 giờ so với chính lịch sử {meta?.period} của điểm này (Open-Meteo): Theo dõi ≥ P95, Cảnh báo ≥ P99, Nguy hiểm ≥ P99,9.
          Tỉ lệ "1/N" đếm từ {meta?.hit_rate_sites} điểm sạt có ngày giờ, là con số tối thiểu. Ước tính theo mưa, <b>không phải xác suất sạt lở</b>; mưa dông cục bộ ngắn có thể không được ghi nhận đủ.
          {runout && <div style={{ marginTop: 6 }}>
            <b>Phạm vi dòng bùn đá</b> (mô hình kiểu Flow-R trên địa hình 30 m):
            <div>1. Khởi phát ở đầu vết sạt 2024 (trên 700 m); mưa càng lớn, càng nhiều phần sườn trượt.</div>
            <div>2. Chảy xa theo góc trượt <b>đo từ vụ thật: {fmtMm(runout.calibration.alpha_2024_deg)}°</b> (cao 614 m trên quãng đường {fmtMm(runout.calibration.path_length_m)} m dọc khe) ở đỉnh mưa Yagi; mưa nhỏ hơn thì chảy gần hơn (Corominas 1996).</div>
            <div>3. Xuống tới đáy thung lũng, bùn đá bồi lấp sang hai bên tới {fmtMm(runout.calibration.deposit_h_m)} m cao hơn lòng khe (ở đỉnh Yagi; mưa nhỏ hơn thì mỏng hơn).</div>
            <div>4. Người: WorldPop 2025; nhà: Google Open Buildings; đường: OpenStreetMap (dữ liệu trước bão).</div>
            <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>Kiểm chứng trên một vụ (IoU {runout.calibration.iou}); các bậc mưa nhỏ hơn suy ra theo công thức. Viền vụ thật khoanh tay trên ảnh Sentinel-2 10 m, mép sai khoảng ±10 m, đầu dưới bị cắt.</div>
          </div>}
        </div>
      </details>
    </section>
  );
}
