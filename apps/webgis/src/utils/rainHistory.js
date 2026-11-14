// Lịch sử mưa đã ghi mỗi giờ (gis_schema.live_rainfall_history).
const HOUR = 3600e3;

// Mỗi giờ một ô, từ bản ghi đầu đến bản ghi cuối. Giờ không có bản ghi = null (máy chủ không chạy), không điền 0.
export function hourlySlots(items) {
  const byHour = new Map(items.map(r => [Date.parse(r.as_of), r]));
  if (!byHour.size) return [];
  const first = Math.min(...byHour.keys()), last = Math.max(...byHour.keys());
  return Array.from({ length: (last - first) / HOUR + 1 }, (_, i) => {
    const t = first + i * HOUR;
    return { t, row: byHour.get(t) ?? null };
  });
}

// Dự báo 24h đưa ra lúc T so với mưa 24h ghi lúc T+24h: cùng khoảng (T, T+24h].
export function forecastChecks(items) {
  const byHour = new Map(items.map(r => [Date.parse(r.as_of), r]));
  return items.flatMap(r => {
    const later = byHour.get(Date.parse(r.as_of) + 24 * HOUR);
    return r.forecast_24h_mm == null || later?.rain_24h_mm == null ? []
      : [{ issued: r.as_of, forecast: r.forecast_24h_mm, actual: later.rain_24h_mm }];
  });
}

// Đường gãy tại giờ thiếu: mỗi đoạn liền là một path riêng.
export function linePaths(slots, value, x, y) {
  const paths = [];
  let d = '';
  slots.forEach((s, i) => {
    const v = s.row ? value(s.row) : null;
    if (v == null) { if (d) paths.push(d); d = ''; return; }
    d += `${d ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
  });
  if (d) paths.push(d);
  return paths;
}
