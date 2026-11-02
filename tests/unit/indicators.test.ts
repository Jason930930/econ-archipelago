import { expect, test } from 'vitest';
import { resolveIndicators } from '../../src/data/indicators';
import { makeWeek } from './helpers';

const w1 = makeWeek('2026-10-23', { indicators: { brent: { value: 100, changePct: 1.2 } } });

test('marks fresh when present', () => {
  const w2 = makeWeek('2026-10-30', { indicators: { brent: { value: 113, changePct: 3 } } });
  const [, r2] = resolveIndicators([w1, w2]);
  expect(r2!.brent).toMatchObject({ status: 'fresh', value: 113, changePct: 3, fromWeek: '2026-10-30' });
});

test('carries forward as stale', () => {
  const w2 = makeWeek('2026-10-30');
  const [, r2] = resolveIndicators([w1, w2]);
  expect(r2!.brent).toMatchObject({ status: 'stale', value: 100, fromWeek: '2026-10-23' });
});

test('stale changePct is null', () => {
  const [, r2] = resolveIndicators([w1, makeWeek('2026-10-30')]);
  expect(r2!.brent.changePct).toBeNull();
});

test('carries forward across several missing weeks from the last fresh one', () => {
  const r = resolveIndicators([w1, makeWeek('2026-10-30'), makeWeek('2026-11-06')]);
  expect(r[2]!.brent).toMatchObject({ status: 'stale', value: 100, fromWeek: '2026-10-23' });
});

test('marks missing when no prior week', () => {
  const [r1] = resolveIndicators([w1]);
  expect(r1!.btc).toEqual({ status: 'missing', value: null, changePct: null, fromWeek: null });
});

test('keeps range and note when fresh', () => {
  const w = makeWeek('2026-10-30', { indicators: { brent: { value: 113, range: [112, 115], note: 'n' } } });
  const [r] = resolveIndicators([w]);
  expect(r!.brent).toMatchObject({ range: [112, 115], note: 'n', changePct: null });
});
