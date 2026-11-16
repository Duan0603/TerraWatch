import React, { useEffect, useState } from 'react';
import { Sun, MapPin, ChevronRight, LocateFixed, Navigation } from 'lucide-react';
import rainWarningApi from '../api/rainWarningApi';
import { LEVEL_INFO, fmtMm } from '../utils/rainWarning';
import { pointsForArea, pointStatus, areaStatus, ADVICE, locateArea, pointNear } from '../utils/citizenStatus';
import { shortAreaName } from '../utils/alertSubscriptions';

const REFRESH_MS = 10 * 60 * 1000; // GIS refreshes rain hourly

/** Story 4.43: today's status of each area (features of the aoi collection) from its rain points. */
export function useAreaStatuses(features, points) {
  const [byArea, setByArea] = useState({});
  const ids = features.map((f) => f.properties.area_id).join(',');
  useEffect(() => {
    if (!features.length || !points.length) { setByArea({}); return undefined; }
    let active = true;
    const load = async () => {
      const plan = features.map((f) => ({ id: f.properties.area_id, ...pointsForArea(f.geometry, points) }));
      const keys = [...new Set(plan.flatMap((a) => a.points.map((p) => p.key)))];
      const live = {};
      await Promise.all(keys.map(async (k) => {
        const p = points.find((x) => x.key === k);
        try { live[k] = pointStatus((await rainWarningApi.getLive(p.lat, p.lng))?.data); } catch { live[k] = null; }
        if (live[k]) live[k].key = k;
      }));
      if (!active) return;
      setByArea(Object.fromEntries(plan.map((a) => [a.id, {
        ...areaStatus(a.points.map((p) => live[p.key])), nearKm: a.nearKm, hasPoints: a.points.length > 0
      }])));
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { active = false; clearInterval(t); };
  }, [ids, points.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return byArea;
}

/** Rain status at the citizen's own position, from the nearest rain point within 30 km. */
export function usePositionStatus(position, points) {
  const [state, setState] = useState(null);
  const near = pointNear(points, position);
  useEffect(() => {
    if (!near) { setState(null); return undefined; }
    let active = true;
    rainWarningApi.getLive(near.lat, near.lng)
      .then((r) => active && setState({ ...pointStatus(r?.data), key: near.key, name: near.name, km: near.km }))
      .catch(() => active && setState({ now: 'missing', next: 'missing', key: near.key, name: near.name, km: near.km }));
    return () => { active = false; };
  }, [near?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return near ? state : null;
}

const Badge = ({ level, big }) => {
  const i = LEVEL_INFO[level] || LEVEL_INFO.missing;
  return <span style={{ display: 'inline-block', padding: big ? '3px 10px' : '1px 8px', borderRadius: 999, fontWeight: 800, fontSize: big ? 13 : 11, color: i.color, background: i.bg, border: `1px solid ${i.color}33`, whiteSpace: 'nowrap' }}>{i.label}</span>;
};

/** Top of the citizen page: one row per followed area, or a prompt to choose areas. */
export default function TodayStatusCard({ features, statuses, suggestion, onChoose, onFocus, onOpenRain,
  allFeatures = [], position = null, here = null, onLocate, geoMsg = '', onFollow, followMsg = '' }) {
  const where = locateArea(allFeatures, position);
  const followed = where && features.some((f) => f.properties.area_id === where.feature.properties.area_id);
  return (
    <section aria-label="Hôm nay ở khu vực của bạn" style={{ margin: '0 12px 10px', padding: '12px 14px', borderRadius: 10, background: '#fff', border: '1px solid #DCE5E2', fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 14, color: '#172524' }}>
        <Sun size={16} color="#087B70" /> <span style={{ flex: 1 }}>Hôm nay ở khu vực của bạn</span>
        {features.length > 0 && <button type="button" onClick={onChoose} style={{ ...linkBtn, fontSize: 11 }} title="Chọn thêm hoặc bỏ khu vực bạn theo dõi">Thêm / đổi khu vực</button>}
      </div>

      <div role="group" aria-label="Vị trí hiện tại của bạn" style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: '#F5F8F7', border: '1px solid #E3ECE9' }}>
        {!position ? (
          <>
            <button type="button" className="btn-ghost" onClick={onLocate}
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '7px 10px' }}>
              <LocateFixed size={14} /> Lấy vị trí hiện tại của tôi
            </button>
            <div style={{ marginTop: 4, fontSize: 10.5, color: '#64748b' }}>{geoMsg || 'Để biết bạn đang ở khu vực nào và mưa ở đó ra sao. Vị trí không được lưu lại.'}</div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              <Navigation size={13} color="#087B70" /> <span style={{ flex: 1 }}>Vị trí hiện tại của bạn</span>
              <button type="button" onClick={onLocate} style={{ ...linkBtn, fontSize: 10.5 }}>Cập nhật</button>
            </div>
            {where && (
              <div style={{ marginTop: 4, color: '#334155', lineHeight: 1.5 }}>
                {where.inside
                  ? <>Bạn đang ở trong khu vực <b>{shortAreaName(where.feature.properties.name)}</b>.</>
                  : <>Bạn không ở trong khu vực trọng điểm nào. Gần nhất: <b>{shortAreaName(where.feature.properties.name)}</b> (cách khoảng {where.km} km).</>}
              </div>
            )}
            {here
              ? <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', color: '#334155' }}>
                  Mưa ở chỗ bạn: <Badge level={here.now} />
                  {here.rain72 != null && <span>{fmtMm(here.rain72)} mm trong 3 ngày</span>}
                  <span style={{ fontSize: 10.5, color: '#64748b' }}>(điểm đo {here.name}, cách {here.km} km)</span>
                </div>
              : <div style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>Chưa có điểm đo mưa trong vòng 30 km quanh bạn.</div>}
            {where && !followed && (
              <button type="button" className="btn-primary" onClick={() => onFollow(where.feature.properties.area_id)}
                style={{ marginTop: 8, width: '100%', padding: '7px 10px', fontSize: 12 }}>
                Theo dõi khu vực {shortAreaName(where.feature.properties.name)}
              </button>
            )}
            {where && followed && <div style={{ marginTop: 4, fontSize: 11, color: '#166534' }}>Bạn đã theo dõi khu vực này.</div>}
            {(followMsg || geoMsg) && <div role="status" style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>{followMsg || geoMsg}</div>}
          </>
        )}
      </div>

      {!features.length && (
        <div style={{ marginTop: 10, lineHeight: 1.5, color: '#334155' }}>
          Bạn chưa chọn khu vực sinh sống. Chọn khu vực để biết mỗi ngày mưa ở đó có nguy hiểm không, và nhận cảnh báo qua SMS.
          {suggestion && !position && <div style={{ marginTop: 4, color: '#0f766e' }}>Gần bạn nhất: <b>{shortAreaName(suggestion.properties.name)}</b>.</div>}
          <button type="button" className="btn-primary" onClick={onChoose} style={{ marginTop: 8, width: '100%', padding: '8px 10px', fontSize: 12 }}>Chọn khu vực của tôi</button>
        </div>
      )}

      {features.map((f) => {
        const s = statuses[f.properties.area_id];
        const name = shortAreaName(f.properties.name);
        const p = s?.point;
        return (
          <div key={f.properties.area_id} role="group" aria-label={`Tình trạng ${name}`} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #EEF2F1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13} color="#64748b" />{name}</span>
              {s ? <Badge level={s.now} big /> : <span style={{ color: '#94a3b8' }}>Đang tải…</span>}
            </div>
            {s && (
              <>
                {p?.rain72 != null && (
                  <div style={{ marginTop: 4, color: '#334155' }}>
                    Mưa 3 ngày qua: <b>{fmtMm(p.rain72)} mm</b>{p.usual72 != null && <> (mức hay gặp ở đây: dưới {fmtMm(p.usual72)} mm)</>}.
                  </div>
                )}
                <div style={{ marginTop: 2, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  24 giờ tới: <Badge level={s.next} />{p?.forecast24 != null && <span>dự báo mưa {fmtMm(p.forecast24)} mm</span>}
                </div>
                <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: (LEVEL_INFO[s.worst] || LEVEL_INFO.missing).bg, color: '#1f2937', lineHeight: 1.45 }}>
                  {ADVICE[s.worst] || ADVICE.missing}
                </div>
                {s.nearKm != null && <div style={{ marginTop: 3, fontSize: 10.5, color: '#64748b' }}>Lấy theo điểm đo mưa gần nhất, cách khoảng {s.nearKm} km.</div>}
                <div style={{ display: 'flex', gap: '4px 14px', marginTop: 6, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => onFocus(f)} style={linkBtn}>Xem trên bản đồ <ChevronRight size={12} /></button>
                  {p?.calibrated && <button type="button" onClick={() => onOpenRain(p.key)} style={linkBtn}>Xem dòng bùn đá có thể tràn tới <ChevronRight size={12} /></button>}
                </div>
              </>
            )}
          </div>
        );
      })}
      {features.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 10.5, color: '#64748b', lineHeight: 1.5 }}>
          Mức tính theo lượng mưa so với 28 năm qua tại chính nơi này, cập nhật mỗi giờ. Đây là mức nguy cơ theo mưa, không phải tin chắc chắn có sạt lở. Trên bản đồ, khu vực của bạn được tô màu theo mức hôm nay.
        </div>
      )}
    </section>
  );
}

const linkBtn = { border: 'none', background: 'none', padding: 0, color: '#087B70', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' };
