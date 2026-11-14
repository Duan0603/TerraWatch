// Story 4.41: rain-threshold warning (Làng Nủ). No imports: Node tests load this file as it is.

export const LEVEL_INFO = {
  none: { label: 'Bình thường', color: '#16a34a', bg: '#dcfce7' },
  watch: { label: 'Theo dõi', color: '#ca8a04', bg: '#fef9c3' },
  warning: { label: 'Cảnh báo', color: '#ea580c', bg: '#ffedd5' },
  danger: { label: 'Nguy hiểm', color: '#b91c1c', bg: '#fee2e2' },
  missing: { label: 'Thiếu dữ liệu', color: '#64748b', bg: '#f1f5f9' }
};

const VN_DATE = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
const VN_TIME = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

export const fmtMm = (v) => (v == null ? '—' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 }));
export const levelKey = (a) => (!a || a.complete === false ? 'missing' : a.level || 'none');
export const fmtVnDate = (iso) => (iso ? VN_DATE.format(new Date(iso)) : '—');
export const fmtVnTime = (iso) => (iso ? VN_TIME.format(new Date(iso)) : '—');

/** The three facts of "Cách B": level, how unusual the rain is here, what followed this level in the past. */
export function warningFacts(a, period, sites) {
  if (!a || a.complete === false) return ['Chưa đủ số liệu mưa của 5 ngày qua để xếp mức.'];
  const facts = [];
  const t = a.totals_mm || {};
  if (a.percent_days_below != null) {
    facts.push(`Mưa 72 giờ qua ${fmtMm(t['72'])} mm, cao hơn ${a.percent_days_below.toLocaleString('vi-VN')}% số ngày từ ${period || '1998'} tại đây.`);
  }
  if (a.level && a.recorded_landslides_one_in) {
    facts.push(`Ở mức này, lịch sử ${sites || 7} điểm ghi nhận sạt lở ít nhất 1/${a.recorded_landslides_one_in} lần (con số tối thiểu: nhiều vụ sạt không được ghi lại).`);
  }
  if (a.last_event) facts.push(`Lần gần nhất mưa tới mức này: ${fmtVnDate(a.last_event.date)} — ${a.last_event.label}.`);
  if (!a.level) facts.push('Mưa chưa vượt mức theo dõi của chính điểm này.');
  return facts;
}

/** 72 h totals ending at each hour (null while the window is incomplete or has a gap). */
export function rolling72(values) {
  return values.map((_, i) => {
    if (i < 71) return null;
    const win = values.slice(i - 71, i + 1);
    return win.some(v => v == null) ? null : Math.round(win.reduce((s, v) => s + v, 0) * 10) / 10;
  });
}

/** First hour each level (or a higher one) is reached in a replay; used for "cảnh báo trước bao lâu". */
export function firstReached(hours) {
  const rank = { watch: 1, warning: 2, danger: 3 };
  const out = {};
  for (const lvl of Object.keys(rank)) {
    const h = hours.find(x => rank[x.level] >= rank[lvl]);
    out[lvl] = h ? h.interval_end : null;
  }
  return out;
}

/** Hours between two ISO times, rounded (null if either is missing). */
export const hoursBetween = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 3600000) : null);

const VN_DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' }); // en-GB: always dd/mm
const VN_HOUR = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hourCycle: 'h23' });

/** Chart ticks at Vietnam midnight: [{ i, label: 'dd/mm' }]. */
export function dayTicks(times) {
  return times.map((t, i) => ({ i, t })).filter(({ t }) => t && VN_HOUR.format(new Date(t)) === '00')
    .map(({ i, t }) => ({ i, label: VN_DAY.format(new Date(t)) }));
}

/** Index of the hour closest to iso (null when iso is outside the series). */
export function indexOf(times, iso) {
  if (!iso || !times.length) return null;
  const target = new Date(iso).getTime();
  const first = new Date(times[0]).getTime(), last = new Date(times[times.length - 1]).getTime();
  if (target < first - 3600e3 || target > last + 3600e3) return null;
  let best = 0;
  times.forEach((t, i) => { if (Math.abs(new Date(t) - target) < Math.abs(new Date(times[best]) - target)) best = i; });
  return best;
}

/** "còn 3 giờ tới …" / "đúng lúc …" / "sau … 5 giờ" for the replay cursor. */
export function relativeToEvent(nowIso, eventIso) {
  const h = hoursBetween(nowIso, eventIso);
  if (h == null) return null;
  if (h > 0) return `còn ${h} giờ tới thời điểm sạt`;
  if (h === 0) return 'đúng thời điểm sạt';
  return `${-h} giờ sau thời điểm sạt`;
}

const range = (a, b) => (b != null && b !== a ? `${a}–${b}` : `${a}`);

/** What to do at a level, with the people of the site's impact zone (Story 4.41). */
export function actionFor(level, zone) {
  const f = zone?.footprint, b = zone?.buffer_100m;
  const inZone = f ? `~${range(f.people_estimate, f.people_from_buildings)} người trong ${(zone.label || "vùng ảnh hưởng").toLowerCase()} (${fmtMm(f.area_ha)} ha)` : null;
  const wide = b ? `~${range(b.people_estimate, b.people_from_buildings)} người trong vùng đó và dải 100 m quanh nó (${fmtMm(b.area_ha)} ha)` : null;
  const noZone = 'Chưa có vùng ảnh hưởng đã vẽ cho điểm này: rà soát nhà ở ven khe suối và dưới sườn dốc.';
  switch (level) {
    case 'watch': return { title: 'Theo dõi sát', people: f?.people_estimate ?? null,
      text: inZone ? `Thông báo cho ${inZone}; kiểm tra vết nứt, nước khe suối đục, đá lăn.` : `Theo dõi mưa từng giờ. ${noZone}` };
    case 'warning': return { title: 'Chuẩn bị sơ tán', people: f?.people_estimate ?? null,
      text: inZone ? `Chuẩn bị đưa ${inZone} tới nơi an toàn; sẵn sàng phương tiện; hạn chế qua lại khe suối.` : `Chuẩn bị phương án sơ tán. ${noZone}` };
    case 'danger': return { title: 'Sơ tán ngay', people: b?.people_estimate ?? f?.people_estimate ?? null,
      text: wide ? `Đưa ${wide} ra khỏi khu vực; không ở lại nhà gần khe suối, nhất là ban đêm.` : `Sơ tán dân cư ven khe suối và dưới sườn dốc. ${noZone}` };
    case 'missing': return { title: 'Chưa đủ số liệu', people: null, text: 'Thiếu số liệu mưa vài giờ gần đây: không xếp được mức, theo dõi bản tin khí tượng.' };
    default: return { title: 'Không cần hành động', people: null, text: 'Mưa ở mức thường của điểm này. Tiếp tục theo dõi bản tin thời tiết.' };
  }
}

/** Replay cursor vs the event: hour-precise reports, or the whole local day when only the date is known. */
export function eventRelation(nowIso, replay) {
  if (!replay?.event_utc) return null;
  if (replay.event_precision !== 'day') return relativeToEvent(nowIso, replay.event_utc);
  const before = hoursBetween(nowIso, replay.event_utc), after = hoursBetween(replay.event_end_utc, nowIso);
  if (before > 0) return `còn ${before} giờ tới ngày sạt`;
  if (after >= 0) return `${after} giờ sau ngày sạt`;
  return 'trong ngày sạt (không rõ giờ)';
}

/** Lead time of a level before the event (hour report) or before the start of the event day (date only). */
export const leadHours = (firstIso, replay) => (firstIso && replay?.event_utc ? hoursBetween(firstIso, replay.event_utc) : null);

/**
 * Onset of the last run at >= each level that reaches the event (Story 4.41 review): long rainy seasons dip and
 * rise again, so "first time in the window" would overstate the warning time. refIdx = event hour, or the end
 * of the event day when only the date is known. at_start = the level already held when the replay begins.
 */
export function onsetBefore(hours, refIdx) {
  const rank = { watch: 1, warning: 2, danger: 3 };
  const out = {};
  for (const lvl of Object.keys(rank)) {
    let k = Math.min(refIdx ?? hours.length - 1, hours.length - 1);
    while (k >= 0 && !(rank[hours[k].level] >= rank[lvl])) k--;
    if (k < 0) { out[lvl] = null; continue; }
    while (k > 0 && rank[hours[k - 1].level] >= rank[lvl]) k--;
    out[lvl] = { at: hours[k].interval_end, at_start: k === 0 };
  }
  return out;
}

/** Story 4.41 (rain-dependent extent): modelled debris-flow step for a 72 h rain (null below the first step). */
export function runoutStep(runout, rain72) {
  if (!runout?.steps?.length || rain72 == null) return null;
  let step = null;
  for (const s of runout.steps) if (rain72 >= s.rain72_mm) step = s;
  return step;
}

/** What to do at a level, with the modelled extent for the current rain (Làng Nủ). */
export function runoutAction(level, step) {
  const reach = step ? `theo mô hình, nếu sạt thì dòng bùn đá xuống tới ~${step.lowest_elev_m} m, phạm vi ${fmtMm(step.area_ha)} ha` : null;
  const hit = step ? `~${step.people} người, ${step.buildings} nhà${step.roads_km ? `, ${fmtMm(step.roads_km)} km đường` : ''}` : null;
  switch (level) {
    case 'watch': return { title: 'Theo dõi sát', text: step ? `${reach}; trong phạm vi có ${hit}. Kiểm tra vết nứt, nước khe suối đục, đá lăn.` : 'Theo dõi mưa từng giờ.' };
    case 'warning': return { title: 'Chuẩn bị sơ tán', text: step ? `Chuẩn bị đưa ${hit} ra khỏi phạm vi (${reach}); sẵn sàng phương tiện, hạn chế qua lại khe suối.` : 'Chuẩn bị phương án sơ tán.' };
    case 'danger': return { title: 'Sơ tán ngay', text: step ? `Sơ tán ngay ${hit} (${reach}); không ở lại nhà gần khe suối, nhất là ban đêm.` : 'Sơ tán dân cư ven khe suối và dưới sườn dốc.' };
    case 'missing': return { title: 'Chưa đủ số liệu', text: 'Thiếu số liệu mưa vài giờ gần đây: không xếp được mức, theo dõi bản tin khí tượng.' };
    default: return { title: 'Không cần hành động', text: step ? `Mưa ở mức thường; theo mô hình phạm vi nếu sạt chỉ ${fmtMm(step.area_ha)} ha ở sườn trên, chưa tới khu dân cư.` : 'Mưa ở mức thường của điểm này: theo mô hình chưa hình thành dòng bùn đá. Tiếp tục theo dõi bản tin thời tiết.' };
  }
}
