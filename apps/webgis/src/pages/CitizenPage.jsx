import React, { useState, useEffect } from 'react';
import { ShieldCheck, LogOut, MapPin, CheckCircle2, Phone, AlertTriangle, UserRound } from 'lucide-react';
import { rankZones, monitoredPoints, nearestPoint } from '../utils/zoneLocation';
import DetailPanel from '../components/DetailPanel';
import TodayStatusCard, { useAreaStatuses, usePositionStatus } from '../components/TodayStatusCard';
import CitizenProfileModal from '../components/CitizenProfileModal';
import alertSubscriptionApi from '../api/alertSubscriptionApi';
import { LEVEL_INFO } from '../utils/rainWarning';
import { RANK, worse, nearestArea, ADVICE, locateArea, centroid } from '../utils/citizenStatus';
import { shortAreaName } from '../utils/alertSubscriptions';
import MobileTabBar from '../components/MobileTabBar';
import { RISK_LABELS } from '../components/EventCard';
import { fmtVN } from '../utils/time';
import forecastApi, { apiErrorMessage } from '../api/forecastApi';
import { useAuth } from '../context/AuthContext';

// Trang tối giản cho công dân (citizen): chỉ xem bản đồ các điểm sạt lở ĐÃ PHÊ DUYỆT
// (đã duyệt, còn hiệu lực) cùng bằng chứng mưa/địa hình — không có nút thẩm định/phát
// cảnh báo nào (những thao tác đó chỉ dành cho officer/admin trên DashboardPage).
const REFRESH_MS = 60000;
const VN_TIME = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false });
const card = { margin: '0 12px 10px', padding: '10px 12px', borderRadius: 10, background: '#F5F8F7', border: '1px solid #DCE5E2', fontSize: 12 };
const muted = { marginTop: 4, fontSize: 11, color: '#64748b', lineHeight: 1.5 };
const callBtn = (bg) => ({ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, background: bg, color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 12 });

export default function CitizenPage() {
  const { user, logout } = useAuth();
  const [zones, setZones] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [received, setReceived] = useState([]);
  const [receivedError, setReceivedError] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [mobileTab, setMobileTab] = useState('list');
  const [points, setPoints] = useState([]); // điểm GIS đang lấy mưa mỗi giờ
  const [aoi, setAoi] = useState(null); // ranh giới vùng trọng điểm (công khai)
  const [lastUpdated, setLastUpdated] = useState(null);
  const [chosenKey, setChosenKey] = useState('');
  // Story 4.43: the areas the citizen follows drive the status card, the map colours and the action banner
  const [subs, setSubs] = useState([]);
  const [me, setMe] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileAtAreas, setProfileAtAreas] = useState(false);
  const [focus, setFocus] = useState(null);
  const [rainRequest, setRainRequest] = useState(null);
  useEffect(() => {
    alertSubscriptionApi.list().then((l) => setSubs(l || [])).catch(() => {});
    alertSubscriptionApi.me().then(setMe).catch(() => {});
  }, []);

  // Vùng cảnh báo đã duyệt và còn hiệu lực (cùng nguồn với bộ nhớ ngoại tuyến của ứng dụng di động),
  // tải lại mỗi phút để vùng mới duyệt hiện ra; lỗi tạm thời giữ nguyên danh sách đang có.
  useEffect(() => {
    let active = true;
    const load = () => {
      forecastApi.getApprovedZones()
        .then((data) => { if (active) { setZones(data); setLoadError(null); setLastUpdated(new Date()); } })
        .catch((err) => active && setLoadError(apiErrorMessage(err, 'Không cập nhật được vùng cảnh báo')));
      // demo/test points are staff data, not places a citizen lives
      forecastApi.getMonitoredPoints().then((d) => active && setPoints(monitoredPoints(d).filter((p) => !/^demo zone/i.test(p.name)))).catch(() => {});
      forecastApi.getMyAlerts()
        .then((data) => { if (active) { setReceived(data); setReceivedError(null); } })
        .catch((err) => active && setReceivedError(apiErrorMessage(err, 'Không tải được cảnh báo đã nhận')));
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { active = false; clearInterval(timer); };
  }, []);

  // Ranh giới vùng trọng điểm: ít khi đổi, tải một lần.
  useEffect(() => { forecastApi.getAoiCollection().then(setAoi).catch(() => {}); }, []);

  // Vùng rời danh sách đúng lúc hết hạn, không đợi lần tải lại kế tiếp.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const events = zones.filter((z) => new Date(z.validUntil).getTime() > now);
  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0] || null;
  const openZone = (id) => { setSelectedEventId(id); setMobileTab('map'); };
  const [position, setPosition] = useState(null); // [lng, lat]
  const [geoMsg, setGeoMsg] = useState('');
  const list = position ? rankZones(events, position) : events;
  const insideZone = list.find((z) => z.inside);
  // No warning to show: weather of the chosen monitored point, else of the one nearest the user.
  // a rain point 800 km away says nothing about where the citizen is: only within 30 km
  const nearest = position ? nearestPoint(points, position) : null;
  const near = nearest && nearest.distanceKm <= 30 ? nearest : null;
  const wp = points.find((p) => p.key === chosenKey) || near;
  const weatherPoint = wp && {
    location: wp === near && !chosenKey ? `Điểm đo mưa gần bạn nhất: ${wp.name} (cách khoảng ${Math.round(near.distanceKm)} km)` : `Điểm đo mưa: ${wp.name}`,
    lat: wp.lat, lng: wp.lng,
  };
  const allAreas = aoi?.features || [];
  const myIds = subs.map((x) => x.areaId);
  const myAreas = allAreas.filter((f) => myIds.includes(f.properties.area_id));
  const statuses = useAreaStatuses(myAreas, points);
  const overall = myAreas.reduce((lv, f) => worse(lv, statuses[f.properties.area_id]?.worst || 'missing'), 'missing');
  const urgent = myAreas.filter((f) => (RANK[statuses[f.properties.area_id]?.worst] ?? -1) >= RANK.warning);
  const urgentLevel = urgent.reduce((lv, f) => worse(lv, statuses[f.properties.area_id].worst), 'none');
  const mapAoi = aoi && { ...aoi, features: allAreas.map((f) => (myIds.includes(f.properties.area_id)
    ? { ...f, properties: { ...f.properties, mine: true, color: (LEVEL_INFO[statuses[f.properties.area_id]?.worst] || LEVEL_INFO.missing).color } }
    : f)) };
  const here = usePositionStatus(position, points);
  // after locating: frame the area the citizen is in, else the citizen and the nearest area together
  useEffect(() => {
    const where = locateArea(allAreas, position);
    if (!where) return;
    const geometry = where.inside ? where.feature.geometry : { type: 'MultiPoint', coordinates: [position, centroid(where.feature.geometry)] };
    setFocus({ geometry, n: Date.now() });
  }, [position?.[0], position?.[1], allAreas.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [followMsg, setFollowMsg] = useState('');
  // follow the area the citizen stands in (or the nearest): SMS too when the profile has a phone
  const follow = async (areaId) => {
    setFollowMsg('');
    try {
      const saved = await alertSubscriptionApi.subscribe(areaId, me?.phoneNumber ? ['PUSH', 'SMS'] : ['PUSH']);
      setSubs((prev) => [...prev.filter((x) => x.areaId !== areaId), saved]);
      if (!me?.phoneNumber) setFollowMsg('Đã theo dõi (thông báo app). Thêm số điện thoại trong hồ sơ để nhận cả SMS.');
    } catch (e) {
      setFollowMsg(apiErrorMessage(e, 'Không theo dõi được khu vực này'));
    }
  };
  const openProfile = (atAreas) => { setProfileAtAreas(atAreas); setProfileOpen(true); };
  const focusArea = (f) => { setFocus({ geometry: f.geometry, n: Date.now() }); setMobileTab('map'); };
  const openRain = (key) => { setRainRequest({ key, n: Date.now() }); setMobileTab('map'); };

  const locate = () => {
    if (!navigator.geolocation) { setGeoMsg('Trình duyệt không hỗ trợ định vị.'); return; }
    setGeoMsg('Đang lấy vị trí…');
    navigator.geolocation.getCurrentPosition((p) => {
      const pos = [p.coords.longitude, p.coords.latitude];
      setPosition(pos);
      setGeoMsg('');
      const first = rankZones(events, pos)[0];
      if (first) setSelectedEventId(first.id);
    }, (e) => {
      setPosition(null); // an old fix must not keep saying "you are in / near" after a failed retry
      setGeoMsg(e.code === 1 ? 'Bạn chưa cho phép trang web truy cập vị trí.' : 'Không lấy được vị trí. Vui lòng thử lại.');
    },
    { enableHighAccuracy: true, timeout: 10000 });
  };

  return (
    <div className="dashboard-root">
      <header className="top-nav">
        <div className="nav-left">
          <div className="nav-brand">
            <div className="nav-brand-icon">
              <ShieldCheck size={20} color="#fff" />
            </div>
            <div className="nav-brand-text">
              <span className="nav-brand-name">TerraWatch</span>
              <span className="nav-brand-sub">Cảnh báo sạt lở cho người dân</span>
            </div>
          </div>
        </div>

        <div className="nav-right">
          <div className="status-chip" aria-label="Tình trạng khu vực của bạn" style={myAreas.length ? { color: (LEVEL_INFO[overall] || LEVEL_INFO.missing).color, background: (LEVEL_INFO[overall] || LEVEL_INFO.missing).bg } : undefined}>
            {myAreas.length ? `Khu vực của bạn hôm nay: ${(LEVEL_INFO[overall] || LEVEL_INFO.missing).label}` : 'Chưa chọn khu vực của bạn'}
          </div>

          <button type="button" className="nav-user" onClick={() => openProfile(false)} title="Hồ sơ của tôi" aria-label="Mở hồ sơ của tôi"
            style={{ border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
            <div className="nav-avatar">
              {(user?.fullName || 'CD').split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase()}
            </div>
            <div className="nav-user-info">
              <div className="nav-user-name">{user?.fullName || 'Công dân'}</div>
              <div className="nav-user-role"><UserRound size={10} style={{ verticalAlign: -1 }} /> Hồ sơ của tôi</div>
            </div>
          </button>

          <button className="btn-ghost" onClick={logout} title="Đăng xuất">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <div className="main-layout">
        {/* Danh sách chỉ đọc các vùng đã được cán bộ phê duyệt và còn hiệu lực — không có nút thẩm định.
            Đây là mọi vùng đang hiệu lực, chưa lọc theo khu vực người dân đăng ký (backend chưa trả khu vực của ô). */}
        <aside className={`sidebar citizen-list${mobileTab === 'map' ? ' mobile-hidden' : ''}`}>
          <div style={{ height: 12 }} />
          {urgent.length > 0 && (
            <div role="alert" aria-label="Cần hành động ngay" style={{ margin: '0 12px 10px', padding: '12px 14px', borderRadius: 10, background: '#FEF2F2', border: '2px solid #DC2626', fontSize: 12, color: '#7F1D1D', lineHeight: 1.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 14, color: '#B91C1C' }}>
                <AlertTriangle size={17} /> {LEVEL_INFO[urgentLevel].label}: {urgent.map((f) => shortAreaName(f.properties.name)).join(', ')}
              </div>
              <div style={{ marginTop: 4 }}>{ADVICE[urgentLevel]}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <a href="tel:112" style={callBtn('#B91C1C')}><Phone size={13} /> Gọi 112</a>
                {me?.emergencyContactPhone && <a href={`tel:${me.emergencyContactPhone}`} style={callBtn('#0f766e')}><Phone size={13} /> Gọi {me.emergencyContactName || 'người thân'}{me.emergencyContactRelation ? ` (${me.emergencyContactRelation})` : ''}</a>}
              </div>
            </div>
          )}
          <TodayStatusCard features={myAreas} statuses={statuses} suggestion={nearestArea(allAreas, position)}
            onChoose={() => openProfile(true)} onFocus={focusArea} onOpenRain={openRain}
            allFeatures={allAreas} position={position} here={here} onLocate={locate} geoMsg={geoMsg} onFollow={follow} followMsg={followMsg} />

          <div style={{ padding: '6px 16px 10px' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Cảnh báo chính thức từ cán bộ ({events.length})</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {lastUpdated ? `Cập nhật lúc ${VN_TIME.format(lastUpdated)} · tự cập nhật mỗi phút` : 'Đang tải…'}
            </div>
          </div>
          {position && events.length > 0 && (
            <div role="status" style={{ margin: '0 12px 10px', padding: '10px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.6,
              background: insideZone ? '#FEF2F2' : '#F0FDF4', color: insideZone ? '#991B1B' : '#166534', border: `1px solid ${insideZone ? '#FECACA' : '#BBF7D0'}` }}>
              {insideZone
                ? <><strong>Bạn đang ở trong vùng cảnh báo {insideZone.location}.</strong> Làm theo hướng dẫn bên dưới và chỉ dẫn của chính quyền địa phương.</>
                : <>Bạn không ở trong vùng cảnh báo nào đang hiệu lực. Gần nhất: {list[0].location} (khoảng {Math.round(list[0].distanceKm)} km). Vẫn theo dõi thông báo của chính quyền.</>}
            </div>
          )}
          {list.map((ev) => (
            <div
              key={ev.id}
              role="button"
              tabIndex={0}
              onClick={() => openZone(ev.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openZone(ev.id); } }}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                borderLeft: ev.id === selectedEvent?.id ? '3px solid #087B70' : '3px solid transparent',
                background: ev.id === selectedEvent?.id ? 'rgba(8,123,112,0.08)' : 'transparent'
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.location}</div>
              <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={11} /> Mức nguy cơ: {RISK_LABELS[ev.risk] || ev.risk}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Hiệu lực đến {fmtVN(ev.validUntil)}</div>
              {position && (
                <div style={{ fontSize: 11, fontWeight: 600, color: ev.inside ? '#B91C1C' : '#475569' }}>
                  {ev.inside ? 'Bạn đang ở trong vùng này' : `Cách bạn khoảng ${Math.round(ev.distanceKm)} km`}
                </div>
              )}
            </div>
          ))}
          {loadError && <div role="alert" style={{ padding: '0 16px 10px', fontSize: 12, color: '#B91C1C' }}>{loadError}</div>}
          {events.length === 0 && !loadError && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: '#166534' }}>
                <CheckCircle2 size={15} /> Chưa có cảnh báo chính thức nào
              </div>
              <div style={muted}>Cán bộ chưa phát cảnh báo sạt lở nào còn hiệu lực. Mức nguy cơ theo mưa hằng ngày ở khu vực của bạn xem ở mục "Hôm nay" phía trên.</div>
            </div>
          )}
          {events.length === 0 && points.length > 0 && (
            <div style={card}>
              <label htmlFor="weather-point" style={{ fontWeight: 700, fontSize: 13, color: '#172524' }}>Xem mưa tại một điểm đo khác</label>
              <select id="weather-point" value={chosenKey} onChange={(e) => { setChosenKey(e.target.value); if (e.target.value) setMobileTab('map'); }}
                style={{ width: '100%', marginTop: 6, padding: '7px 8px', borderRadius: 6, border: '1px solid #DCE5E2', fontSize: 12, background: '#fff' }}>
                <option value="">{near ? `Gần bạn nhất: ${near.name} (~${Math.round(near.distanceKm)} km)` : 'Chọn một điểm…'}</option>
                {points.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
              </select>
              <div style={muted}>Số liệu tại điểm đo mưa, không phải đúng vị trí nhà bạn.</div>
            </div>
          )}

          <section aria-label="Cảnh báo đã nhận trong 7 ngày qua" style={{ margin: '4px 12px 0', fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '4px 4px 8px' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#172524' }}>Cảnh báo đã nhận <span style={{ fontWeight: 400, color: '#64748b' }}>(7 ngày)</span></span>
              {!receivedError && received.length === 0 && <span style={{ color: '#64748b' }}>Chưa có</span>}
            </div>
            {receivedError && <div role="alert" style={{ padding: '0 4px 8px', color: '#B91C1C' }}>{receivedError}</div>}
            {received.map((a) => {
              const state = a.status === 'revoked' ? ['Đã thu hồi', '#475569', '#F1F5F9']
                : a.expired ? ['Hết hạn', '#475569', '#F1F5F9'] : ['Còn hiệu lực', '#B91C1C', '#FEF2F2'];
              return (
                <div key={a.broadcastId} style={{ padding: '10px 12px', marginBottom: 8, borderRadius: 8, border: '1px solid #DCE5E2', background: '#fff', lineHeight: 1.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <strong style={{ fontSize: 12 }}>{a.areaName || a.title}</strong>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 999, color: state[1], background: state[2], whiteSpace: 'nowrap' }}>{state[0]}</span>
                  </div>
                  <div style={{ color: '#334155', margin: '4px 0' }}>{a.message}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    Mức {RISK_LABELS[a.severity] || a.severity} · Gửi lúc {fmtVN(a.issuedAt)}{a.validUntil && ` · Hiệu lực đến ${fmtVN(a.validUntil)}`}
                  </div>
                </div>
              );
            })}
          </section>

          <a href="tel:112" style={{ margin: '8px 12px', padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#991B1B', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={14} /> Cứu nạn khẩn cấp</span>
            <span style={{ fontSize: 18, fontWeight: 800 }}>112</span>
          </a>
          {me?.emergencyContactPhone
            ? <a href={`tel:${me.emergencyContactPhone}`} style={{ margin: '0 12px 8px', padding: '9px 14px', borderRadius: 10, background: '#F0FDFA', border: '1px solid #99F6E4',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#115E59', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={14} /> Gọi {me.emergencyContactName || 'người thân'}{me.emergencyContactRelation ? ` (${me.emergencyContactRelation})` : ''}</span>
                <span>{me.emergencyContactPhone}</span>
              </a>
            : <button type="button" onClick={() => openProfile(false)} style={{ margin: '0 12px 8px', padding: '8px 14px', borderRadius: 10, background: '#fff', border: '1px dashed #99F6E4', color: '#115E59', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                + Thêm người liên hệ khẩn cấp (hiện nút gọi nhanh khi có nguy hiểm)
              </button>}

          {/* Tóm tắt từ hướng dẫn của Cục Quản lý đê điều và PCTT; không tự đặt thêm khuyến cáo. Mở sẵn khi đang có cảnh báo. */}
          <details key={events.length > 0 || urgent.length > 0 ? 'warn' : 'calm'} open={events.length > 0 || urgent.length > 0}
            style={{ margin: '0 12px 16px', padding: '10px 14px', borderRadius: 10, background: '#F5F8F7', border: '1px solid #DCE5E2', fontSize: 12, lineHeight: 1.6, color: '#334155' }}>
            <summary style={{ fontWeight: 700, fontSize: 13, color: '#172524', cursor: 'pointer' }}>Cần làm gì khi có cảnh báo sạt lở?</summary>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>Sẵn sàng sơ tán theo hướng dẫn của chính quyền; bảo vệ tính mạng trước tiên.</li>
              <li>Nghe tiếng động lớn, thấy dấu hiệu bất thường: rời ngay khỏi nơi nguy hiểm.</li>
              <li>Không đi qua, không lại gần khu vực đang sạt lở.</li>
              <li>Thấy dấu hiệu sạt lở: báo ngay chính quyền và người xung quanh.</li>
              <li>Theo dõi tin mưa lớn trên báo, đài, tivi.</li>
            </ul>
            <div style={{ marginTop: 6, fontSize: 10, color: '#64748b' }}>
              Nguồn: Cục Quản lý đê điều và PCTT, qua{' '}
              <a href="https://baoquocte.vn/ky-nang-quan-trong-de-dam-bao-an-toan-truoc-thien-tai-lu-quet-va-sat-lo-dat-329420.html" target="_blank" rel="noreferrer">Báo Quốc tế (30/09/2025)</a>.
            </div>
          </details>
        </aside>

        <DetailPanel
          selectedEvent={selectedEvent}
          events={events}
          onSelectEvent={setSelectedEventId}
          className={mobileTab === 'list' ? 'mobile-hidden' : ''}
          aoi={mapAoi}
          weatherPoint={weatherPoint}
          citizen
          focus={focus}
          rainRequest={rainRequest}
          myPosition={position}
        />
      </div>

      <MobileTabBar active={mobileTab} onChange={setMobileTab} />
      <CitizenProfileModal open={profileOpen} focusAreas={profileAtAreas} onClose={() => setProfileOpen(false)}
        onSaved={setMe} onSubsChange={setSubs} />
    </div>
  );
}
