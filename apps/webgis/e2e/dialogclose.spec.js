import { test, expect } from '@playwright/test';
import { mockBackend, openTool, openAdminTool, forecastItem } from './helpers.js';

// Mocked API (admin). How the toolbar dialogs close. dialogs.spec.js asserts Escape for four tool dialogs, adminaudit.spec.js and
// systemhealth.spec.js assert the backdrop click for their own dialog. Here:
// Escape on the four admin dialogs (UW-AOI-014, UW-USR-009, UW-AUD-009, UW-DASH-114), the backdrop click on the model card (UW-DASH-085),
// and BUG tests (test.fixme): the backdrop click on the read-only dialogs (UW-FREV-016, UW-RPT-009, UW-BRD-009), focus after closing
// (the CSV wants focus back on the button that opened the dialog) and Escape on the review dialog (UW-FREV-023).

const TOOL = (name, locate) => ({ name, open: (page) => openTool(page, name), opener: 'Công cụ', locate });
const ADMIN = (name, locate) => ({ name, open: (page) => openAdminTool(page, name), opener: 'Quản trị', locate });
const DIALOGS = {
  card: TOOL('Thẻ mô hình', (page) => page.getByRole('dialog', { name: 'Thẻ mô hình' })),
  audit: TOOL('Nhật ký thẩm định', (page) => page.getByRole('heading', { name: 'NHẬT KÝ THẨM ĐỊNH DỰ BÁO' })),
  reports: TOOL('Báo cáo hiện trường', (page) => page.getByRole('heading', { name: 'BÁO CÁO HIỆN TRƯỜNG TỪ CỘNG ĐỒNG' })),
  history: TOOL('Lịch sử lệnh', (page) => page.getByRole('heading', { name: 'NHẬT KÝ ĐIỀU PHỐI & PHÁT CẢNH BÁO KHẨN CẤP' })),
  aoi: ADMIN('Vùng giám sát', (page) => page.getByRole('heading', { name: /QUẢN LÝ VÙNG GIÁM SÁT/ })),
  users: ADMIN('Quản trị người dùng', (page) => page.getByRole('heading', { name: /Quản Trị Người Dùng/ })),
  adminAudit: ADMIN('Nhật ký quản trị', (page) => page.getByRole('dialog', { name: 'Nhật ký quản trị' })),
  health: ADMIN('Tình trạng hệ thống', (page) => page.getByRole('dialog', { name: 'Tình trạng hệ thống' }))
};

// the health panel needs a well-formed answer: the default [] blanks the page (UW-DASH-112, see systemhealthstates.spec.js)
const answer = ({ path }) => (path === '/admin/system-health' ? { checkedAt: '2026-10-10T03:00:00Z', components: [], freshness: [] } : undefined);

async function openDialog(page, key) {
  const d = DIALOGS[key];
  const calls = await mockBackend(page, 'admin', answer);
  await page.goto('/');
  await expect(page.getByRole('button', { name: d.opener })).toBeVisible();
  await d.open(page);
  await expect(d.locate(page)).toBeVisible();
  return { calls, dlg: d.locate(page) };
}

for (const [id, key] of [['UW-AOI-014', 'aoi'], ['UW-USR-009', 'users'], ['UW-AUD-009', 'adminAudit'], ['UW-DASH-114', 'health']]) {
  test(`${id}: Escape closes the "${DIALOGS[key].name}" dialog without sending a write, and a second Escape is harmless`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const { calls, dlg } = await openDialog(page, key);
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await page.keyboard.press('Escape'); // nothing is open: no error, nothing reopens
    await expect(dlg).toHaveCount(0);
    await expect(page.getByRole('button', { name: DIALOGS[key].opener })).toBeEnabled(); // the dashboard behind is still there
    expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('UW-DASH-085: a click on the backdrop closes the model card, a click inside it does not', async ({ page }) => {
  const { dlg } = await openDialog(page, 'card');
  await dlg.getByText('Thẻ mô hình', { exact: true }).click();
  await expect(dlg).toBeVisible();
  await page.mouse.click(4, 4); // backdrop corner
  await expect(dlg).toHaveCount(0);
});

// ponytail: give the read-only dialogs (ReviewAuditModal, FieldReportsModal, BroadcastHistoryModal) the same onClick={onClose} backdrop as ModelCardModal, AdminAuditModal and SystemHealthModal.
for (const [id, key] of [['UW-FREV-016', 'audit'], ['UW-RPT-009', 'reports'], ['UW-BRD-009', 'history']]) {
  test.fixme(`${id}: a click outside the "${DIALOGS[key].name}" dialog closes it, as it does on the model card, the admin log and the health panel`, async ({ page }) => {
    // BUG: expected a click on the backdrop to close the dialog (CSV: "Đóng"); actual: it stays open, while the model card, the admin log
    // and the system health panel close on the same click, so the same gesture does different things.
    const { calls, dlg } = await openDialog(page, key);
    await page.mouse.click(4, 4);
    await expect(dlg).toHaveCount(0);
    expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });
}

// ponytail: remember document.activeElement (or the menu button) when a dialog opens and focus it again in the close handler.
test.fixme('UW-AOI-014 / USR-009 / AUD-009 / FREV-016 / RPT-009 / BRD-009 / DASH-085 / DASH-114: after Escape focus returns to the menu button that opened the dialog', async ({ page }) => {
  // BUG: expected focus on the "Công cụ" / "Quản trị" button after the dialog closes (CSV: "tiêu điểm quay về nút đã mở");
  // actual: focus is on <body>, so a keyboard user starts again from the top of the page.
  await mockBackend(page, 'admin', answer);
  await page.goto('/');
  for (const key of Object.keys(DIALOGS)) {
    const d = DIALOGS[key];
    await d.open(page);
    await expect(d.locate(page), key).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(d.locate(page), key).toHaveCount(0);
    await expect(page.getByRole('button', { name: d.opener }), `${key}: focus after closing`).toBeFocused();
  }
});

// ---------- review dialog ----------

async function openReview(page) {
  const calls = await mockBackend(page, 'officer', ({ path }) => (path === '/forecasts/review-queue' ? [forecastItem('run-1', 'Văn Chấn - E2E', 'medium')] : undefined));
  await page.goto('/');
  await page.locator('.event-card', { hasText: 'Văn Chấn - E2E' }).getByRole('button', { name: 'Phê duyệt' }).click();
  const confirm = page.getByRole('button', { name: 'Xác nhận phê duyệt' });
  await expect(confirm).toBeVisible();
  return { calls, confirm };
}

// ponytail: add Escape to DashboardPage's shortcuts for reviewTarget (setReviewTarget(null)).
test.fixme('UW-FREV-023: Escape closes the review dialog without sending a decision', async ({ page }) => {
  // BUG: expected Escape to close the dialog like every other dialog; actual: Escape does nothing,
  // the dialog only closes with Hủy, because DIALOG_ORDER and the Escape handler do not know reviewTarget.
  const { calls, confirm } = await openReview(page);
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  expect(calls.filter((c) => c.method === 'PATCH')).toEqual([]);
});
