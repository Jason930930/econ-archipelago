// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildIndex } from '../../src/data/buildIndex';
import type { FredFile } from '../../src/data/fredFile';
import type { WeekData } from '../../src/data/types';
import { renderChannelPanel } from '../../src/ui/channelPanel';
import { renderNodePanel } from '../../src/ui/nodePanel';
import { FRED_NOTE, renderStateCard, renderTransitions, renderWorldState, STATE_NOTE, statesFor } from '../../src/ui/stateCard';
import { renderTextMode } from '../../src/ui/textMode';
import { orderEvents } from '../../src/story/order';
import { stateTransitions } from '../../src/world/state';
import type { EntityRecord } from '../../src/world/registry';

const load = (id: string) => JSON.parse(readFileSync(`data/weeks/${id}.json`, 'utf8')) as WeekData;
const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];
const fred = JSON.parse(readFileSync('data/state/fred.json', 'utf8')) as FredFile;
const weeks = ['2026-10-16', '2026-10-23', '2026-10-30'].map(load);
const latest = weeks[2]!;
const index = buildIndex(weeks, seed, fred);
const states = statesFor(latest.weekId, index);

function captured(node: HTMLElement) {
  const got: { type: string; detail: unknown }[] = [];
  for (const type of ['select-node', 'select-event', 'select-week']) node.addEventListener(type, (e) => got.push({ type, detail: (e as CustomEvent).detail }));
  return got;
}

describe('statesFor', () => {
  test('latest week uses latest, older weeks use byWeek', () => {
    expect(statesFor('2026-10-30', index)).toBe(index.state.latest);
    expect(statesFor('2026-10-23', index)).toBe(index.state.byWeek['2026-10-23']);
  });
});

describe('renderStateCard', () => {
  test('numeric FRED card', () => {
    const c = renderStateCard('us.long-yield', states['us.long-yield']!, index);
    const t = c.textContent!;
    expect(t).toContain('美債長天期殖利率');
    expect(t).toContain(`${fred.series.DGS10!.latest[1]}%`);
    expect(t).toMatch(/第 \d+ 百分位/);
    expect(t).toContain(STATE_NOTE);
    expect(STATE_NOTE).toBe('高／中／低為相對過去 5 年的位置，不代表好壞，也不是預測。');
    const a = c.querySelector<HTMLAnchorElement>('a.state-source')!;
    expect(a.href).toBe('https://fred.stlouisfed.org/series/DGS10');
    expect(a.rel).toContain('noopener');
    expect(c.querySelector('svg.state-spark')).not.toBeNull();
  });
  test('inverted series carries its note', () => {
    expect(renderStateCard('jp.yen', states['jp.yen']!, index).textContent).toContain('數值越高日圓越弱');
  });
  test('qualitative card shows basis, carried age and a week link', () => {
    const c = renderStateCard('tw.foreign-flow', states['tw.foreign-flow']!, index, { weekId: latest.weekId });
    const got = captured(c);
    expect(c.textContent).toContain('外資賣超約 815.82 億元');
    expect(c.textContent).toContain('沿用 1 週前');
    c.querySelector<HTMLButtonElement>('[data-week-id="2026-10-23"]')!.click();
    expect(got).toEqual([{ type: 'select-week', detail: { weekId: '2026-10-23' } }]);
  });
  test('this week\'s qualitative evidence opens the event', () => {
    const c = renderStateCard('seas.hormuz-risk', states['seas.hormuz-risk']!, index, { weekId: latest.weekId });
    const got = captured(c);
    c.querySelector<HTMLButtonElement>('[data-event-id="e3"]')!.click();
    expect(got).toEqual([{ type: 'select-event', detail: { eventId: 'e3' } }]);
  });
  test('unknown node says so', () => {
    expect(renderStateCard('tw.strait-risk', states['tw.strait-risk']!, index).textContent).toContain('尚無資料');
  });
  test('basis renders as text', () => {
    const evil = { ...states['tw.foreign-flow']!, basis: '<img src=x onerror="alert(1)">' };
    const c = renderStateCard('tw.foreign-flow', evil, index);
    expect(c.querySelector('img')).toBeNull();
    expect(c.textContent).toContain('<img src=x');
  });
});

describe('renderWorldState', () => {
  const w = renderWorldState(states, index);
  test('36 rows and a summary that adds up', () => {
    expect(w.querySelectorAll('[data-node]')).toHaveLength(36);
    const nums = [...w.querySelector('.state-summary')!.textContent!.matchAll(/(\d+)/g)].map((m) => Number(m[1]));
    expect(nums.reduce((a, b) => a + b, 0)).toBe(36);
    expect(w.textContent).toContain(FRED_NOTE);
    expect(FRED_NOTE).toBe('部分數據來自 FRED（聖路易聯邦準備銀行），各指數版權屬原提供者。');
  });
  test('row click selects the node path', () => {
    const got = captured(w);
    w.querySelector<HTMLButtonElement>('[data-node="tw.twd"]')!.click();
    expect(got).toEqual([{ type: 'select-node', detail: { path: 'tw/fx' } }]);
  });
});

describe('renderTransitions', () => {
  test('lists changes with Chinese wording', () => {
    const list = stateTransitions(index.state.byWeek['2026-10-23']!, states);
    const el = renderTransitions(list, index);
    if (list.length === 0) expect(el).toBeNull();
    else expect(el!.querySelectorAll('button')).toHaveLength(list.length);
    const fake = renderTransitions([{ node: 'jp.yen', kind: 'level', from: 'mid', to: 'low' }, { node: 'intl.risk-appetite', kind: 'direction', from: '1', to: '-1' }], index)!;
    expect(fake.textContent).toContain('日圓強弱 中 → 低');
    expect(fake.textContent).toContain('全球風險偏好 方向轉 ↓');
  });
});

describe('panels', () => {
  test('node panel for tw lists the 7 Taiwan nodes compactly', () => {
    const p = renderNodePanel('tw', latest, index);
    expect(p.querySelectorAll('.node-states [data-node]')).toHaveLength(7);
  });
  test('district panel shows full cards', () => {
    const p = renderNodePanel('us/bonds', latest, index);
    expect(p.querySelector('.node-states .state-card[data-node="us.long-yield"]')).not.toBeNull();
  });
  test('channel panel shows endpoint state chips', () => {
    const p = renderChannelPanel('oil-to-us-inflation', latest, index);
    expect(p.querySelectorAll('.channel-ends .state-chip')).toHaveLength(2);
  });
  test('text mode lists world state', () => {
    const t = renderTextMode(latest, orderEvents(latest), seed, states);
    const sec = t.querySelector('.text-world-state')!;
    expect(sec.querySelectorAll('li')).toHaveLength(36);
    expect(sec.textContent).toContain('美債長天期殖利率');
  });
});
