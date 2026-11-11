// WMO weather interpretation codes as returned by Open-Meteo (https://open-meteo.com/en/docs).
export function weatherKind(code) {
  if (code === null || code === undefined) return { kind: 'unknown', label: 'Chưa có dữ liệu' };
  if (code === 0) return { kind: 'clear', label: 'Trời quang' };
  if (code <= 2) return { kind: 'partly', label: 'Ít mây' };
  if (code === 3) return { kind: 'cloudy', label: 'Nhiều mây' };
  if (code === 45 || code === 48) return { kind: 'fog', label: 'Sương mù' };
  if (code >= 51 && code <= 57) return { kind: 'drizzle', label: 'Mưa phùn' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { kind: 'rain', label: code === 65 || code === 82 ? 'Mưa to' : 'Mưa' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { kind: 'snow', label: 'Tuyết / mưa đá nhỏ' };
  if (code >= 95) return { kind: 'storm', label: 'Dông' };
  return { kind: 'unknown', label: `Mã ${code}` };
}

// Dates arrive as Vietnam calendar days (YYYY-MM-DD); label them without letting the browser timezone shift them.
export function dayLabel(isoDate, index) {
  if (index === 0) return 'Hôm nay';
  if (index === 1) return 'Ngày mai';
  const [y, m, d] = isoDate.split('-').map(Number);
  const weekday = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d}/${m}`;
}

// QĐ 18/2021/QĐ-TTg, Điều 3: mưa lớn là trên 50 mm/24h; trên 50 đến 100 mm là mưa to, trên 100 mm là mưa rất to.
// The decree defines no lower tiers, so amounts up to 50 mm only get "below heavy rain".
export function rainLevel24h(mm) {
  if (mm === null || mm === undefined) return null;
  if (mm > 100) return { level: 'very-heavy', label: 'Mưa rất to' };
  if (mm > 50) return { level: 'heavy', label: 'Mưa to' };
  return { level: 'below', label: 'Chưa tới mưa lớn' };
}

// Short local label for an ISO instant, e.g. "11h 11/11".
export function hourLabel(iso) {
  const d = new Date(iso);
  return `${d.getHours()}h ${d.getDate()}/${d.getMonth() + 1}`;
}

export const numberText =(value, unit, digits = 0) =>
  value === null || value === undefined ? '–' : `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value)}${unit}`;
