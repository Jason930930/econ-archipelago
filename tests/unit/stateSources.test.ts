import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { checkSeries, fredFileWarnings, validateFredFile, type FredFile } from '../../src/data/fredFile';
import { CHANNEL_NODES } from '../../src/world/channels';
import { FRED_SERIES, fredUrl, isQualitative, NODE_SOURCES, sourceOf } from '../../src/world/stateSources';

const fixture = () => JSON.parse(readFileSync('tests/fixtures/fred.json', 'utf8')) as FredFile;

describe('source table', () => {
  test('covers exactly the 36 channel nodes', () => {
    expect(Object.keys(NODE_SOURCES).sort()).toEqual(CHANNEL_NODES.map((n) => n.id).sort());
  });
  test('16 FRED, 2 report-numeric, 18 qualitative', () => {
    const kinds = Object.values(NODE_SOURCES).map((s) => s.kind);
    expect(kinds.filter((k) => k === 'fred')).toHaveLength(16);
    expect(kinds.filter((k) => k === 'report-numeric')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'report-qualitative')).toHaveLength(18);
    expect(FRED_SERIES).toHaveLength(16);
  });
  test('report numeric nodes are gold and TAIEX', () => {
    expect(sourceOf('intl.gold')).toMatchObject({ kind: 'report-numeric', indicator: 'gold' });
    expect(sourceOf('tw.equity')).toMatchObject({ kind: 'report-numeric', indicator: 'taiex' });
  });
  test('inverted and YoY series', () => {
    const inv = Object.entries(NODE_SOURCES).filter(([, s]) => s.kind === 'fred' && s.invert).map(([id]) => id).sort();
    expect(inv).toEqual(['intl.risk-appetite', 'jp.yen', 'tw.twd']);
    const yoy = Object.entries(NODE_SOURCES).filter(([, s]) => s.kind === 'fred' && s.transform === 'yoy').map(([id]) => id).sort();
    expect(yoy).toEqual(['ez.inflation', 'us.inflation']);
  });
  test('helpers', () => {
    expect(isQualitative('tw.foreign-flow')).toBe(true);
    expect(isQualitative('us.long-yield')).toBe(false);
    expect(fredUrl('DGS10')).toBe('https://fred.stlouisfed.org/series/DGS10');
    expect(() => sourceOf('nope')).toThrow();
    expect(sourceOf('us.long-yield')).toMatchObject({ kind: 'fred', series: 'DGS10', cadence: 'daily' });
  });
});

describe('FRED file', () => {
  test('fixture is valid', () => expect(validateFredFile(fixture())).toEqual([]));
  test('dates must ascend', () => {
    const f = fixture(); f.series.DGS10!.samples.reverse();
    expect(validateFredFile(f).some((m) => m.includes('DGS10'))).toBe(true);
  });
  test('non-finite value', () => {
    expect(checkSeries('DGS10', { cadence: 'daily', latest: ['2026-10-29', 4.9], samples: [['2026-10-23', Number.NaN]] }).length).toBeGreaterThan(0);
  });
  test('value outside sane range', () => {
    expect(checkSeries('DGS10', { cadence: 'daily', latest: ['2026-10-29', 4.9], samples: [['2026-10-23', 99]] }).length).toBeGreaterThan(0);
  });
  test('empty series', () => {
    expect(checkSeries('DGS10', { cadence: 'daily', latest: ['2026-10-29', 4.9], samples: [] }).length).toBeGreaterThan(0);
  });
  test('missing series is a warning, not an error (a new series must not block the build)', () => {
    const f = fixture(); delete f.series.VIXCLS;
    expect(validateFredFile(f)).toEqual([]);
    expect(fredFileWarnings(f).some((m) => m.includes('VIXCLS'))).toBe(true);
    expect(fredFileWarnings(fixture())).toEqual([]);
  });
  test('schema shape enforced', () => {
    expect(validateFredFile({ fetchedAt: 'x' }).length).toBeGreaterThan(0);
  });
});
