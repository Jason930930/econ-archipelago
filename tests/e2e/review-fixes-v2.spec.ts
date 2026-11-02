import { expect, test, type Page } from '@playwright/test';

type Hook = { ready: boolean; world: () => any; pick: (p: string) => void };
async function ready(page: Page, url = './?test=1#/2026-10-30') {
  await page.goto(url);
  await page.waitForFunction(() => (window as unknown as { __econ?: Hook }).__econ?.ready === true);
}

test('clicking a US district on the canvas selects that district', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => (window as unknown as { __econ: Hook }).__econ.world().flyTo('us/central-bank', 0));
  await page.waitForTimeout(300);
  const at = await page.evaluate(() => (window as unknown as { __econ: Hook }).__econ.world().screenOf('us/central-bank'));
  await page.mouse.click(at.x, at.y);
  await expect.poll(() => page.locator('.panel .breadcrumb button').allTextContents(), { timeout: 10_000 }).toEqual(['美國', '央行']);
});

test('region highlight ring sits on the island', async ({ page }) => {
  await ready(page);
  const r = await page.evaluate(() => {
    const w = (window as unknown as { __econ: Hook }).__econ.world();
    w.highlight(['us']);
    const node = w.graph.get('us');
    let ring: any = null;
    node.object.traverse((o: any) => { if (o.userData.isRing) ring = o; });
    const p = ring.getWorldPosition(ring.position.clone());
    const a = node.anchor();
    return { dx: p.x - a.x, dz: p.z - a.z, visible: ring.visible };
  });
  expect(r.visible).toBe(true);
  expect(Math.hypot(r.dx, r.dz)).toBeLessThan(0.01);
});

test('pulsing a region does not move the island', async ({ page }) => {
  await ready(page);
  const scale = await page.evaluate(async () => {
    const w = (window as unknown as { __econ: Hook }).__econ.world();
    void w.effects.pulse('us', -3);
    await new Promise((r) => setTimeout(r, 400));
    const s = w.graph.get('us').object.scale.x;
    w.effects.clear();
    return s;
  });
  expect(scale).toBe(1);
});
