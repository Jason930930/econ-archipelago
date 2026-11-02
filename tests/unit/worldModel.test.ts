import { describe, expect, test } from 'vitest';
import { project } from '../../src/world/geo';
import { ancestorsOf, formatPath, isWithin, parentOf, parsePath } from '../../src/world/paths';
import { ECONOMY_IDS, GDP_NOTE, getRegion, REGION_IDS } from '../../src/world/regions';
import { isSectorAllowed, SECTOR_IDS } from '../../src/world/sectors';

describe('regions', () => {
  test('17 regions incl. seas and intl', () => {
    expect(REGION_IDS).toHaveLength(17);
    expect(REGION_IDS).toContain('seas');
    expect(REGION_IDS).toContain('intl');
  });
  test('15 economies have anchor and gdp', () => {
    expect(ECONOMY_IDS).toHaveLength(15);
    for (const id of ECONOMY_IDS) {
      const r = getRegion(id);
      expect(r.anchor, id).not.toBeNull();
      expect(r.gdp!, id).toBeGreaterThan(0);
      expect(r.virtual).toBe(false);
    }
  });
  test('russia anchored near Moscow', () => expect(getRegion('ru').anchor).toEqual({ lat: 55.7, lon: 37.6 }));
  test('gdp note names the source', () => expect(GDP_NOTE).toContain('IMF'));
  test('default sectors are allowed for their region', () => {
    for (const id of REGION_IDS) for (const s of getRegion(id).defaultSectors) expect(isSectorAllowed(id, s), `${id}/${s}`).toBe(true);
  });
});

describe('sectors', () => {
  test('18 sectors', () => expect(SECTOR_IDS).toHaveLength(18));
  test('sector permissions', () => {
    expect(isSectorAllowed('seas', 'shipping-lane')).toBe(true);
    expect(isSectorAllowed('us', 'shipping-lane')).toBe(false);
    expect(isSectorAllowed('intl', 'organization')).toBe(true);
    expect(isSectorAllowed('intl', 'commodities')).toBe(true);
    expect(isSectorAllowed('intl', 'crypto')).toBe(true);
    expect(isSectorAllowed('intl', 'equity')).toBe(false);
    expect(isSectorAllowed('jp', 'real-estate')).toBe(true);
    expect(isSectorAllowed('tw', 'organization')).toBe(false);
    expect(isSectorAllowed('seas', 'equity')).toBe(false);
  });
});

describe('paths', () => {
  test('parsePath', () => {
    expect(parsePath('tw/semiconductor/tsmc')).toEqual({ region: 'tw', sector: 'semiconductor', entity: 'tsmc', depth: 3 });
    expect(parsePath('us/central-bank')).toEqual({ region: 'us', sector: 'central-bank', depth: 2 });
    expect(parsePath('us')).toEqual({ region: 'us', depth: 1 });
    for (const bad of ['', 'US', 'a//b', 'a/b/c/d', 'tw/semi_conductor', '/tw', 'tw/', 'tw/-x']) expect(parsePath(bad), bad).toBeNull();
  });
  test('formatPath round-trips', () => {
    for (const p of ['tw', 'tw/fx', 'tw/semiconductor/tsmc']) expect(formatPath(parsePath(p)!)).toBe(p);
  });
  test('ancestors and within', () => {
    expect(ancestorsOf('tw/semiconductor/tsmc')).toEqual(['tw/semiconductor', 'tw']);
    expect(ancestorsOf('tw')).toEqual([]);
    expect(parentOf('tw')).toBeNull();
    expect(parentOf('tw/fx')).toBe('tw');
    expect(isWithin('tw/semiconductor/tsmc', 'tw')).toBe(true);
    expect(isWithin('tw', 'tw')).toBe(true);
    expect(isWithin('twx/a', 'tw')).toBe(false);
    expect(isWithin('tw', 'tw/fx')).toBe(false);
  });
});

describe('projection', () => {
  test('centres the pacific', () => {
    const [x0, z0] = project(0, 150);
    expect(x0).toBeCloseTo(0);
    expect(z0).toBeCloseTo(0);
    const [ukX] = project(54, -2);
    const [brX] = project(-10, -52);
    const [twX] = project(23.7, 121);
    expect(ukX).toBeLessThan(twX);
    expect(twX).toBeLessThan(brX);
  });
  test('north is negative z', () => expect(project(10, 0)[1]).toBeCloseTo(-2.9));
  test('wraps across the antimeridian', () => {
    // 東經 150 置中 → 反子午線在西經 30；西經 30 再往西（美洲側）在右邊，往東（歐非側）在左邊
    expect(project(0, -30.0001)[0]).toBeCloseTo(180 * 0.29, 1);
    expect(project(0, -29.9999)[0]).toBeCloseTo(-180 * 0.29, 1);
  });
});
