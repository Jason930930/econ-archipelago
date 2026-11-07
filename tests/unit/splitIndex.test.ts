import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildIndex } from '../../src/data/buildIndex';
import type { FredFile } from '../../src/data/fredFile';
import { hydrateWeek, splitIndex } from '../../src/data/splitIndex';
import type { WeekData } from '../../src/data/types';
import { stateTransitions } from '../../src/world/state';
import type { EntityRecord } from '../../src/world/registry';

const load = (id: string) => JSON.parse(readFileSync(`data/weeks/${id}.json`, 'utf8')) as WeekData;
const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];
const fred = JSON.parse(readFileSync('data/state/fred.json', 'utf8')) as FredFile;
const ids = ['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06'];
const full = () => buildIndex(ids.map(load), seed, fred);

describe('transitions', () => {
  test('first week is empty; later weeks compare Friday with Friday', () => {
    const idx = full();
    expect(idx.state.transitions['2026-10-16']).toEqual([]);
    for (let i = 1; i < ids.length; i++) {
      expect(idx.state.transitions[ids[i]!]).toEqual(stateTransitions(idx.state.byWeek[ids[i - 1]!]!, idx.state.byWeek[ids[i]!]!));
    }
  });
});

describe('splitIndex / hydrateWeek', () => {
  test('catalog drops per-week derived data; one derived file per week', () => {
    const { catalog, derived } = splitIndex(full());
    expect(catalog.state.byWeek).toEqual({});
    expect(catalog.channels.byWeek).toEqual({});
    expect(catalog.state.transitions).toEqual({});
    expect(derived.map((d) => d.weekId)).toEqual(ids);
    expect(Object.keys(derived[0]!.state)).toHaveLength(36);
  });
  test('hydrating every week restores the full index', () => {
    const original = full();
    const { catalog, derived } = splitIndex(full());
    for (const d of derived) hydrateWeek(catalog, d);
    expect(catalog).toEqual(original);
  });
  test('hydrating one week only fills that week', () => {
    const { catalog, derived } = splitIndex(full());
    hydrateWeek(catalog, derived[2]!);
    expect(Object.keys(catalog.state.byWeek)).toEqual(['2026-10-30']);
    expect(Object.keys(catalog.channels.byWeek)).toEqual(['2026-10-30']);
    expect(Object.keys(catalog.state.transitions)).toEqual(['2026-10-30']);
  });
  test('catalog is much smaller than the full index and splitting does not mutate the input', () => {
    const original = full();
    const before = JSON.stringify(original);
    const { catalog } = splitIndex(original);
    expect(JSON.stringify(original)).toBe(before);
    expect(JSON.stringify(catalog).length).toBeLessThan(before.length * 0.75);
  });
});
