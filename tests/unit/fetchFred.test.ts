import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { fetchAll, formatFredFile, parseFredCsv, startDate, weeklySamples } from '../../scripts/fetch-fred';
import type { FredFile } from '../../src/data/fredFile';
import { FRED_SERIES } from '../../src/world/stateSources';

const previous = () => JSON.parse(readFileSync('tests/fixtures/fred.json', 'utf8')) as FredFile;
const now = new Date('2026-11-03T22:17:00Z');

/** 每個序列都回傳一份落在合理範圍的小 CSV。 */
function csvFor(id: string): string {
  const base: Record<string, number> = { DGS10: 4.5, DFEDTARU: 4, ECBDFR: 2.5, IRSTCI01JPM156N: 0.5, VIXCLS: 18, DEXTAUS: 31, DEXJPUS: 150 };
  const v = base[id] ?? 100;
  return `observation_date,${id}\n2026-10-26,${v}\n2026-10-27,.\n2026-10-28,${v + 0.1}\n2026-10-30,${v + 0.2}\n2026-11-02,${v + 0.3}\n`;
}

describe('parseFredCsv', () => {
  test('skips header and missing values', () => {
    expect(parseFredCsv(csvFor('DGS10'))).toEqual([['2026-10-26', 4.5], ['2026-10-28', 4.6], ['2026-10-30', 4.7], ['2026-11-02', 4.8]]);
  });
  test('ignores blank lines and garbage', () => {
    expect(parseFredCsv('observation_date,X\n\n2026-01-02,abc\n2026-01-05,1.5\n')).toEqual([['2026-01-05', 1.5]]);
  });
});

describe('weeklySamples', () => {
  test('daily keeps the last observation on or before each Friday', () => {
    const pts: [string, number][] = [['2026-10-19', 1], ['2026-10-22', 2], ['2026-10-26', 3], ['2026-10-29', 4], ['2026-11-02', 5]];
    // 10/23（週五）→ 10/22；10/30（週五）→ 10/29；11/02 之後還沒到週五 → 不取樣
    expect(weeklySamples(pts, 'daily')).toEqual([['2026-10-22', 2], ['2026-10-29', 4]]);
  });
  test('a holiday Friday falls back to the previous trading day', () => {
    expect(weeklySamples([['2026-12-24', 7], ['2026-12-28', 8]], 'daily')).toEqual([['2026-12-24', 7]]);
  });
  test('monthly keeps every point', () => {
    const pts: [string, number][] = [['2026-08-01', 1], ['2026-09-01', 2]];
    expect(weeklySamples(pts, 'monthly')).toEqual(pts);
  });
});

describe('fetchAll', () => {
  test('requests six years of history for every series', async () => {
    const urls: string[] = [];
    await fetchAll({ fetchText: async (u) => { urls.push(u); return csvFor(new URL(u).searchParams.get('id')!); }, previous: null, now });
    expect(urls).toHaveLength(FRED_SERIES.length);
    expect(urls.every((u) => u.includes(`cosd=${startDate(now)}`))).toBe(true);
    expect(startDate(now)).toBe('2020-11-03');
  });
  test('all good: every series present with latest observation', async () => {
    const { file, warnings } = await fetchAll({ fetchText: async (u) => csvFor(new URL(u).searchParams.get('id')!), previous: null, now });
    expect(warnings).toEqual([]);
    expect(Object.keys(file!.series).sort()).toEqual([...FRED_SERIES].sort());
    expect(file!.series.DGS10!.latest).toEqual(['2026-11-02', 4.8]);
    expect(file!.fetchedAt).toBe('2026-11-03T22:17:00.000Z');
  });
  test('a failing series keeps its previous entry', async () => {
    const prev = previous();
    const { file, warnings } = await fetchAll({
      fetchText: async (u) => { const id = new URL(u).searchParams.get('id')!; if (id === 'VIXCLS') throw new Error('boom'); return csvFor(id); },
      previous: prev, now,
    });
    expect(file!.series.VIXCLS).toEqual(prev.series.VIXCLS);
    expect(warnings.some((w) => w.includes('VIXCLS'))).toBe(true);
  });
  test('out-of-range data is rejected and the previous entry kept', async () => {
    const prev = previous();
    const { file, warnings } = await fetchAll({
      fetchText: async (u) => { const id = new URL(u).searchParams.get('id')!; return id === 'DGS10' ? 'observation_date,DGS10\n2026-10-30,999\n' : csvFor(id); },
      previous: prev, now,
    });
    expect(file!.series.DGS10).toEqual(prev.series.DGS10);
    expect(warnings.some((w) => w.includes('DGS10'))).toBe(true);
  });
  test('a failing series with no previous entry is dropped with a warning', async () => {
    const { file, warnings } = await fetchAll({
      fetchText: async (u) => { const id = new URL(u).searchParams.get('id')!; if (id === 'VIXCLS') throw new Error('boom'); return csvFor(id); },
      previous: null, now,
    });
    expect(file!.series.VIXCLS).toBeUndefined();
    expect(warnings.length).toBe(1);
  });
  test('everything failing writes nothing', async () => {
    const { file } = await fetchAll({ fetchText: async () => { throw new Error('down'); }, previous: previous(), now });
    expect(file).toBeNull();
  });
});

test('formatted file round-trips and puts one series per line', () => {
  const f = previous();
  const text = formatFredFile(f);
  expect(JSON.parse(text)).toEqual(f);
  expect(text.split('\n').filter((l) => l.trim().startsWith('"DGS10"'))).toHaveLength(1);
});
