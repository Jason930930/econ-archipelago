import { expect, test } from '@playwright/test';
import { latest } from './helpers';

test('opening the site loads the latest week\'s derived data', async ({ page, request }) => {
  const w = await latest(request);
  const req = page.waitForRequest((r) => r.url().endsWith(`data/derived/${w.weekId}.json`));
  await page.goto('./');
  await req;
  // 衍生資料填回後，世界狀態才有節點狀態
  await page.locator('[data-action=state]').click();
  await expect(page.locator('.panel .world-state [data-node]')).toHaveCount(36);
});

test('derived requested for each visited week', async ({ page }) => {
  await page.goto('./#/2026-10-30');
  await expect(page.locator('.week-title')).toContainText('2026/10/30');
  const req = page.waitForRequest((r) => r.url().endsWith('data/derived/2026-10-16.json'));
  await page.locator('.week-tick[data-week="2026-10-16"]').click();
  await req;
  await expect(page.locator('.week-title')).toContainText('2026/10/16');
  await page.locator('[data-action=state]').click();
  await expect(page.locator('.panel .world-state [data-node="tw.tsmc"]')).toContainText('高');
});

test('derived failure shows the load error', async ({ page }) => {
  await page.route('**/data/derived/2026-10-16.json', (route) => route.fulfill({ status: 404, body: 'nope' }));
  await page.goto('./#/2026-10-30');
  await expect(page.locator('.week-title')).toContainText('2026/10/30');
  await page.locator('.week-tick[data-week="2026-10-16"]').click();
  await expect(page.locator('.toast')).toContainText('這一週的資料載入失敗');
  await expect(page.locator('.week-title')).toContainText('2026/10/30');
});
