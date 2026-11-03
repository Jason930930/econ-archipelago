import { expect, test, type Page } from '@playwright/test';

type Hook = {
  ready: boolean;
  world: () => { focusAsiaPacific: (ms?: number) => Promise<void> } | null;
  cameraTarget: () => [number, number] | null;
  nodeState: (id: string) => { basis: string | null } | null;
};
const hook = <T,>(page: Page, fn: (h: Hook) => T | Promise<T>) => page.evaluate(`(${fn.toString()})(window.__econ)`) as Promise<T>;

async function ready(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('.stage canvas')).toBeVisible();
  await page.waitForFunction(() => {
    const h = (window as unknown as { __econ?: Hook }).__econ;
    return h?.ready === true && h.world() != null;
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.removeItem('econ-archipelago:network'); } catch { /* ignore */ }
  });
});

test('region badges show at world zoom, district badges after zooming in', async ({ page }) => {
  await ready(page, './?test=1#/2026-10-30');
  await expect(page.locator('.state-badge[data-node="us.inflation"]')).toBeVisible();
  await expect(page.locator('.state-badge[data-node="tw.foreign-flow"]')).toBeHidden();
  await hook(page, (h) => h.world()!.focusAsiaPacific(0));
  const badge = page.locator('.state-badge[data-node="tw.foreign-flow"]');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute('aria-label', /外資買賣超：低/);
  await badge.click();
  await expect(page.locator('.panel .node-states .state-card[data-node="tw.foreign-flow"]')).toContainText('外資賣超約 815.82 億元');
});

test('world state overview lists 36 nodes and a row flies to its node', async ({ page }) => {
  await ready(page, './?test=1#/2026-10-30');
  await page.locator('[data-action=state]').click();
  const rows = page.locator('.panel .world-state [data-node]');
  await expect(rows).toHaveCount(36);
  await expect(page.locator('.panel .world-state')).toContainText('部分數據來自 FRED');
  await page.locator('.panel .world-state [data-node="tw.twd"]').click();
  await expect(page.locator('.panel .node-states .state-card[data-node="tw.twd"]')).toContainText('數值越高新台幣越弱');
  // 台灣錨點 project(23.7, 121) ≈ (−8.4, −6.9)
  await expect.poll(async () => {
    const t = await hook(page, (h) => h.cameraTarget());
    return t ? Math.hypot(t[0] + 8.41, t[1] + 6.87) : 99;
  }, { timeout: 10_000 }).toBeLessThan(6);
});

test('older weeks show that Friday\'s state', async ({ page }) => {
  await ready(page, './?test=1#/2026-10-16');
  await page.locator('[data-action=state]').click();
  await expect(page.locator('.panel .world-state [data-node="tw.tsmc"]')).toContainText('高');
});

test('text mode lists world state', async ({ page }) => {
  await page.goto('./#/2026-10-30');
  await page.locator('[data-action=text-mode]').click();
  await expect(page.locator('.text-mode .text-world-state li')).toHaveCount(36);
  await expect(page.locator('[data-action=state]')).toBeHidden();
});

test('synthetic rehearsal node state reaches the card', async ({ page, request }) => {
  const idx = (await (await request.get('data/index.json')).json()) as { weeks: { weekId: string }[] };
  const last = idx.weeks.at(-1)!.weekId;
  const week = (await (await request.get(`data/weeks/${last}.json`)).json()) as { nodeStates?: { node: string; basis: string }[] };
  const st = week.nodeStates?.find((n) => n.basis === '演練用狀態');
  test.skip(!st, '只在 CI 演練（含合成週）時執行');
  await ready(page, './?test=1');
  const basis = await page.evaluate((id) => (window as unknown as { __econ: Hook }).__econ.nodeState(id)?.basis ?? null, st!.node);
  expect(basis).toBe('演練用狀態');
});
