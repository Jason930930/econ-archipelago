import type { APIRequestContext, Page } from '@playwright/test';

/** 從實際部署的索引讀最新一週，讓測試不綁死某一週的資料。 */
export async function latest(request: APIRequestContext) {
  const idx = (await (await request.get('data/index.json')).json()) as { weeks: { weekId: string; title: string }[] };
  const w = idx.weeks[idx.weeks.length - 1]!;
  const week = (await (await request.get(`data/weeks/${w.weekId}.json`)).json()) as { events: unknown[] };
  return { ...w, eventCount: week.events.length };
}

/** 模擬不支援 WebGL；keepWebGL1 = 只拿掉 WebGL2。 */
export async function noWebGL(page: Page, keepWebGL1 = false) {
  await page.addInitScript((keep) => {
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: (type: string, ...rest: unknown[]) => unknown };
    const orig = proto.getContext;
    proto.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === 'webgl2' || (!keep && /webgl/.test(type))) return null;
      return orig.call(this, type, ...rest);
    };
  }, keepWebGL1);
}
