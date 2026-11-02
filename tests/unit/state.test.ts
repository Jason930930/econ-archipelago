import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildIndex } from '../../src/data/buildIndex';
import type { FredFile, FredSeries, Point } from '../../src/data/fredFile';
import { resolveIndicators } from '../../src/data/indicators';
import type { NodeStateEntry, WeekData } from '../../src/data/types';
import { computeState, numericState, qualitativeStates, reportNumericState, stateTransitions, type NodeState } from '../../src/world/state';
import { sourceOf, type FredSource, type ReportNumericSource } from '../../src/world/stateSources';
import type { EntityRecord } from '../../src/world/registry';
import { makeEvent, makeWeek } from './helpers';

const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];
const addDays = (s: string, n: number) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** 從 start 起每 7 天一點。 */
function weekly(start: string, values: number[]): Point[] {
  return values.map((v, i) => [addDays(start, 7 * i), v]);
}
function monthly(startYear: number, startMonth: number, values: number[]): Point[] {
  return values.map((v, i) => {
    const m = startMonth - 1 + i;
    return [`${startYear + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}-01`, v];
  });
}
const series = (samples: Point[], cadence: 'daily' | 'monthly' = 'daily'): FredSeries => ({ cadence, samples, latest: samples.at(-1)! });
const DGS10 = sourceOf('us.long-yield') as FredSource;
const JPY = sourceOf('jp.yen') as FredSource;
const CPI = sourceOf('us.inflation') as FredSource;

describe('numericState', () => {
  // 40 週、等差上升：最後一點是 5 年內最高。
  const rising = series(weekly('2026-01-02', Array.from({ length: 40 }, (_, i) => 3 + i * 0.05)));
  const ref = rising.latest[0];
  test('percentile and high level', () => {
    const s = numericState('us.long-yield', DGS10, rising, ref);
    expect(s).toMatchObject({ kind: 'numeric', percentile: 100, level: 'high', value: 4.95, unit: '%', asOf: ref, freshness: 'fresh' });
    expect(s.source).toEqual({ kind: 'fred', series: 'DGS10', url: 'https://fred.stlouisfed.org/series/DGS10', label: '美國 10 年期公債殖利率' });
  });
  test('80/20 cut-offs', () => {
    const vals = Array.from({ length: 30 }, (_, i) => i + 1); // 1..30
    const at = (k: number) => numericState('us.long-yield', DGS10, series(weekly('2026-01-02', [...vals.filter((v) => v !== k), k])), addDays('2026-01-02', 7 * 29));
    expect(at(24)).toMatchObject({ percentile: 80, level: 'high' }); // 24/30 = 80%
    expect(at(23)).toMatchObject({ level: 'mid' });
    expect(at(6)).toMatchObject({ percentile: 20, level: 'low' }); // 6/30 = 20%
    expect(at(7)).toMatchObject({ level: 'mid' });
  });
  test('short history gives null level', () => {
    const s = numericState('us.long-yield', DGS10, series(weekly('2026-08-07', Array.from({ length: 10 }, (_, i) => 4 + i * 0.01))), '2026-10-09');
    expect(s.level).toBeNull();
    expect(s.percentile).toBeNull();
    expect(s.value).toBe(4.09);
  });
  test('direction compares with four weeks earlier against half a sigma', () => {
    const s = numericState('us.long-yield', DGS10, rising, ref);
    expect(s.direction).toBe(1);
    expect(s.lookback).toEqual([addDays(ref, -28), 4.75]);
    const flat = series(weekly('2026-01-02', Array.from({ length: 40 }, (_, i) => (i % 2 ? 4 : 4.4))));
    // 震盪序列：4 週前後同一相位 → 變化 0 → 持平
    expect(numericState('us.long-yield', DGS10, flat, flat.latest[0]).direction).toBe(0);
  });
  test('zero sigma counts any non-zero change', () => {
    const vals = [...Array.from({ length: 35 }, () => 4), 4, 4, 4, 4, 4.25];
    expect(numericState('us.long-yield', DGS10, series(weekly('2026-01-02', vals)), addDays('2026-01-02', 7 * 39)).direction).toBe(1);
  });
  test('inverted series flips level and direction', () => {
    const s = numericState('jp.yen', JPY, rising, ref); // USD/JPY 上升到 5 年最高 = 日圓最弱
    expect(s.level).toBe('low');
    expect(s.percentile).toBe(0);
    expect(s.direction).toBe(-1);
    expect(s.value).toBe(4.95);
  });
  test('YoY transform for monthly indices', () => {
    const idx = monthly(2023, 1, Array.from({ length: 46 }, (_, i) => 100 * 1.003 ** i));
    const s = numericState('us.inflation', CPI, series(idx, 'monthly'), '2026-11-02');
    expect(s.value).toBeCloseTo((1.003 ** 12 - 1) * 100, 1);
    expect(s.asOf).toBe('2026-10-01');
  });
  test('monthly series 60 days old is fresh, daily 15 days old is stale', () => {
    const idx = monthly(2023, 1, Array.from({ length: 45 }, (_, i) => 100 + i));
    expect(numericState('us.inflation', CPI, series(idx, 'monthly'), '2026-10-30').freshness).toBe('fresh'); // 9/01 → 59 天
    expect(numericState('us.long-yield', DGS10, rising, addDays(ref, 15)).freshness).toBe('stale');
    expect(numericState('us.long-yield', DGS10, rising, addDays(ref, 14)).freshness).toBe('fresh');
  });
  test('uses the last point on or before the reference date', () => {
    const s = numericState('us.long-yield', DGS10, rising, addDays(ref, -10));
    expect(s.asOf).toBe(addDays(ref, -14));
  });
  test('missing series is unknown', () => {
    expect(numericState('us.long-yield', DGS10, undefined, ref)).toMatchObject({ freshness: 'unknown', level: null, direction: null, value: null });
  });
});

describe('reportNumericState', () => {
  const GOLD = sourceOf('intl.gold') as ReportNumericSource;
  const weeks = [
    makeWeek('2026-10-02', { indicators: { gold: { value: 4000 } } }),
    makeWeek('2026-10-09', { indicators: { gold: { value: 4010 } } }),
    makeWeek('2026-10-16', {}),
    makeWeek('2026-10-23', { indicators: { gold: { value: 4100 } } }),
  ];
  const resolved = resolveIndicators(weeks);
  test('short archive: no level; ≥ 1% change gives direction', () => {
    const s = reportNumericState('intl.gold', GOLD, weeks, resolved, 3);
    expect(s).toMatchObject({ kind: 'numeric', value: 4100, level: null, direction: 1, asOf: '2026-10-23', freshness: 'fresh', unit: '美元／盎司' });
    expect(s.lookback).toEqual(['2026-10-02', 4000]);
    expect(s.source).toEqual({ kind: 'report', weekId: '2026-10-23', evidence: [] });
  });
  test('small change is flat; carried value is stale', () => {
    expect(reportNumericState('intl.gold', GOLD, weeks, resolved, 1).direction).toBe(0);
    expect(reportNumericState('intl.gold', GOLD, weeks, resolved, 2)).toMatchObject({ freshness: 'stale', asOf: '2026-10-09' });
  });
  test('never reported is unknown', () => {
    expect(reportNumericState('tw.equity', sourceOf('tw.equity') as ReportNumericSource, weeks, resolved, 3).freshness).toBe('unknown');
  });
});

describe('qualitativeStates', () => {
  const entry = (over: Partial<NodeStateEntry> = {}): NodeStateEntry => ({ node: 'tw.foreign-flow', level: 'low', direction: -1, basis: '外資賣超', evidence: ['e1'], ...over });
  const ids = Array.from({ length: 10 }, (_, i) => addDays('2026-08-28', 7 * i));
  const weeks: WeekData[] = ids.map((id, i) => makeWeek(id, i === 0 ? { nodeStates: [entry()] } : {}));
  const states = qualitativeStates(weeks);
  test('this week is fresh', () => {
    expect(states[0]!['tw.foreign-flow']).toMatchObject({ kind: 'qualitative', level: 'low', direction: -1, basis: '外資賣超', freshness: 'fresh', carriedWeeks: 0, asOf: ids[0] });
    expect(states[0]!['tw.foreign-flow']!.source).toEqual({ kind: 'report', weekId: ids[0], evidence: ['e1'] });
  });
  test('carried 1–7 weeks is aging, 8+ is stale', () => {
    expect(states[1]!['tw.foreign-flow']).toMatchObject({ freshness: 'aging', carriedWeeks: 1 });
    expect(states[7]!['tw.foreign-flow']).toMatchObject({ freshness: 'aging', carriedWeeks: 7 });
    expect(states[8]!['tw.foreign-flow']).toMatchObject({ freshness: 'stale', carriedWeeks: 8 });
  });
  test('never reported is unknown, and only qualitative nodes are present', () => {
    expect(states[0]!['tw.strait-risk']).toMatchObject({ freshness: 'unknown', level: null });
    expect(Object.keys(states[0]!)).toHaveLength(18);
  });
});

describe('computeState', () => {
  const fred = JSON.parse(readFileSync('tests/fixtures/fred.json', 'utf8')) as FredFile;
  const weeks = [makeWeek('2026-10-23'), makeWeek('2026-10-30', { indicators: { gold: { value: 4000 } } })];
  test('every week has all 36 nodes; latest uses fetchedAt', () => {
    const st = computeState(weeks, fred);
    expect(Object.keys(st.byWeek['2026-10-30']!)).toHaveLength(36);
    expect(st.latestRef).toBe('2026-11-01');
    expect(st.latest['intl.gold']).toEqual(st.byWeek['2026-10-30']!['intl.gold']);
    expect(st.latest['us.long-yield']!.asOf).toBe('2026-10-30');
  });
  test('missing fred file leaves fred nodes unknown', () => {
    const st = computeState(weeks, null);
    expect(st.latest['us.long-yield']!.freshness).toBe('unknown');
    expect(st.latestRef).toBeNull();
    expect(st.series).toEqual({});
  });
  test('series keeps only the last two years, in raw orientation', () => {
    const real = JSON.parse(readFileSync('data/state/fred.json', 'utf8')) as FredFile;
    const st = computeState(weeks, real);
    const pts = st.series['jp.yen']!;
    expect(pts[0]![0] >= addDays(st.latestRef!, -731)).toBe(true);
    expect(pts.at(-1)![1]).toBe(real.series.DEXJPUS!.latest[1]);
  });
});

describe('stateTransitions', () => {
  const s = (level: NodeState['level'], direction: NodeState['direction']) => ({ level, direction }) as NodeState;
  test('level changes first, then direction changes, limited', () => {
    const prev = { 'jp.yen': s('mid', 0), 'us.long-yield': s('high', 1), 'gulf.oil-price': s('high', 1), 'tw.twd': s(null, null) };
    const cur = { 'jp.yen': s('low', -1), 'us.long-yield': s('high', -1), 'gulf.oil-price': s('high', 1), 'tw.twd': s('low', 1) };
    expect(stateTransitions(prev, cur)).toEqual([
      { node: 'jp.yen', kind: 'level', from: 'mid', to: 'low' },
      { node: 'us.long-yield', kind: 'direction', from: '1', to: '-1' },
    ]);
    expect(stateTransitions(prev, cur, 1)).toHaveLength(1);
  });
});

test('buildIndex carries state', () => {
  const idx = buildIndex([makeWeek('2026-10-30', { events: [makeEvent()] })], seed, null);
  expect(Object.keys(idx.state.byWeek['2026-10-30']!)).toHaveLength(36);
});
