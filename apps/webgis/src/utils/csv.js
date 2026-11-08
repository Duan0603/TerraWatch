// Xuất CSV mở được bằng Excel (BOM UTF-8 để tiếng Việt không vỡ dấu).

// Ô văn bản bắt đầu bằng = + - @ bị Excel hiểu là công thức -> thêm dấu nháy để vô hiệu hóa (CSV injection).
const cell = (v) => {
  if (v == null) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// columns: [{ label, value: (row) => any }]
export const toCsv = (columns, rows) =>
  [columns.map(c => cell(c.label)), ...rows.map(r => columns.map(c => cell(c.value(r))))]
    .map(line => line.join(','))
    .join('\r\n');

export const downloadCsv = (filename, text) => {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
};
