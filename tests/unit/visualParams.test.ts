import { describe, expect, test } from 'vitest';
import type { ResolvedIndicator, ResolvedIndicators } from '../../src/data/indicators';
import { INDICATOR_KEYS, type IndicatorKey } from '../../src/data/types';
import { computeVisualParams, lerpVisualParams, sentimentScore, sentimentToWeather } from '../../src/world/visualParams';
import { makeEvent } from './helpers';

const missing: ResolvedIndicator = { status: 'missing', value: null, changePct: null, fromWeek: null };
function ind(over: Partial<Record<IndicatorKey, Partial<ResolvedIndicator>>> = {}): ResolvedIndicators {
  const out = {} as ResolvedIndicators;
  for (const k of INDICATOR_KEYS) {
    out[k] = over[k] ? { status: 'fresh', value: null, changePct: null, fromWeek: 'w', ...over[k] } : { ...missing };
  }
  return out;
}

describe('computeVisualParams', () => {
  test('brent drives oil flame and tankers', () => {
    const p = computeVisualParams(ind({ brent: { value: 113 } }), []);
    expect(p.oilFlame).toBeCloseTo(0.6625);
    expect(p.tankers).toBe(6);
  });
  test('brent clamps at the top', () => {
    expect(computeVisualParams(ind({ brent: { value: 200 } }), []).oilFlame).toBe(1);
  });
  test('us10y drives bond floors', () => {
    expect(computeVisualParams(ind({ us10y: { value: 5.05 } }), []).bondFloors).toBe(10);
  });
  test('nasdaq change drives wall street light', () => {
    const p = computeVisualParams(ind({ nasdaq: { value: 1, changePct: -2.86 } }), []);
    expect(p.wallst.trend).toBe(-1);
    expect(p.wallst.intensity).toBeCloseTo(0.9533, 3);
  });
  test('wall street falls back to sp500 when nasdaq has no change', () => {
    const p = computeVisualParams(ind({ nasdaq: { value: 1 }, sp500: { value: 1, changePct: 1.5 } }), []);
    expect(p.wallst).toEqual({ trend: 1, intensity: 0.5 });
  });
  test('tiny change counts as flat', () => {
    expect(computeVisualParams(ind({ taiex: { value: 1, changePct: 0.05 } }), []).twse.trend).toBe(0);
  });
  test('missing indicator yields neutral param', () => {
    const p = computeVisualParams(ind(), []);
    expect(p).toMatchObject({
      oilFlame: 0.5, tankers: 5, fedBeam: 0.5, bondFloors: 7, wallst: { trend: 0, intensity: 0 }, twse: { trend: 0, intensity: 0 },
      cpiHaze: 0, goldGlow: 0.5, cryptoFlicker: 0, cbcFlag: 0.5,
    });
    expect(p.status.brent).toBe('missing');
  });
  test('stale indicator is flagged but still used', () => {
    const p = computeVisualParams(ind({ brent: { value: 140, status: 'stale' } }), []);
    expect(p.status.brent).toBe('stale');
    expect(p.oilFlame).toBe(1);
  });
  test('fresh indicator has no status entry', () => {
    expect(computeVisualParams(ind({ brent: { value: 100 } }), []).status.brent).toBeUndefined();
  });
});

describe('sentiment and weather', () => {
  const events = [-2, -1, -2, -2, -1].map((s, i) => makeEvent({ id: `e${i + 1}`, rank: i + 1, sentiment: s }));
  test('rank-weighted score', () => {
    expect(sentimentScore(events)).toBeCloseTo(-25 / 15);
  });
  test('weighted score -1.667 is a storm', () => {
    expect(computeVisualParams(ind(), events).weather).toBe('storm');
  });
  test('no events is neutral', () => {
    expect(sentimentScore([])).toBe(0);
  });
  test.each([[0.5, 'sunny'], [0.49, 'cloudy'], [-0.5, 'cloudy'], [-0.51, 'overcast'], [-1.5, 'overcast'], [-1.51, 'storm']])('score %f → %s', (s, w) => {
    expect(sentimentToWeather(s)).toBe(w);
  });
});

describe('lerpVisualParams', () => {
  const a = computeVisualParams(ind({ brent: { value: 60 }, us10y: { value: 2 } }), [makeEvent({ sentiment: 3 })]);
  const b = computeVisualParams(ind({ brent: { value: 140 }, us10y: { value: 6 } }), [makeEvent({ sentiment: -3 })]);
  test('t=0 equals a and t=1 equals b', () => {
    expect(lerpVisualParams(a, b, 0)).toEqual(a);
    expect(lerpVisualParams(a, b, 1)).toEqual(b);
  });
  test('t=0.5 averages numbers and switches discrete fields', () => {
    const m = lerpVisualParams(a, b, 0.5);
    expect(m.oilFlame).toBeCloseTo(0.5);
    expect(Number.isInteger(m.bondFloors)).toBe(true);
    expect(m.weather).toBe('storm');
  });
});
