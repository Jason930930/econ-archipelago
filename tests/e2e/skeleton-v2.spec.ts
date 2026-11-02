import { expect, test, type Page } from '@playwright/test';

const LEGEND = '島嶼大小約與 GDP 成正比（約略值）；為避免重疊，相鄰島嶼位置略有偏移。';

async function ready(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('.stage canvas')).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __econ?: { ready: boolean; world: () => unknown } }).__econ?.ready === true && (window as unknown as { __econ: { world: () => unknown } }).__econ.world() != null);
}

const pick = (page: Page, path: string) => page.evaluate((p) => (window as unknown as { __econ: { pick: (p: string) => void } }).__econ.pick(p), path);
const crumbs = (page: Page) => page.locator('.panel .breadcrumb button').allTextContents();

test('clicking TSMC selects its path', async ({ page }) => {
  await ready(page, './?test=1#/2026-10-30');
  await pick(page, 'tw/semiconductor/tsmc');
  await expect.poll(() => crumbs(page), { timeout: 10_000 }).toEqual(['台灣', '半導體', '台積電']);
});

test('region panel lists the TSMC event', async ({ page }) => {
  await ready(page, './?test=1#/2026-10-16');
  await pick(page, 'tw');
  await expect(page.locator('.panel .node-panel')).toContainText('台積電法說');
});

test('breadcrumb navigates up a level', async ({ page }) => {
  await ready(page, './?test=1#/2026-10-30');
  await pick(page, 'tw/semiconductor/tsmc');
  await page.locator('.panel .breadcrumb button', { hasText: '半導體' }).click();
  await expect.poll(() => crumbs(page), { timeout: 10_000 }).toEqual(['台灣', '半導體']);
});

test('region-level event plays', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/data/weeks/2026-10-30.json', async (route) => {
    const res = await route.fetch();
    const w = await res.json();
    const e = w.events.find((x: { rank: number }) => x.rank === 3);
    e.primary = 'us';
    e.places = ['us', ...e.places];
    await route.fulfill({ response: res, json: w });
  });
  await page.goto('./?fast=1#/2026-10-30');
  await page.locator('[data-action=play]').click();
  await expect(page.locator('.panel .finale')).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('legend is visible', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.world-legend')).toHaveText(LEGEND);
});

test('mobile starts on Asia-Pacific', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await ready(page, './?test=1');
  const [x, z] = (await page.evaluate(() => (window as unknown as { __econ: { cameraTarget: () => [number, number] } }).__econ.cameraTarget()))!;
  // 台灣錨點 project(23.7, 121) ≈ (−8.4, −6.9)
  expect(Math.abs(x - -8.41)).toBeLessThanOrEqual(6);
  expect(Math.abs(z - -6.87)).toBeLessThanOrEqual(6);
  await page.close();
});

test('synthetic entity and new district appear', async ({ page, request }) => {
  const registry = (await (await request.get('data/registry.json')).json()) as { id: string }[];
  test.skip(!registry.some((e) => e.id === 'synthetic-co'), '只在 CI 演練（含合成週）時執行');
  await ready(page, './?test=1');
  await pick(page, 'in/tech/synthetic-co');
  await expect.poll(() => crumbs(page), { timeout: 10_000 }).toEqual(['印度', '科技', '演練公司']);
  const hasDistrict = await page.evaluate(() => (window as unknown as { __econ: { world: () => { graph: { get: (p: string) => unknown } } } }).__econ.world().graph.get('jp/real-estate') !== undefined);
  expect(hasDistrict).toBe(true);
});
