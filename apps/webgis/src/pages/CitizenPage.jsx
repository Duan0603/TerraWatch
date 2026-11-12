import React, { useState, useEffect } from 'react';
import { ShieldCheck, LogOut, MapPin, LocateFixed } from 'lucide-react';
import { rankZones } from '../utils/zoneLocation';
import DetailPanel from '../components/DetailPanel';
import { RISK_LABELS } from '../components/EventCard';
import { fmtVN } from '../utils/time';
import forecastApi, { apiErrorMessage } from '../api/forecastApi';
import { useAuth } from '../context/AuthContext';

// Trang tối giản cho công dân (citizen): chỉ xem bản đồ các điểm sạt lở ĐÃ PHÊ DUYỆT
// (đã duyệt, còn hiệu lực) cùng bằng chứng mưa/địa hình — không có nút thẩm định/phát
// cảnh báo nào (những thao tác đó chỉ dành cho officer/admin trên DashboardPage).
export default function CitizenPage() {
  const { user, logout } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // Vùng cảnh báo đã duyệt và còn hiệu lực (cùng nguồn với bộ nhớ ngoại tuyến của ứng dụng di động)
  useEffect(() => {
    forecastApi.getApprovedZones().then((data) => {
      setEvents(data);
      if (data.length > 0) {
        setSelectedEventId(data[0].id);
      }
    }).catch((err) => setLoadError(apiErrorMessage(err, 'Không tải được vùng cảnh báo')));
  }, []);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;
  const [position, setPosition] = useState(null); // [lng, lat]
  const [geoMsg, setGeoMsg] = useState('');
  const list = position ? rankZones(events, position) : events;
  const insideZone = list.find((z) => z.inside);

  const locate = () => {
    if (!navigator.geolocation) { setGeoMsg('Trình duyệt không hỗ trợ định vị.'); return; }
    setGeoMsg('Đang lấy vị trí…');
    navigator.geolocation.getCurrentPosition((p) => {
      const pos = [p.coords.longitude, p.coords.latitude];
      setPosition(pos);
      setGeoMsg('');
      const first = rankZones(events, pos)[0];
      if (first) setSelectedEventId(first.id);
    }, (e) => setGeoMsg(e.code === 1 ? 'Bạn chưa cho phép trang web truy cập vị trí.' : 'Không lấy được vị trí. Vui lòng thử lại.'),
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
          <div className="status-chip">
            Vùng cảnh báo đã duyệt, còn hiệu lực
          </div>

          <div className="nav-user">
            <div className="nav-avatar">
              {(user?.fullName || 'CD').split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase()}
            </div>
            <div className="nav-user-info">
              <div className="nav-user-name">{user?.fullName || 'Công dân'}</div>
              <div className="nav-user-role">Tài khoản công dân</div>
            </div>
          </div>

          <button className="btn-ghost" onClick={logout} title="Đăng xuất">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <div className="main-layout">
        {/* Danh sách chỉ đọc các vùng đã được cán bộ phê duyệt và còn hiệu lực — không có nút thẩm định.
            Đây là mọi vùng đang hiệu lực, chưa lọc theo khu vực người dân đăng ký (backend chưa trả khu vực của ô). */}
        <aside className="sidebar citizen-list">
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Cảnh báo đang hiệu lực ({events.length})</span>
            <button type="button" className="btn-ghost" onClick={locate} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <LocateFixed size={14} /> Vị trí của tôi
            </button>
          </div>
          {geoMsg && <div role="status" style={{ padding: '0 16px 10px', fontSize: 12, color: '#64748b' }}>{geoMsg}</div>}
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
              onClick={() => setSelectedEventId(ev.id)}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                borderLeft: ev.id === selectedEventId ? '3px solid #087B70' : '3px solid transparent',
                background: ev.id === selectedEventId ? 'rgba(8,123,112,0.08)' : 'transparent'
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
          {loadError && <div role="alert" style={{ padding: 16, fontSize: 12, color: '#B91C1C' }}>{loadError}</div>}
          {events.length === 0 && !loadError && (
            <div style={{ padding: 16, fontSize: 12, color: '#64748b' }}>
              Hiện chưa có vùng cảnh báo nào đã được cán bộ duyệt và còn hiệu lực. Đây không phải xác nhận an toàn.
            </div>
          )}

          {/* Tóm tắt từ hướng dẫn của Cục Quản lý đê điều và PCTT; không tự đặt thêm khuyến cáo. */}
          <section aria-label="Bạn nên làm gì khi có cảnh báo sạt lở" style={{ margin: '8px 12px 16px', padding: '12px 14px', borderRadius: 10, background: '#F5F8F7', border: '1px solid #DCE5E2', fontSize: 12, lineHeight: 1.6, color: '#334155' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#172524' }}>Bạn nên làm gì khi có cảnh báo sạt lở</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Sẵn sàng sơ tán theo hướng dẫn của chính quyền địa phương; bảo vệ tính mạng trước tiên.</li>
              <li>Nghe tiếng động lớn hoặc thấy dấu hiệu bất thường: nhanh chóng rời khỏi nơi nguy hiểm.</li>
              <li>Không đi qua và không lại gần khu vực đang sạt lở.</li>
              <li>Thấy dấu hiệu sạt lở: báo ngay cho chính quyền và người xung quanh.</li>
              <li>Theo dõi tin mưa lớn, kéo dài trên báo, đài, tivi.</li>
            </ul>
            <div style={{ marginTop: 8, fontWeight: 700 }}>Cứu nạn khẩn cấp: <a href="tel:112" style={{ color: '#B91C1C' }}>112</a></div>
            <div style={{ marginTop: 6, fontSize: 10, color: '#64748b' }}>
              Nguồn: Cục Quản lý đê điều và Phòng, chống thiên tai, qua{' '}
              <a href="https://baoquocte.vn/ky-nang-quan-trong-de-dam-bao-an-toan-truoc-thien-tai-lu-quet-va-sat-lo-dat-329420.html" target="_blank" rel="noreferrer">Báo Quốc tế (30/09/2025)</a>.
            </div>
          </section>
        </aside>

        <DetailPanel
          selectedEvent={selectedEvent}
          events={events}
          onSelectEvent={setSelectedEventId}
          citizen
        />
      </div>
    </div>
  );
}
