import { test, expect } from '@playwright/test';
import { mockBackend, openTool } from './helpers.js';

// Story 4.29. Mocked API: the card text is whatever the AI service says, the page adds nothing.

const SEG = {
  ready: true, name: 'e2e-seg-model', version: 'v9.9', status: 'experimental - e2e', trained_on: 'E2E data',
  input_channels: ['B2', 'B3'], sha256_ok: true, temporal_rule: 'ndvi-v1', default_mode: 'balanced',
  modes: { sensitive: 0.5, balanced: 0.7, conservative: 0.9 }, metrics: {}
};

test('officer reads the model card: experimental banner, mode thresholds, GRU not calibrated', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => {
    if (path === '/model-card') return { segmentation: SEG, gru: { ready: true, model_id: 'e2e-gru', calibrated_probability: false, experimental_only: true } };
  });

  await page.goto('/');
  await openTool(page, 'Thẻ mô hình');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Mô hình đang ở mức thử nghiệm');
  await expect(dialog).toContainText('e2e-seg-model');
  await expect(dialog).toContainText('Cân bằng (mặc định)');
  await expect(dialog).toContainText('Khớp với thẻ');
  await expect(dialog).toContainText('Điểm GRU chưa được hiệu chuẩn thành xác suất.');
});

test('when the AI service is down the card shows no numbers', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => {
    if (path === '/model-card') return { segmentation: { ready: false }, gru: { ready: false } };
  });

  await page.goto('/');
  await openTool(page, 'Thẻ mô hình');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Không hiển thị số liệu nào.');
  await expect(dialog).not.toContainText('Ba chế độ vận hành');
});
