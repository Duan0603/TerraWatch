import React from 'react';
import { buildKpis } from '../utils/kpis';

// Dải số liệu tổng quan phía trên bản đồ: nhìn một lần biết tình hình và việc cần làm.
export default function KpiStrip({ events, fieldReports, broadcasts }) {
  const kpis = buildKpis({ events, fieldReports, broadcasts });
  return (
    <section className="kpi-strip" aria-label="Tổng quan tình hình">
      {kpis.map(k => (
        <div key={k.key} className={`kpi-card kpi-${k.tone}`}>
          <div className="kpi-value">{k.value}</div>
          <div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        </div>
      ))}
    </section>
  );
}
