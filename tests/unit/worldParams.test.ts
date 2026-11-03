import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { ResolvedIndicator, ResolvedIndicators } from '../../src/data/indicators';
import { INDICATOR_KEYS, type IndicatorKey } from '../../src/data/types';
import { bindingFor, computeWorldParams, INDICATOR_BINDINGS, lerpWorldParams, sentimentScore, stackFloors } from '../../src/world/indicators';
import { resolvePath, type EntityRecord } from '../../src/world/registry';
import { makeEvent } from './helpers';

const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];
const missing: ResolvedIndicator = { status: 'missing', value: null, changePct: null, fromWeek: null };
function ind(over: Partial<Record<IndicatorKey, Partial<ResolvedIndicator>>> = {}): ResolvedIndicators {
  const out = {} as ResolvedIndicators;
  for (const k of INDICATOR_KEYS) out[k] = over[k] ? { status: 'fresh', value: null, changePct: null, fromWeek: 'w', ...over[k] } : { ...missing };
  return out;
}

describe('bindings', () => {
  test('nine bindings', () => expect(INDICATOR_BINDINGS).toHaveLength(9));
  test('every binding path resolves', () => {
    for (const b of INDICATOR_BINDINGS) expect(resolvePath(b.path, seed), b.path).toEqual({ ok: true });
  });
  test('bindingFor', () => {
    expect(bindingFor('gulf/energy')?.gauge).toBe('flame');
    expect(bindingFor('us/equity')?.keys).toEqual(['nasdaq', 'sp500']);
    expect(bindingFor('kr/memory')).toBeUndefined();
  });
});

describe('computeWorldParams', () => {
  test('brent drives flame and tankers', () => {
    const p = computeWorldParams(ind({ brent: { value: 113 } }), []);
    expect(p.gauges['gulf/energy']!.level).toBeCloseTo(0.6625);
    expect(p.tankers).toBe(6);
  });
  test('brent clamps', () => expect(computeWorldParams(ind({ brent: { value: 200 } }), []).gauges['gulf/energy']!.level).toBe(1));
  test('us10y drives bond floors', () => {
    expect(stackFloors(computeWorldParams(ind({ us10y: { value: 5.05 } }), []).gauges['us/bonds']!.level)).toBe(10);
  });
  test('nasdaq change drives the us equity light band', () => {
    expect(computeWorldParams(ind({ nasdaq: { value: 1, changePct: -2.86 } }), []).gauges['us/equity']).toMatchObject({ trend: -1, key: 'nasdaq', status: 'fresh' });
    expect(computeWorldParams(ind({ nasdaq: { value: 1, changePct: -2.86 } }), []).gauges['us/equity']!.level).toBeCloseTo(0.9533, 3);
  });
  test('falls back to sp500 when nasdaq has no change', () => {
    expect(computeWorldParams(ind({ nasdaq: { value: 1 }, sp500: { value: 1, changePct: 1.5 } }), []).gauges['us/equity']).toMatchObject({ trend: 1, level: 0.5, key: 'sp500' });
  });
  test('tiny change is flat', () => expect(computeWorldParams(ind({ taiex: { value: 1, changePct: 0.05 } }), []).gauges['tw/equity']!.trend).toBe(0));
  test('missing indicators give neutral readings', () => {
    const p = computeWorldParams(ind(), []);
    expect(p.gauges['gulf/energy']).toEqual({ level: 0.5, trend: 0, status: 'missing', key: null });
    expect(stackFloors(p.gauges['us/bonds']!.level)).toBe(7);
    expect(p.gauges['us/equity']!.level).toBe(0);
    expect(p.gauges['us']!.level).toBe(0);
    expect(p.gauges['intl/commodities/gold']!.level).toBe(0.5);
    expect(p.tankers).toBe(5);
  });
  test('stale is flagged but still used', () => {
    expect(computeWorldParams(ind({ brent: { value: 140, status: 'stale' } }), []).gauges['gulf/energy']).toMatchObject({ level: 1, status: 'stale', key: 'brent' });
  });
});

describe('sentiment and weather', () => {
  const events = [-2, -1, -2, -2, -1].map((s, i) => makeEvent({ id: `e${i + 1}`, rank: i + 1, sentiment: s }));
  test('rank weighted', () => expect(sentimentScore(events)).toBeCloseTo(-25 / 15));
  test('always sunny, even in a very negative week', () => {
    expect(computeWorldParams(ind(), events).weather).toBe('sunny');
    expect(computeWorldParams(ind(), [makeEvent({ sentiment: 3 })]).weather).toBe('sunny');
  });
});

describe('lerpWorldParams', () => {
  const a = computeWorldParams(ind({ brent: { value: 60 } }), [makeEvent({ sentiment: 3 })]);
  const b = computeWorldParams(ind({ brent: { value: 140 } }), [makeEvent({ sentiment: -3 })]);
  test('endpoints', () => {
    expect(lerpWorldParams(a, b, 0)).toEqual(a);
    expect(lerpWorldParams(a, b, 1)).toEqual(b);
  });
  test('midpoint', () => {
    const m = lerpWorldParams(a, b, 0.5);
    expect(m.gauges['gulf/energy']!.level).toBeCloseTo(0.5);
    expect(Number.isInteger(m.tankers)).toBe(true);
    expect(m.weather).toBe('sunny');
  });
});
