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

test('latest week still lists state transitions', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.panel .intro .state-transitions button').first()).toBeVisible();
});

test('on a phone the current week and the paging controls are on screen', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await page.goto('./#/2026-11-06');
  const tick = page.locator('.week-tick[aria-current="true"]');
  await expect(tick).toBeVisible();
  await expect.poll(async () => {
    const b = await tick.boundingBox();
    return b ? b.x >= 0 && b.x + b.width <= 375 : false;
  }).toBe(true);
  for (const action of ['timeline-older', 'timeline-newer']) {
    const b = await page.locator(`[data-action="${action}"]`).boundingBox();
    expect(b && b.x >= 0 && b.x + b.width <= 375).toBe(true);
  }
  await page.close();
});
