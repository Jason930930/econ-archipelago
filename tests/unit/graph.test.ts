import { describe, expect, test } from 'vitest';
import { WorldGraph, type WorldNode } from '../../src/render/graph';

const node = (path: string, kind: WorldNode['kind']): WorldNode => ({
  path, kind, object: {} as WorldNode['object'], anchor: () => ({}) as ReturnType<WorldNode['anchor']>,
  setState: () => {}, update: () => {}, dispose: () => {},
});

function graph(...paths: string[]) {
  const g = new WorldGraph();
  for (const p of paths) g.add(node(p, p.split('/').length === 1 ? 'region' : p.split('/').length === 2 ? 'district' : 'entity'));
  return g;
}

describe('WorldGraph', () => {
  test('get and children', () => {
    const g = graph('tw', 'tw/semiconductor', 'tw/fx', 'tw/semiconductor/tsmc', 'us');
    expect(g.get('tw/fx')?.path).toBe('tw/fx');
    expect(g.children('tw').map((n) => n.path).sort()).toEqual(['tw/fx', 'tw/semiconductor']);
    expect(g.children('tw/semiconductor').map((n) => n.path)).toEqual(['tw/semiconductor/tsmc']);
    expect(g.all()).toHaveLength(5);
  });
  test('nearest falls back to the district for an unrendered entity', () => {
    expect(graph('tw', 'tw/semiconductor').nearest('tw/semiconductor/tsmc')!.path).toBe('tw/semiconductor');
  });
  test('nearest returns the region node for a region path', () => {
    expect(graph('us', 'us/equity').nearest('us')!.path).toBe('us');
    expect(graph('us').nearest('us/real-estate')!.path).toBe('us');
  });
  test('nearest returns undefined for unknown region', () => expect(graph('us').nearest('zz/x')).toBeUndefined());
  test('remove drops a node and its descendants', () => {
    const g = graph('tw', 'tw/semiconductor', 'tw/semiconductor/tsmc', 'tw/fx');
    g.removeSubtree('tw/semiconductor');
    expect(g.all().map((n) => n.path).sort()).toEqual(['tw', 'tw/fx']);
  });
});
