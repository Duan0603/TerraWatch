export const DEMO_ROOT = `${import.meta.env?.BASE_URL || '/'}model-demo/`;

export function summarize(features, threshold) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const { properties: p } of features) {
    const predicted = p.p_hazard_slope_soil >= threshold;
    if (p.mapped_proxy_label === 1) predicted ? tp++ : fn++;
    else predicted ? fp++ : tn++;
  }
  return { tp, fp, tn, fn, flagged: tp + fp, total: features.length,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null };
}

export function scoreColor(score) {
  return score >= .65 ? '#ad352b' : score >= .5 ? '#d46522' : score >= .26 ? '#aa800c' : '#268378';
}

export const scoreText = value => Number(value).toFixed(3);
export const numberText = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
export const dateText = value => value.split('-').reverse().join('/');

export async function loadDemoJson(filename, signal) {
  const response = await fetch(DEMO_ROOT + filename, { signal });
  if (!response.ok) throw new Error('Không tải được dữ liệu demo. Hãy thử lại hoặc kiểm tra kết nối đến web.');
  return response.json();
}
