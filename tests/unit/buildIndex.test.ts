import { expect, test } from 'vitest';
import { buildIndex } from '../../src/data/buildIndex';
import { makeEvent, makeWeek } from './helpers';

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
