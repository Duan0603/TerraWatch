// Mọi thời điểm backend trả về là UTC (ISO-8601). Hiển thị theo giờ Việt Nam và ghi rõ múi giờ.
const VN = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
});
const VN_HOUR = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hour12: false });

export const fmtVN = (iso) => (iso ? `${VN.format(new Date(iso))} (UTC+7)` : '—');
export const fmtUtc = (iso) => (iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—');
export const hourVN = (iso) => `${VN_HOUR.format(new Date(iso))}h`;

// Còn bao lâu tới hạn (hoặc đã quá hạn bao lâu), dạng chữ ngắn.
export const relativeToNow = (iso, now = Date.now()) => {
  const mins = Math.round((new Date(iso).getTime() - now) / 60000);
  const abs = Math.abs(mins);
  const text = abs >= 60 ? `${Math.floor(abs / 60)} giờ ${abs % 60} phút` : `${abs} phút`;
  return mins >= 0 ? `còn ${text}` : `đã quá ${text}`;
};
