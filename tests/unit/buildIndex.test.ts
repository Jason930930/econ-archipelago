import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildIndex as build } from '../../src/data/buildIndex';
import type { WeekData } from '../../src/data/types';
import type { EntityRecord } from '../../src/world/registry';
import { makeEvent, makeWeek } from './helpers';

const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];
const buildIndex = (weeks: WeekData[]) => build(weeks, seed);

const a = makeWeek('2026-10-23', {
  storylines: [{ id: 'ai-capex', name: 'AI 資本支出' }],
  events: [makeEvent({ id: 'e1', title: 'A1', storylines: ['ai-capex'] })],
});
const b = makeWeek('2026-10-30', {
  storylines: [{ id: 'ai-capex', name: '改過的名字' }],
  events: [makeEvent({ id: 'e1', title: 'B1', storylines: ['ai-capex'] }), makeEvent({ id: 'e2', rank: 2, title: 'B2' })],
});

test('weeks sorted ascending regardless of input order', () => {
  expect(buildIndex([b, a]).weeks.map((w) => w.weekId)).toEqual(['2026-10-23', '2026-10-30']);
});

test('storyline name comes from earliest week', () => {
  expect(buildIndex([b, a]).storylines).toEqual([
    { id: 'ai-capex', name: 'AI 資本支出', events: [
      { weekId: '2026-10-23', eventId: 'e1', title: 'A1' },
      { weekId: '2026-10-30', eventId: 'e1', title: 'B1' },
    ] },
  ]);
});

test('indicators keyed by weekId', () => {
  const idx = buildIndex([a, b]);
  expect(Object.keys(idx.indicators)).toEqual(['2026-10-23', '2026-10-30']);
  expect(idx.indicators['2026-10-30']!.brent.status).toBe('missing');
});

test('mentions counts the path and every ancestor', () => {
  const w = makeWeek('2026-11-06', { events: [makeEvent({ primary: 'tw/semiconductor/tsmc', places: ['tw/semiconductor/tsmc', 'tw/equity'] })] });
  const idx = buildIndex([w]);
  expect(idx.mentions['tw/semiconductor/tsmc']).toBe(1);
  expect(idx.mentions['tw/semiconductor']).toBe(1);
  expect(idx.mentions['tw']).toBe(2);
  expect(idx.mentions['tw/equity']).toBe(1);
});

test('districts include a referenced non-default sector', () => {
  const w = makeWeek('2026-11-06', { events: [makeEvent({ primary: 'jp/real-estate', places: ['jp/real-estate'] })] });
  const idx = buildIndex([w]);
  expect(idx.districts.jp).toContain('real-estate');
  expect(idx.districts.tw).toEqual(['central-bank', 'government', 'trade', 'equity', 'fx', 'semiconductor']);
  expect(idx.districts.seas).toEqual(['shipping-lane']);
});

test('watchlist places also create districts', () => {
  const w = makeWeek('2026-11-06', { watchlist: [{ date: null, text: 'x', places: ['uk/tech/arm'], confirmed: true }] });
  expect(build([w], seed).districts.uk).toContain('tech');
});

test('entities merge seed and newEntities', () => {
  const w = makeWeek('2026-11-06', { newEntities: [{ id: 'micron', name: 'Micron', region: 'us', sector: 'memory', aliases: [] }] });
  const idx = buildIndex([w]);
  expect(idx.entities).toHaveLength(seed.length + 1);
  expect(idx.entities.at(-1)).toMatchObject({ id: 'micron', addedIn: '2026-11-06' });
  expect(idx.districts.us).toContain('memory');
});

test('index carries channel activation', () => {
  const w = makeWeek('2026-10-30', { events: [makeEvent({ id: 'e1', channels: ['fed-to-us-yield'] })] });
  const idx = buildIndex([w]);
  expect(idx.channels.byWeek['2026-10-30']!['fed-to-us-yield']).toEqual({ intensity: 1, heat: 1, streak: 1 });
  expect(idx.channels.proposals).toEqual([]);
});
