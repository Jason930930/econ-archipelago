import { expect, test, type Page } from '@playwright/test';

type Hook = { ready: boolean; world: () => unknown; scenario: () => { effects: unknown[] } | null };

async function ready(page: Page, url: string) {
  await page.goto(url);
  await page.waitForFunction(() => {
    const h = (window as unknown as { __econ?: Hook }).__econ;
    return h?.ready === true && h.world() != null;
  });
}
const effectCount = (page: Page) => page.evaluate(() => (window as unknown as { __econ: Hook }).__econ.scenario()?.effects.length ?? -1);

test('start from the top bar: result panel and forecast markers', async ({ page }) => {
  await ready(page, './?test=1&fast=1#/2026-10-30');
  await page.locator('[data-action=what-if]').click();
  await page.locator('.panel .scenario-picker [data-node="gulf.oil-price"]').click();
  await page.locator('.panel .scenario-picker [data-direction="up"]').click();
  const result = page.locator('.panel .scenario-result');
  await expect(result.locator('h3')).toHaveText('情境：油價 ↑');
  await expect(result.locator('.scenario-taiwan')).toContainText('對台灣');
  await expect(result).toContainText('油價 ↑ → 美國通膨 ↑');
  const n = await effectCount(page);
  await expect(page.locator('.forecast-marker')).toHaveCount(n, { timeout: 30_000 });
  await expect(page).toHaveURL(/#\/2026-10-30\/what-if\/gulf\.oil-price\/up$/);
});

test('start from a state card', async ({ page }) => {
  await ready(page, './?test=1&fast=1#/2026-10-30');
  await page.evaluate(() => (window as unknown as { __econ: { pick: (p: string) => void } }).__econ.pick('us/bonds'));
  await page.locator('.panel .state-card[data-node="us.long-yield"] [data-scenario="up"]').click();
  await expect(page.locator('.panel .scenario-result h3')).toHaveText('情境：美債長天期殖利率 ↑');
});

test('shared link opens the scenario directly', async ({ page }) => {
  await ready(page, './?test=1&fast=1#/2026-10-23/what-if/us.policy-rate/down');
  await expect(page.locator('.panel .scenario-result h3')).toHaveText('情境：Fed 政策利率 ↓');
  await expect(page.locator('.week-title')).toContainText('2026/10/23');
});

test('invalid shared link falls back with a toast', async ({ page }) => {
  await ready(page, './?test=1#/2026-10-23/what-if/nope/up');
  await expect(page.locator('.toast')).toBeVisible();
  await expect(page.locator('.panel .scenario-result')).toHaveCount(0);
});

test('scenario survives week change', async ({ page }) => {
  await ready(page, './?test=1&fast=1#/2026-10-30/what-if/gulf.oil-price/up');
  await page.locator('.week-tick[data-week="2026-10-23"]').click();
  await expect(page.locator('.week-title')).toContainText('2026/10/23');
  await expect(page.locator('.panel .scenario-result h3')).toHaveText('情境：油價 ↑');
  await expect(page).toHaveURL(/#\/2026-10-23\/what-if\/gulf\.oil-price\/up$/);
});

test('play ends the scenario', async ({ page }) => {
  await ready(page, './?test=1&fast=1#/2026-10-30/what-if/gulf.oil-price/up');
  await page.locator('[data-action=play]').click();
  await expect(page.locator('.forecast-marker')).toHaveCount(0);
  expect(await effectCount(page)).toBe(-1);
  await expect(page.locator('.panel .finale')).toBeVisible({ timeout: 30_000 });
});

test('Esc ends the scenario and brings badges back', async ({ page }) => {
  await ready(page, './?test=1&fast=1#/2026-10-30/what-if/us.policy-rate/up');
  await expect(page.locator('.forecast-marker').first()).toBeAttached({ timeout: 30_000 });
  await expect(page.locator('.state-badge[data-node="us.inflation"]')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('.forecast-marker')).toHaveCount(0);
  await expect(page.locator('.state-badge[data-node="us.inflation"]')).toBeVisible();
  await expect(page.locator('.panel .intro')).toBeVisible();
  await expect(page).toHaveURL(/#\/2026-10-30$/);
});

test('text mode lists the scenario', async ({ page }) => {
  await page.goto('./#/2026-10-30');
  await page.locator('[data-action=text-mode]').click();
  await page.locator('[data-action=what-if]').click();
  await page.locator('.text-root .scenario-picker [data-node="gulf.oil-price"]').click();
  await page.locator('.text-root .scenario-picker [data-direction="down"]').click();
  await expect(page.locator('.text-mode .text-scenario')).toContainText('情境：油價 ↓');
  await expect(page.locator('.text-mode .text-scenario')).toContainText('數月');
});
