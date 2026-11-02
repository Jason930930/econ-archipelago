import { expect, test } from '@playwright/test';

const DISCLAIMER = '僅為資訊整理，不構成任何買賣或個人化投資建議。';

test('loads world', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  const canvas = page.locator('.stage canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);
  await expect(page.locator('.disclaimer')).toHaveText(DISCLAIMER);
  await expect(page.locator('.week-title')).toContainText('2026/10/24');
  expect(errors).toEqual([]);
});

test('switches week', async ({ page }) => {
  await page.goto('./');
  await page.locator('.week-tick').first().click();
  await expect(page.locator('.week-title')).toContainText('2026/10/10');
  await expect(page).toHaveURL(/#\/2026-10-16$/);
});

test('plays to finale', async ({ page }) => {
  await page.goto('./?fast=1');
  await page.locator('[data-action=play]').click();
  await expect(page.locator('.panel .event-card')).toBeVisible();
  await expect(page.locator('.panel .finale')).toContainText('下週值得關注', { timeout: 30_000 });
  await expect(page.locator('[data-action=play]')).toHaveText('▶ 播放');
});

test('deep link', async ({ page }) => {
  await page.goto('./#/2026-10-30/e3');
  await expect(page.locator('.panel .event-card h3')).toHaveText('荷莫茲海峽緊張，油價維持高檔、黃金跌破 4,000 美元');
});

test('invalid deep link', async ({ page }) => {
  await page.goto('./#/2099-01-01/e1');
  await expect(page.locator('.toast')).toContainText('找不到該連結');
  await expect(page.locator('.week-title')).toContainText('2026/10/24');
});

test('storyline jump opens the event in its week', async ({ page }) => {
  await page.goto('./');
  await page.locator('.lane-dot').first().click();
  await expect(page.locator('.week-title')).toContainText('2026/10/10');
  await expect(page.locator('.panel .event-card')).toBeVisible();
});

test('falls back to text mode without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: (type: string, ...rest: unknown[]) => unknown };
    const orig = proto.getContext;
    proto.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (/webgl/.test(type)) return null;
      return orig.call(this, type, ...rest);
    };
  });
  await page.goto('./');
  await expect(page.locator('.text-mode .event-card')).toHaveCount(5);
  await expect(page.locator('.stage')).toBeHidden();
  await expect(page.locator('[data-action=text-mode]')).toBeDisabled();
});

test('no horizontal scroll on mobile', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await page.goto('./#/2026-10-30/e1');
  await expect(page.locator('.panel .event-card')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.close();
});
