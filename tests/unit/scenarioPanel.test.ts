// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildIndex } from '../../src/data/buildIndex';
import type { FredFile } from '../../src/data/fredFile';
import type { WeekData } from '../../src/data/types';
import { pathText, renderScenarioPicker, renderScenarioResult, renderScenarioText } from '../../src/ui/scenarioPanel';
import { renderStateCard, statesFor } from '../../src/ui/stateCard';
import { runScenario, SCENARIO_NOTE, type ScenarioResult } from '../../src/world/scenario';
import type { EntityRecord } from '../../src/world/registry';

const load = (id: string) => JSON.parse(readFileSync(`data/weeks/${id}.json`, 'utf8')) as WeekData;
const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];
const fred = JSON.parse(readFileSync('data/state/fred.json', 'utf8')) as FredFile;
const weeks = ['2026-10-16', '2026-10-23', '2026-10-30'].map(load);
const index = buildIndex(weeks, seed, fred);
const states = statesFor('2026-10-30', index);
const oil = runScenario({ node: 'gulf.oil-price', direction: 1 }, states);

function captured(node: HTMLElement) {
  const got: { type: string; detail: unknown }[] = [];
  for (const type of ['start-scenario', 'replay-scenario', 'end-scenario', 'select-node']) node.addEventListener(type, (e) => got.push({ type, detail: (e as CustomEvent).detail }));
  return got;
}

describe('picker', () => {
  test('lists 36 nodes; choosing one offers both directions', () => {
    const p = renderScenarioPicker(states, index);
    const got = captured(p);
    expect(p.querySelectorAll('[data-node]')).toHaveLength(36);
    expect(p.querySelector('[data-direction]')).toBeNull();
    p.querySelector<HTMLButtonElement>('[data-node="us.policy-rate"]')!.click();
    expect(p.querySelector('[data-node="us.policy-rate"]')!.getAttribute('aria-pressed')).toBe('true');
    p.querySelector<HTMLButtonElement>('[data-direction="down"]')!.click();
    expect(got).toEqual([{ type: 'start-scenario', detail: { node: 'us.policy-rate', direction: -1 } }]);
  });
});

describe('result', () => {
  test('title, note, Taiwan first, then three waves', () => {
    const r = renderScenarioResult(oil, index);
    expect(r.querySelector('h3')!.textContent).toBe('情境：油價 ↑');
    expect(r.textContent).toContain(SCENARIO_NOTE);
    const sections = [...r.querySelectorAll('section')].map((s) => s.className);
    expect(sections[0]).toContain('scenario-taiwan');
    expect([...r.querySelectorAll('.scenario-wave h4')].map((h) => h.textContent)).toEqual(['數週', '數月']);
    expect(r.querySelectorAll('.scenario-wave [data-node]')).toHaveLength(oil.effects.length);
  });
  test('why line spells the path with directions', () => {
    expect(pathText(oil.shock, ['oil-to-us-inflation', 'us-inflation-to-fed'])).toBe('油價 ↑ → 美國通膨 ↑ → Fed 政策利率 ↑');
    expect(pathText({ node: 'us.long-yield', direction: 1 }, ['us-yield-to-tech'])).toBe('美債長天期殖利率 ↑ → 美國科技股估值 ↓');
    const r = renderScenarioResult(oil, index);
    expect(r.querySelector('.scenario-wave [data-node="us.inflation"]')!.textContent).toContain('油價 ↑ → 美國通膨 ↑');
  });
  test('comparison and extreme wording', () => {
    const fake: ScenarioResult = { shock: oil.shock, taiwan: [], effects: [
      { node: 'us.inflation', direction: 1, weight: 1, strength: 'strong', wave: 2, path: ['oil-to-us-inflation'], vsCurrent: 'same', extreme: 'high' },
      { node: 'us.policy-rate', direction: -1, weight: 0.3, strength: 'medium', wave: 3, path: ['oil-to-us-inflation', 'us-inflation-to-fed'], vsCurrent: 'opposite' },
    ] };
    const t = renderScenarioResult(fake, index).textContent!;
    expect(t).toContain('與目前趨勢一致（加劇）');
    expect(t).toContain('與目前趨勢相反（可能反轉）');
    expect(t).toContain('已在 5 年高檔');
    expect(t).toContain('這個衝擊沒有傳到台灣的節點');
  });
  test('divergent effect shows both paths', () => {
    const fake: ScenarioResult = { shock: oil.shock, taiwan: [], effects: [
      { node: 'us.inflation', direction: null, weight: 1, strength: 'strong', wave: 2, path: ['oil-to-us-inflation'], counterPath: ['oil-to-eu-energy'], vsCurrent: 'none' },
    ] };
    const row = renderScenarioResult(fake, index).querySelector('.scenario-wave [data-node="us.inflation"]')!;
    expect(row.textContent).toContain('方向分歧 ⇅');
    expect(row.querySelectorAll('.scenario-why')).toHaveLength(2);
  });
  test('empty result message', () => {
    const r = renderScenarioResult(runScenario({ node: 'tw.equity', direction: 1 }, states), index);
    expect(r.textContent).toContain('這個節點目前沒有可往外傳導的管道');
  });
  test('buttons and row clicks', () => {
    const r = renderScenarioResult(oil, index);
    const got = captured(r);
    r.querySelector<HTMLButtonElement>('[data-action="replay-scenario"]')!.click();
    r.querySelector<HTMLButtonElement>('[data-action="end-scenario"]')!.click();
    r.querySelector<HTMLButtonElement>('.scenario-wave [data-node="us.inflation"] button')!.click();
    expect(got).toEqual([
      { type: 'replay-scenario', detail: null },
      { type: 'end-scenario', detail: null },
      { type: 'select-node', detail: { path: 'us' } },
    ]);
  });
  test('text mode version', () => {
    const t = renderScenarioText(oil, index);
    expect(t.classList.contains('text-scenario')).toBe(true);
    expect(t.textContent).toContain('情境：油價 ↑');
    expect(t.textContent).toContain('數月');
    expect(t.textContent).toContain(SCENARIO_NOTE);
  });
});

describe('state card', () => {
  test('offers both what-if buttons', () => {
    const c = renderStateCard('us.long-yield', states['us.long-yield']!, index);
    const got = captured(c);
    c.querySelector<HTMLButtonElement>('[data-scenario="up"]')!.click();
    c.querySelector<HTMLButtonElement>('[data-scenario="down"]')!.click();
    expect(got).toEqual([
      { type: 'start-scenario', detail: { node: 'us.long-yield', direction: 1 } },
      { type: 'start-scenario', detail: { node: 'us.long-yield', direction: -1 } },
    ]);
  });
});

describe('review fixes', () => {
  test('direction buttons appear right under the chosen row', () => {
    const p = renderScenarioPicker(states, index);
    p.querySelector<HTMLButtonElement>('[data-node="tw.twd"]')!.click();
    const li = p.querySelector('[data-node="tw.twd"]')!.closest('li')!;
    expect(li.querySelector('[data-direction="up"]')).not.toBeNull();
    expect(li.querySelector('[data-direction="down"]')).not.toBeNull();
    p.querySelector<HTMLButtonElement>('[data-node="gulf.oil-price"]')!.click();
    expect(li.querySelector('[data-direction="up"]')).toBeNull();
    expect(p.querySelectorAll('[data-direction="up"]')).toHaveLength(1);
  });
  test('each why step carries its channel mechanism as a tooltip', () => {
    const r = renderScenarioResult(oil, index);
    const step = r.querySelector('.scenario-wave [data-node="us.inflation"] .scenario-why [title]')!;
    expect(step.getAttribute('title')).toContain('汽油與運輸成本');
    expect(r.querySelector('.scenario-wave [data-node="us.inflation"] .scenario-why')!.textContent).toBe('為什麼：油價 ↑ → 美國通膨 ↑');
  });
  test('text mode section can end the scenario', () => {
    const t = renderScenarioText(oil, index);
    const got = captured(t);
    t.querySelector<HTMLButtonElement>('[data-action="end-scenario"]')!.click();
    expect(got).toEqual([{ type: 'end-scenario', detail: null }]);
  });
});
