import React, { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import alertSubscriptionApi from '../api/alertSubscriptionApi';
import { apiErrorMessage } from '../api/forecastApi';
import { maskPhone, cleanPhone, channelsFor, shortAreaName, profileWithPhone } from '../utils/alertSubscriptions';

const card = { margin: '4px 12px 10px', padding: '12px 14px', borderRadius: 10, background: '#fff', border: '1px solid #DCE5E2', fontSize: 12 };
const muted = { fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.5 };
const linkBtn = { border: 'none', background: 'none', color: '#087B70', fontWeight: 700, fontSize: 11, cursor: 'pointer', padding: 0 };

// Story 4.42: which areas the citizen gets alerts for, by app push and/or SMS (SMS reaches phones without the app).
// onSubsChange(list) after every save; onMeChange(me) when the phone changes (the profile form keeps it in sync).
export default function AlertSubscriptionsCard({ onSubsChange, onMeChange, embedded = false }) {
  const [areas, setAreas] = useState([]);
  const [subs, setSubs] = useState({}); // areaId -> subscription
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [phoneDraft, setPhoneDraft] = useState(null); // null = editor closed
  const [smsWaitingArea, setSmsWaitingArea] = useState(null); // SMS asked for this area before a phone existed

  useEffect(() => {
    Promise.all([alertSubscriptionApi.areas(), alertSubscriptionApi.list(), alertSubscriptionApi.me()])
      .then(([a, s, m]) => {
        setAreas((a || []).filter((x) => x.is_active !== false));
        setSubs(Object.fromEntries((s || []).map((x) => [x.areaId, x])));
        setMe(m);
      })
      .catch((e) => setError(apiErrorMessage(e, 'Không tải được khu vực nhận cảnh báo')));
  }, []);

  const channelsOf = (areaId) => subs[areaId]?.alertChannels || [];
  const changed = (next) => { setSubs(next); onSubsChange?.(Object.values(next)); };
  const phoneSaved = (m) => { setMe(m); onMeChange?.(m); };

  const apply = async (areaId, push, sms, phone) => {
    const channels = channelsFor(push, sms);
    setBusy(areaId);
    setError('');
    try {
      if (!channels.length) {
        await alertSubscriptionApi.remove(subs[areaId].subscriptionId);
        const { [areaId]: _gone, ...rest } = subs;
        changed(rest);
      } else {
        const saved = await alertSubscriptionApi.subscribe(areaId, channels, phone);
        changed({ ...subs, [areaId]: saved });
        if (phone) phoneSaved({ ...me, phoneNumber: phone });
      }
      return true;
    } catch (e) {
      setError(e.response?.status === 400 ? 'Số điện thoại không hợp lệ hoặc thiếu số để nhận SMS.' : apiErrorMessage(e, 'Không lưu được lựa chọn'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const toggle = (areaId, kind) => {
    const ch = channelsOf(areaId);
    const push = kind === 'push' ? !ch.includes('PUSH') : ch.includes('PUSH');
    const sms = kind === 'sms' ? !ch.includes('SMS') : ch.includes('SMS');
    if (kind === 'sms' && sms && !me?.phoneNumber) { // SMS needs a number first
      setSmsWaitingArea(areaId);
      setPhoneDraft('');
      return;
    }
    apply(areaId, push, sms);
  };

  const savePhone = async () => {
    const phone = cleanPhone(phoneDraft);
    if (!phone) { setError('Nhập số di động Việt Nam: 0 và 9 số (ví dụ 0912345678) hoặc +84…'); return; }
    if (smsWaitingArea != null) {
      if (await apply(smsWaitingArea, channelsOf(smsWaitingArea).includes('PUSH'), true, phone)) { setPhoneDraft(null); setSmsWaitingArea(null); }
      return;
    }
    setBusy('phone');
    setError('');
    try {
      phoneSaved(await alertSubscriptionApi.updateMe(profileWithPhone(me, phone)));
      setPhoneDraft(null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Không đổi được số điện thoại'));
    } finally {
      setBusy(null);
    }
  };

  const count = Object.keys(subs).length;
  return (
    <section aria-label="Nhận cảnh báo theo khu vực" className={embedded ? 'alert-areas-embedded' : undefined}
      style={embedded ? { fontSize: 13 } : card}>
      {!embedded && <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: '#172524' }}>
          <BellRing size={15} color="#087B70" /> Nhận cảnh báo theo khu vực
        </div>
        <div style={muted}>Khi có cảnh báo sạt lở cho khu vực bạn chọn, bạn nhận thông báo trên app và/hoặc SMS. SMS đến được cả điện thoại không cài app.</div>
      </>}
      {embedded && <div style={{ ...muted, marginTop: 0 }}><b>App</b>: thông báo trên ứng dụng TerraWatch (miễn phí). <b>SMS</b>: tin nhắn tới điện thoại, không cần cài app.</div>}

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span>{me?.phoneNumber ? <>SMS gửi tới <b>{maskPhone(me.phoneNumber)}</b></> : 'Chưa có số điện thoại nhận SMS'}</span>
        {phoneDraft === null && <button type="button" style={linkBtn} onClick={() => { setSmsWaitingArea(null); setPhoneDraft(''); }}>{me?.phoneNumber ? 'Đổi số' : 'Thêm số'}</button>}
      </div>
      {phoneDraft !== null && (
        <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
          <input aria-label="Số điện thoại nhận SMS" inputMode="tel" placeholder="0912345678" value={phoneDraft} autoFocus
            onChange={(e) => setPhoneDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') savePhone(); }}
            style={{ flex: 1, minWidth: 0, padding: '6px 8px', borderRadius: 6, border: '1px solid #DCE5E2', fontSize: 12 }} />
          <button type="button" className="btn-primary" onClick={savePhone} disabled={busy != null} style={{ padding: '6px 10px', fontSize: 12 }}>Lưu</button>
          <button type="button" className="btn-ghost" onClick={() => { setPhoneDraft(null); setSmsWaitingArea(null); setError(''); }} style={{ padding: '6px 8px', fontSize: 12 }}>Hủy</button>
        </div>
      )}
      {smsWaitingArea != null && <div style={muted}>Nhập số để bật SMS cho khu vực này.</div>}

      <div style={{ marginTop: 10 }}>
        {areas.map((a) => {
          const name = shortAreaName(a.name);
          const ch = channelsOf(a.area_id);
          return (
            <div key={a.area_id} className="aa-row" style={{ opacity: busy === a.area_id ? 0.6 : 1 }}>
              <span className="aa-name">{name}</span>
              <label className="aa-chip">
                <input type="checkbox" aria-label={`${name}: nhận thông báo app`} checked={ch.includes('PUSH')} disabled={busy != null} onChange={() => toggle(a.area_id, 'push')} /> App
              </label>
              <label className="aa-chip">
                <input type="checkbox" aria-label={`${name}: nhận SMS`} checked={ch.includes('SMS')} disabled={busy != null} onChange={() => toggle(a.area_id, 'sms')} /> SMS
              </label>
            </div>
          );
        })}
      </div>
      {error && <div role="alert" style={{ ...muted, color: '#B91C1C' }}>{error}</div>}
      {!error && areas.length > 0 && <div style={muted}>{count ? `Đang nhận cảnh báo cho ${count} khu vực.` : 'Chưa chọn khu vực nào: bạn sẽ không nhận cảnh báo.'}</div>}
    </section>
  );
}
