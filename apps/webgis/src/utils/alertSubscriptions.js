// Story 4.42: helpers for the citizen's alert-area card.

/** 0912345678 -> 091****678; empty stays empty. */
export const maskPhone = (p) => (p && p.length > 6 ? `${p.slice(0, 3)}****${p.slice(-3)}` : p || '');

/** Vietnamese mobile: 0 + 9 digits, or +84 + 9 digits (spaces, dots, dashes ignored). Returns the cleaned number or null. */
export function cleanPhone(input) {
  const p = String(input || '').replace(/[\s.-]/g, '');
  return /^(0\d{9}|\+84\d{9})$/.test(p) ? p : null;
}

/** Channels to send for the two toggles; [] means unsubscribe. */
export const channelsFor = (push, sms) => [...(push ? ['PUSH'] : []), ...(sms ? ['SMS'] : [])];

/** "Vùng trọng điểm 1: Mù Cang Chải (Yên Bái)" -> "Mù Cang Chải (Yên Bái)". */
export const shortAreaName = (name) => String(name || '').replace(/^Vùng trọng điểm \d+:\s*/, '');

/** Fields PUT /auth/me replaces (it clears whatever is left out), so a phone change re-sends the rest as read. */
export const PROFILE_FIELDS = ['fullName', 'phoneNumber', 'dateOfBirth', 'gender', 'province', 'district', 'commune',
  'addressLine', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation'];

export const profileWithPhone = (me, phoneNumber) =>
  Object.fromEntries(PROFILE_FIELDS.map((k) => [k, k === 'phoneNumber' ? phoneNumber : me?.[k] ?? null]));
