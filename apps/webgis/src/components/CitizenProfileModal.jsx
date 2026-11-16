import React, { useEffect, useState } from 'react';
import { X, UserRound, Home, HeartHandshake, MapPinned, Info, CheckCircle2 } from 'lucide-react';
import alertSubscriptionApi from '../api/alertSubscriptionApi';
import { apiErrorMessage } from '../api/forecastApi';
import AlertSubscriptionsCard from './AlertSubscriptionsCard';
import { PROFILE_FIELDS, cleanPhone } from '../utils/alertSubscriptions';

// [section, icon, hint, [[field, label, placeholder, wide?]]]
const SECTIONS = [
  ['Thông tin cá nhân', UserRound, null, [['fullName', 'Họ và tên', 'Nhập họ và tên'], ['phoneNumber', 'Số điện thoại nhận SMS', 'VD: 0912 345 678']]],
  ['Nơi ở', Home, 'Giúp cán bộ biết bạn ở đâu khi cần hỗ trợ.', [['province', 'Tỉnh / thành phố', 'VD: Lào Cai'], ['district', 'Huyện', 'VD: Bảo Yên'],
    ['commune', 'Xã / phường', 'VD: Phúc Khánh'], ['addressLine', 'Thôn, bản, số nhà', 'VD: Thôn Làng Nủ']]],
  ['Người liên hệ khi khẩn cấp', HeartHandshake, 'Khi khu vực của bạn nguy hiểm, trang chính hiện nút gọi nhanh người này.',
    [['emergencyContactName', 'Họ tên', 'VD: Nguyễn Thị B'], ['emergencyContactPhone', 'Số điện thoại', 'VD: 0987 654 321'], ['emergencyContactRelation', 'Quan hệ', 'VD: Mẹ']]]
];
const RELATIONS = ['Bố', 'Mẹ', 'Vợ', 'Chồng', 'Con', 'Anh / chị / em', 'Họ hàng', 'Hàng xóm'];
const initials = (name) => String(name || 'CD').replace(/\(.*\)/, '').trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase();

// Story 4.43: the citizen's profile and the areas they follow; the page's status, map and calls all read from here.
export default function CitizenProfileModal({ open, focusAreas, onClose, onSaved, onSubsChange }) {
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(''); setSaved(false);
    alertSubscriptionApi.me().then((m) => { setMe(m); setForm(Object.fromEntries(PROFILE_FIELDS.map((k) => [k, m?.[k] ?? '']))); })
      .catch((e) => setError(apiErrorMessage(e, 'Không tải được hồ sơ')));
  }, [open]);

  useEffect(() => {
    if (open && focusAreas) document.getElementById('my-areas')?.scrollIntoView({ block: 'start' });
  }, [open, focusAreas, me]);

  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);

  if (!open) return null;
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setSaved(false); };

  const save = async () => {
    if (!String(form.fullName || '').trim()) { setError('Hãy nhập họ và tên.'); return; }
    const body = { ...form };
    for (const k of ['phoneNumber', 'emergencyContactPhone']) {
      if (!String(body[k] || '').trim()) { body[k] = null; continue; }
      const p = cleanPhone(body[k]);
      if (!p) { setError('Số điện thoại phải là 0 và 9 số (ví dụ 0912345678) hoặc +84…'); return; }
      body[k] = p;
    }
    for (const k of PROFILE_FIELDS) if (body[k] === '') body[k] = null;
    setBusy(true); setError('');
    try {
      const m = await alertSubscriptionApi.updateMe(body);
      setMe(m); setSaved(true); onSaved?.(m);
    } catch (e) {
      setError(e.response?.status === 400 ? 'Có thông tin không hợp lệ, hãy kiểm tra số điện thoại.' : apiErrorMessage(e, 'Không lưu được hồ sơ'));
    } finally { setBusy(false); }
  };

  return (
    <div className="pf-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pf-dialog" role="dialog" aria-modal="true" aria-label="Hồ sơ của tôi">
        <header className="pf-head">
          <div className="pf-avatar" aria-hidden="true">{initials(me?.fullName)}</div>
          <div className="pf-head-text">
            <h2>Hồ sơ của tôi</h2>
            <div>{me?.fullName || 'Tài khoản công dân'}{me?.email ? ` · ${me.email}` : ''}</div>
          </div>
          <button type="button" className="pf-close" aria-label="Đóng hồ sơ" onClick={onClose}><X size={18} /></button>
        </header>

        <div className="pf-body">
          <div className="pf-note"><Info size={14} /> Khu vực bạn chọn quyết định trang chính hiện tình trạng ở đâu và bạn nhận cảnh báo cho nơi nào.</div>

          {SECTIONS.map(([title, Icon, hint, fields]) => (
            <section key={title} className="pf-section">
              <div className="pf-section-title"><span className="pf-icon"><Icon size={15} /></span>{title}</div>
              {hint && <div className="pf-hint">{hint}</div>}
              <div className={`pf-grid pf-grid-${fields.length === 3 ? 3 : 2}`}>
                {fields.map(([k, l, ph]) => (
                  <label key={k} className="pf-field">
                    <span>{l}</span>
                    <input aria-label={l} value={form[k] ?? ''} placeholder={ph} onChange={set(k)} disabled={!me}
                      inputMode={k.toLowerCase().includes('phone') ? 'tel' : undefined}
                      list={k === 'emergencyContactRelation' ? 'pf-relations' : undefined} />
                  </label>
                ))}
              </div>
            </section>
          ))}
          <datalist id="pf-relations">{RELATIONS.map((r) => <option key={r} value={r} />)}</datalist>

          <section id="my-areas" className="pf-section">
            <div className="pf-section-title"><span className="pf-icon"><MapPinned size={15} /></span>Khu vực của tôi</div>
            <div className="pf-hint">Tích ô là lưu ngay, không cần bấm "Lưu hồ sơ".</div>
            {me && <AlertSubscriptionsCard key={me.phoneNumber || 'none'} embedded onSubsChange={onSubsChange}
              onMeChange={(m) => { setMe(m); setForm((f) => ({ ...f, phoneNumber: m.phoneNumber || '' })); onSaved?.(m); }} />}
          </section>
        </div>

        <footer className="pf-foot">
          <div className="pf-msg">
            {error && <span role="alert" className="pf-error">{error}</span>}
            {!error && saved && <span role="status" className="pf-ok"><CheckCircle2 size={14} /> Đã lưu hồ sơ.</span>}
          </div>
          <button type="button" className="btn-ghost pf-btn" onClick={onClose}>Đóng</button>
          <button type="button" className="btn-primary pf-btn" disabled={busy || !me} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
        </footer>
      </div>
    </div>
  );
}
