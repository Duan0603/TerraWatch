import { test, expect } from '@playwright/test';
import { mockBackend } from './helpers.js';

// Mocked API. The selector sits on the map toolbar; choosing a region flies the map there (no tiles are loaded in tests).

async function openSelector(page) {
  await mockBackend(page, 'officer', () => undefined);
  await page.goto('/');
  const trigger = page.locator('.location-selector-trigger');
  await expect(trigger).toBeVisible();
  return trigger;
}
const current = (page) => page.locator('.location-selector-current-name');

test('starts on the national view and lists all regions with the national one marked', async ({ page }) => {
  const trigger = await openSelector(page);
  await expect(current(page)).toHaveText('Toàn Việt Nam');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('option')).toHaveCount(8);
  await expect(page.getByRole('option', { name: /Toàn Việt Nam/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('option', { name: /Lào Cai/ })).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByRole('option', { name: /Toàn Việt Nam/ })).toContainText('Góc nhìn toàn quốc');
  await expect(page.getByRole('option', { name: /Lào Cai/ })).toContainText('Cao độ 3D: pitch');
});

test('choosing a province updates the label, closes the list and marks that option', async ({ page }) => {
  const trigger = await openSelector(page);
  await trigger.click();
  await page.getByRole('option', { name: /Yên Bái/ }).click();
  await expect(current(page)).toHaveText('Yên Bái');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await trigger.click();
  await expect(page.getByRole('option', { name: /Yên Bái/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('option', { name: /Toàn Việt Nam/ })).toHaveAttribute('aria-selected', 'false');
});

test('Escape and a click outside close the list without changing the region', async ({ page }) => {
  const trigger = await openSelector(page);
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await trigger.click();
  await page.mouse.click(5, 450);
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(current(page)).toHaveText('Toàn Việt Nam');
});

test('the reset button returns to the national view', async ({ page }) => {
  const trigger = await openSelector(page);
  await trigger.click();
  await page.getByRole('option', { name: /Sơn La/ }).click();
  await expect(current(page)).toHaveText('Sơn La');
  await page.getByRole('button', { name: 'Về góc nhìn toàn cảnh mặc định (Toàn Việt Nam)' }).click();
  await expect(current(page)).toHaveText('Toàn Việt Nam');
});
