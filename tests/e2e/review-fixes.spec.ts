import { expect, test } from '@playwright/test';
import { latest, noWebGL } from './helpers';

test('default view shows whatever the latest week is', async ({ page, request }) => {
  const w = await latest(request);
  await page.goto('./');
  await expect(page.locator('.week-title')).toHaveText(w.title);
});

test('WebGL1-only browser falls back to text mode', async ({ page }) => {
  await noWebGL(page, true);
  await page.goto('./#/2026-10-30');
  await expect(page.locator('.text-mode .event-card')).toHaveCount(5);
});

for (const delay of [2800, 3100, 3400, 3700, 4000]) {
  test(`taiwan-impact label does not leak into another week (switch at ${delay}ms)`, async ({ page }) => {
    await page.goto('./#/2026-10-30/e1');
    await expect(page.locator('.panel .event-card')).toBeVisible();
    await page.waitForTimeout(delay);
    await page.locator('.week-tick[data-week="2026-10-23"]').click();
    await page.waitForTimeout(2500);
    await expect(page.locator('.fx-ripple')).toHaveCount(0);
  });
}

test('clicking the current week while playing stops playback cleanly', async ({ page, request }) => {
  const w = await latest(request);
  await page.goto('./');
  await page.locator('[data-action=play]').click();
  await page.waitForTimeout(500);
  await page.locator(`.week-tick[data-week="${w.weekId}"]`).click();
  await expect(page.locator('[data-action=play]')).toHaveText('▶ 播放');
});

test('the last clicked week wins even if an earlier load is slower', async ({ page }) => {
  await page.route('**/data/weeks/2026-10-16.json', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto('./');
  await page.locator('.week-tick[data-week="2026-10-16"]').click();
  await page.locator('.week-tick[data-week="2026-10-23"]').click();
  await page.waitForTimeout(2500);
  await expect(page.locator('.week-title')).toContainText('2026/10/17');
  await expect(page).toHaveURL(/#\/2026-10-23$/);
});

test('text mode content is not hidden behind the bottom bar', async ({ page }) => {
  await noWebGL(page);
  await page.goto('./#/2026-10-30');
  await expect(page.locator('.text-mode .event-card')).toHaveCount(5);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const last = await page.locator('.text-mode > :last-child').boundingBox();
  const bar = await page.locator('.bottombar').boundingBox();
  expect(last!.y + last!.height).toBeLessThanOrEqual(bar!.y);
});

test('a long unbroken token does not cause horizontal scroll', async ({ page }) => {
  await noWebGL(page);
  await page.route('**/data/weeks/2026-10-30.json', async (route) => {
    const res = await route.fetch();
    const w = await res.json();
    w.events[0].title = 'X'.repeat(300);
    w.events[0].what = `https://example.com/${'a'.repeat(300)}`;
    await route.fulfill({ response: res, json: w });
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./#/2026-10-30');
  await expect(page.locator('.text-mode .event-card')).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('leaving text mode clears the previous week\'s effects', async ({ page }) => {
  await page.goto('./?fast=1#/2026-10-30');
  await page.locator('[data-action=play]').click();
  await expect(page.locator('.panel .finale')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.fx-flag').first()).toBeAttached();
  await page.locator('[data-action=text-mode]').click();
  await page.locator('.week-tick[data-week="2026-10-23"]').click();
  await page.locator('[data-action=text-mode]').click();
  await expect(page.locator('.fx-label')).toHaveCount(0);
});

test('pressing play while the week is still loading is not swallowed', async ({ page }) => {
  await page.route('**/data/weeks/2026-10-30.json', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto('./?fast=1#/2026-10-30');
  await page.locator('[data-action=play]').click();
  await expect(page.locator('.panel .finale')).toBeVisible({ timeout: 30_000 });
});
