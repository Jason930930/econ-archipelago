import { expect, test, type Page } from '@playwright/test';

type Hook = {
  ready: boolean;
  world: () => { channelScreenPoint: (id: string, t?: number) => { x: number; y: number } | null } | null;
  pickChannel: (id: string) => void;
};
const hook = (page: Page) => page.evaluate.bind(page);
const NOTE = '方向與強度為教科書層級的定性判斷，不是量化模型或預測。';

async function ready(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('.stage canvas')).toBeVisible();
  await page.waitForFunction(() => {
    const h = (window as unknown as { __econ?: Hook }).__econ;
    return h?.ready === true && h.world() != null;
  });
}

test.beforeEach(async ({ page }) => {
  // 網絡模式偏好存在 localStorage；每個測試從關閉開始。
  await page.addInitScript(() => {
    try { localStorage.removeItem('econ-archipelago:network'); } catch { /* ignore */ }
  });
});

test('network toggle shows the legend', async ({ page }) => {
  await ready(page, './?test=1#/2026-10-30');
  const btn = page.locator('[data-action=network]');
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.channel-legend')).toBeHidden();
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.channel-legend')).toBeVisible();
  await expect(page.locator('.channel-legend')).toContainText('能源與通膨');
  await btn.click();
  await expect(page.locator('.channel-legend')).toBeHidden();
});

test('picking a channel opens its panel', async ({ page }) => {
  await ready(page, './?test=1#/2026-10-30');
  await hook(page)(() => (window as unknown as { __econ: Hook }).__econ.pickChannel('oil-to-us-inflation'));
  const panel = page.locator('.panel .channel-panel');
  await expect(panel).toHaveAttribute('data-channel', 'oil-to-us-inflation');
  await expect(panel).toContainText('汽油與運輸成本');
  await expect(panel).toContainText(NOTE);
  await expect(panel).toContainText('持續活躍 3 週');
});

test('clicking a lit pipe opens its panel', async ({ page }) => {
  await ready(page, './?test=1#/2026-10-30');
  const panel = page.locator('.panel .channel-panel');
  let opened = false;
  // 管線中段可能被島嶼或其他亮管擋住，沿管線取幾個點，只要有一點點得到就算通過。
  for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
    const pt = await hook(page)((u) => (window as unknown as { __econ: Hook }).__econ.world()!.channelScreenPoint('oil-to-us-inflation', u), t);
    if (!pt) continue;
    const onCanvas = await hook(page)(({ x, y }) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', pt);
    if (!onCanvas) continue;
    await page.mouse.click(pt.x, pt.y);
    if ((await panel.count()) > 0 && (await panel.getAttribute('data-channel')) === 'oil-to-us-inflation') {
      opened = true;
      break;
    }
  }
  expect(opened).toBe(true);
});

test('story panel lists lit channels', async ({ page }) => {
  await ready(page, './?test=1#/2026-10-30');
  const active = page.locator('.panel .active-channels');
  await expect(active.locator('[data-channel="oil-to-us-inflation"]')).toBeVisible();
  await active.locator('[data-channel="hormuz-to-oil"]').click();
  await expect(page.locator('.panel .channel-panel')).toHaveAttribute('data-channel', 'hormuz-to-oil');
});

test('channel history jumps to an earlier week', async ({ page }) => {
  await ready(page, './?test=1#/2026-10-30');
  await hook(page)(() => (window as unknown as { __econ: Hook }).__econ.pickChannel('oil-to-us-inflation'));
  await page.locator('.panel .channel-panel [data-week-id="2026-10-16"]').click();
  await expect(page.locator('.week-title')).toContainText('2026/10/16');
});

test('text mode lists lit channels', async ({ page }) => {
  await page.goto('./#/2026-10-30');
  await page.locator('[data-action=text-mode]').click();
  const sec = page.locator('.text-mode .text-channels');
  await expect(sec).toContainText('油價 → 美國通膨');
  await expect(page.locator('[data-action=network]')).toBeHidden();
});

test('playing 10/30 along pipes reaches the finale without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?fast=1#/2026-10-30');
  await page.locator('[data-action=network]').click();
  await page.locator('[data-action=play]').click();
  await expect(page.locator('.panel .finale')).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('synthetic proposal is listed for review', async ({ page, request }) => {
  const idx = (await (await request.get('data/index.json')).json()) as { channels: { proposals: { id: string }[] } };
  test.skip(!idx.channels.proposals.some((p) => p.id === 'synthetic-proposal'), '只在 CI 演練（含合成週）時執行');
  await ready(page, './?test=1');
  await page.locator('[data-action=network]').click();
  await page.locator('.channel-legend .proposal-count').click();
  await page.locator('.panel .proposal-list [data-proposal="synthetic-proposal"]').click();
  await expect(page.locator('.panel .proposal-panel')).toContainText('待審提議：不參與推演');
});
