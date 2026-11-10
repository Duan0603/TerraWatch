import React from 'react';
import { buildKpis } from '../utils/kpis';

// Dải số liệu tổng quan phía trên bản đồ: nhìn một lần biết tình hình và việc cần làm.
export default function KpiStrip({ events, fieldReports, broadcasts, reviewMetrics }) {
  const kpis = buildKpis({ events, fieldReports, broadcasts, reviewMetrics });
  return (
    <section className="kpi-strip" aria-label="Tổng quan tình hình">
      {kpis.map(k => (
        <div key={k.key} className={`kpi-card kpi-${k.tone}${k.compact ? ' kpi-card-wide' : ''}`}>
          <div className={k.compact ? 'kpi-value kpi-value-text' : 'kpi-value'}>{k.value}</div>
          <div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        </div>
      ))}
    </section>
  );
}
