import { expect, test } from 'vitest';
import { buildSteps, orderEvents } from '../../src/story/order';
import type { CausalLink } from '../../src/data/types';
import { makeEvent, makeWeek } from './helpers';

const week = (links: CausalLink[]) => makeWeek('2026-10-30', {
  events: [1, 2, 3, 4, 5].map((r) => makeEvent({ id: `e${r}`, rank: r })),
  links,
});
const L = (from: string, to: string): CausalLink => ({ from, to, label: '' });

test('topological order with rank tie-break', () => {
  expect(orderEvents(week([L('e3', 'e5'), L('e5', 'e2')]))).toEqual(['e1', 'e3', 'e4', 'e5', 'e2']);
});

test('no links means rank order', () => {
  expect(orderEvents(week([]))).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
});

test('orderEvents falls back to rank on cycle', () => {
  expect(orderEvents(week([L('e1', 'e2'), L('e2', 'e1')]))).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
});

test('backfilled 10/30 chain plays cause before effect', () => {
  expect(orderEvents(week([L('e3', 'e5'), L('e5', 'e2'), L('e5', 'e1'), L('e1', 'e4')]))).toEqual(['e3', 'e5', 'e1', 'e2', 'e4']);
});

test('result always contains every event once', () => {
  const r = orderEvents(week([L('e1', 'e9'), L('e4', 'e4')]));
  expect([...r].sort()).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
});

test('buildSteps appends finale', () => {
  const steps = buildSteps(week([]));
  expect(steps).toHaveLength(6);
  expect(steps[5]).toEqual({ kind: 'finale' });
  expect(steps[0]).toEqual({ kind: 'event', eventId: 'e1' });
});
