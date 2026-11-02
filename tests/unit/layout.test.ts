import { describe, expect, test } from 'vitest';
import { districtSlots, districtsFor, pickVisibleEntities } from '../../src/world/districts';
import { ISLAND_GAP, layoutIslands } from '../../src/world/layout';
import { getRegion, type RegionId } from '../../src/world/regions';
import type { SectorId } from '../../src/world/sectors';

const L = layoutIslands();
const c = (id: RegionId) => L.get(id)!.center;

describe('layoutIslands', () => {
  test('all regions except seas', () => {
    expect(L.has('seas')).toBe(false);
    expect(L.size).toBe(16);
  });
  test('radius follows sqrt(gdp) with a minimum', () => {
    expect(L.get('us')!.radius).toBeCloseTo(1.7 * Math.sqrt(getRegion('us').gdp!));
    expect(L.get('us')!.enlarged).toBe(false);
    expect(L.get('tw')!.radius).toBe(2.0);
    expect(L.get('tw')!.enlarged).toBe(true);
  });
  test('no two islands overlap', () => {
    const ids = [...L.keys()];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = L.get(ids[i]!)!, b = L.get(ids[j]!)!;
      const d = Math.hypot(a.center[0] - b.center[0], a.center[1] - b.center[1]);
      expect(d, `${ids[i]}-${ids[j]}`).toBeGreaterThanOrEqual(a.radius + b.radius + ISLAND_GAP - 1e-6);
    }
  });
  test('deterministic', () => expect([...layoutIslands()]).toEqual([...L]));
  test('compass relations survive relaxation', () => {
    expect(c('jp')[0]).toBeGreaterThan(c('kr')[0]);
    expect(c('tw')[0]).toBeGreaterThan(c('cn')[0]);
    expect(c('tw')[1]).toBeGreaterThan(c('cn')[1]);
    expect(c('au')[1]).toBeGreaterThan(c('asean')[1]);
    expect(c('ca')[1]).toBeLessThan(c('us')[1]);
    expect(c('mx')[1]).toBeGreaterThan(c('us')[1]);
    expect(c('ru')[0]).toBeGreaterThan(c('ez')[0]);
    expect(c('ez')[0]).toBeGreaterThan(c('uk')[0]);
    expect(c('in')[0]).toBeLessThan(c('cn')[0]);
    expect(c('br')[1]).toBeGreaterThan(c('us')[1]);
  });
  test('taiwan stays close to its real position', () => {
    const tw = L.get('tw')!;
    expect(Math.hypot(tw.center[0] - tw.anchor[0], tw.center[1] - tw.anchor[1])).toBeLessThanOrEqual(3.5);
  });
});

describe('districts', () => {
  test('districtsFor adds referenced sectors in canonical order', () => {
    expect(districtsFor('jp', ['real-estate', 'central-bank'])).toEqual(['central-bank', 'equity', 'bonds', 'fx', 'industry', 'real-estate']);
    expect(districtsFor('tw', ['shipping-lane' as SectorId])).not.toContain('shipping-lane');
  });
  test('slots never overlap or leave the island', () => {
    for (const r of [2.0, 3.3, 9.7]) for (let n = 1; n <= 18; n++) {
      const { offsets, plot } = districtSlots(r, n);
      expect(offsets).toHaveLength(n);
      for (const [x, z] of offsets) expect(Math.hypot(x, z) + plot / 2, `r=${r} n=${n}`).toBeLessThanOrEqual(r * 0.92 + 1e-9);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const d = Math.hypot(offsets[i]![0] - offsets[j]![0], offsets[i]![1] - offsets[j]![1]);
        expect(d, `r=${r} n=${n}`).toBeGreaterThanOrEqual(plot * 1.05 - 1e-9);
      }
    }
  });
  test('pickVisibleEntities priority', () => {
    expect(pickVisibleEntities([
      { id: 'b', mentioned: 9 }, { id: 'a', mentioned: 1 }, { id: 'z', mentioned: 0 }, { id: 'c', mentioned: 9 }, { id: 'd', mentioned: 5 },
    ], new Set(['z']))).toEqual(['z', 'b', 'c', 'd']);
  });
});
