import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { checkNewEntities, labelOf, mergeRegistry, normalizeName, resolvePath, type EntityRecord, type NewEntity } from '../../src/world/registry';

const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];
const ne = (o: Partial<NewEntity>): NewEntity => ({ id: 'x-co', name: 'X 公司', region: 'jp', sector: 'tech', aliases: [], ...o });

describe('checkNewEntities', () => {
  test('seed passes its own checks', () => expect(checkNewEntities([], seed)).toEqual([]));
  test('accepts a fresh entity', () => expect(checkNewEntities(seed, [ne({})])).toEqual([]));
  test('seas entities need geo', () => {
    expect(checkNewEntities(seed, [ne({ id: 'bosporus', name: '博斯普魯斯', region: 'seas', sector: 'shipping-lane' })])[0]!.field).toBe('geo');
  });
  test('rejects duplicate id', () => expect(checkNewEntities(seed, [ne({ id: 'tsmc' })])[0]!.field).toBe('id'));
  test('rejects alias collision ignoring case and spaces', () => {
    const issues = checkNewEntities(seed, [ne({ id: 'tsmc-2', name: 'T S M C ', region: 'tw', sector: 'semiconductor' })]);
    expect(issues[0]).toMatchObject({ index: 0, field: 'name' });
    expect(issues[0]!.message).toContain('台積電');
  });
  test('rejects alias that collides with an existing name', () => {
    expect(checkNewEntities(seed, [ne({ aliases: ['nvidia'] })])[0]!.field).toBe('aliases');
  });
  test('rejects disallowed region/sector', () => {
    expect(checkNewEntities(seed, [ne({ region: 'tw', sector: 'organization' })])[0]!.field).toBe('sector');
    expect(checkNewEntities(seed, [ne({ region: 'xx' as never })])[0]!.field).toBe('region');
    expect(checkNewEntities(seed, [ne({ sector: 'banks' as never })])[0]!.field).toBe('sector');
  });
  test('rejects bad id slug', () => expect(checkNewEntities(seed, [ne({ id: 'Foo_Bar' })])[0]!.field).toBe('id'));
  test('rejects empty name', () => expect(checkNewEntities(seed, [ne({ name: '  ' })])[0]!.field).toBe('name'));
  test('collisions inside the same batch are caught', () => {
    const issues = checkNewEntities(seed, [ne({ id: 'a-co', name: 'Acme' }), ne({ id: 'b-co', name: 'ACME' })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ index: 1, field: 'name' });
  });
});

describe('registry', () => {
  test('normalizeName', () => expect(normalizeName(' T S M C ')).toBe('tsmc'));
  test('mergeRegistry stamps addedIn and keeps order', () => {
    const merged = mergeRegistry(seed, [
      { weekId: '2026-11-13', newEntities: [ne({ id: 'later' , name: 'Later'})] },
      { weekId: '2026-11-06', newEntities: [ne({})] },
      { weekId: '2026-10-30' },
    ]);
    expect(merged.slice(seed.length).map((e) => [e.id, e.addedIn])).toEqual([['x-co', '2026-11-06'], ['later', '2026-11-13']]);
  });
  test('resolvePath', () => {
    expect(resolvePath('tw/semiconductor/tsmc', seed)).toEqual({ ok: true });
    expect(resolvePath('us/semiconductor/tsmc', seed).ok).toBe(false);
    expect(resolvePath('jp/real-estate', seed)).toEqual({ ok: true });
    expect(resolvePath('us', seed)).toEqual({ ok: true });
    expect(resolvePath('tw/shipping-lane', seed).ok).toBe(false);
    expect(resolvePath('xx', seed).ok).toBe(false);
    expect(resolvePath('tw/semiconductor/nope', seed).ok).toBe(false);
    expect(resolvePath('TW', seed).ok).toBe(false);
  });
  test('labelOf', () => {
    expect(labelOf('tw/semiconductor/tsmc', seed)).toEqual(['台灣', '半導體', '台積電']);
    expect(labelOf('seas/shipping-lane/hormuz', seed)).toEqual(['海域', '航道', '荷莫茲海峽']);
    expect(labelOf('zz/abc', seed)).toEqual(['zz', 'abc']);
  });
});
