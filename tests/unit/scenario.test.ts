import { describe, expect, test } from 'vitest';
import { CHANNEL_NODES, type Channel } from '../../src/world/channels';
import { isTaiwanNode, runScenario, SCENARIO_NOTE, stepDirections, STRENGTH_TEXT, WAVE_TEXT } from '../../src/world/scenario';
import type { NodeState } from '../../src/world/state';

const none: Record<string, NodeState> = {};
const st = (level: NodeState['level'], direction: NodeState['direction']) => ({ level, direction, freshness: 'fresh' }) as NodeState;
let n = 0;
const ch = (from: string, to: string, sign: 1 | -1 = 1, strength: 1 | 2 | 3 = 3, lag: Channel['lag'] = 'days'): Channel =>
  ({ id: `c${String(n++).padStart(2, '0')}-${from}-${to}`, from, to, sign, strength, lag, family: 'markets', mechanism: 'm' });

describe('runScenario on the curated network', () => {
  const oil = runScenario({ node: 'gulf.oil-price', direction: 1 }, none);
  test('oil up lifts US inflation strongly within weeks', () => {
    expect(oil.effects.find((e) => e.node === 'us.inflation')).toMatchObject({ direction: 1, strength: 'strong', wave: 2, path: ['oil-to-us-inflation'], weight: 1 });
  });
  test('yields up push tech valuations down', () => {
    expect(runScenario({ node: 'us.long-yield', direction: 1 }, none).effects.find((e) => e.node === 'us.tech-valuation')).toMatchObject({ direction: -1, path: ['us-yield-to-tech'] });
  });
  test('the shocked node is not an effect, paths stay within four hops, weights above the floor', () => {
    for (const nd of CHANNEL_NODES) for (const d of [1, -1] as const) {
      const r = runScenario({ node: nd.id, direction: d }, none);
      expect(r.effects.some((e) => e.node === nd.id)).toBe(false);
      for (const e of r.effects) {
        expect(e.path.length).toBeGreaterThan(0);
        expect(e.path.length).toBeLessThanOrEqual(4);
        expect(e.weight).toBeGreaterThanOrEqual(0.05);
      }
    }
  });
  test('all 72 scenarios are deterministic', () => {
    for (const nd of CHANNEL_NODES) for (const d of [1, -1] as const) {
      expect(runScenario({ node: nd.id, direction: d }, none)).toEqual(runScenario({ node: nd.id, direction: d }, none));
    }
  });
  test('sink node gives empty result', () => {
    expect(runScenario({ node: 'tw.equity', direction: 1 }, none)).toEqual({ shock: { node: 'tw.equity', direction: 1 }, effects: [], taiwan: [] });
  });
  test('taiwan list keeps only Taiwan nodes, in order', () => {
    expect(oil.taiwan).toEqual(oil.effects.filter((e) => isTaiwanNode(e.node)));
    expect(isTaiwanNode('tw.equity')).toBe(true);
    expect(isTaiwanNode('tw.strait-risk')).toBe(true);
    expect(isTaiwanNode('jp.yen')).toBe(false);
  });
  test('sorted by wave, then weight', () => {
    const key = oil.effects.map((e) => [e.wave, -e.weight]);
    expect([...key].sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!)).toEqual(key);
  });
  test('unknown shock node throws', () => expect(() => runScenario({ node: 'nope', direction: 1 }, none)).toThrow());
  test('texts', () => {
    expect(STRENGTH_TEXT).toEqual({ strong: '強', medium: '中', weak: '弱' });
    expect(WAVE_TEXT).toEqual({ 1: '數日', 2: '數週', 3: '數月' });
    expect(SCENARIO_NOTE).toBe('依教科書層級的定性傳導關係推演，不是預測。');
  });
});

describe('runScenario rules on synthetic networks', () => {
  const A = 'gulf.oil-price', B = 'us.inflation', C = 'us.policy-rate', D = 'us.long-yield', E = 'us.tech-valuation', F = 'tw.equity';
  test('signs multiply and weight decays 0.7 per extra hop', () => {
    const r = runScenario({ node: A, direction: 1 }, none, [ch(A, B, -1, 3), ch(B, C, -1, 2, 'months')]);
    expect(r.effects.find((e) => e.node === B)).toMatchObject({ direction: -1, weight: 1, strength: 'strong', wave: 1 });
    expect(r.effects.find((e) => e.node === C)!.direction).toBe(1);
    expect(r.effects.find((e) => e.node === C)!.weight).toBeCloseTo((2 / 3) * 0.7);
    expect(r.effects.find((e) => e.node === C)).toMatchObject({ strength: 'medium', wave: 3 });
  });
  test('stops after four hops', () => {
    const r = runScenario({ node: A, direction: 1 }, none, [ch(A, B), ch(B, C), ch(C, D), ch(D, E), ch(E, F)]);
    expect(r.effects.map((e) => e.node)).toEqual([B, C, D, E]);
  });
  test('paths never revisit a node', () => {
    const r = runScenario({ node: A, direction: 1 }, none, [ch(A, B), ch(B, A), ch(B, C), ch(C, B)]);
    expect(r.effects.map((e) => e.node).sort()).toEqual([B, C].sort());
    for (const e of r.effects) expect(new Set(e.path).size).toBe(e.path.length);
  });
  test('weak paths below 0.05 are dropped', () => {
    const r = runScenario({ node: A, direction: 1 }, none, [ch(A, B, 1, 1), ch(B, C, 1, 1), ch(C, D, 1, 1)]);
    // 1/3 → 中；(1/3)^2·0.7 ≈ 0.078 → 弱；(1/3)^3·0.49 ≈ 0.018 → 剔除
    expect(r.effects.map((e) => [e.node, e.strength])).toEqual([[B, 'medium'], [C, 'weak']]);
  });
  test('opposing path at least half as strong makes the direction diverge', () => {
    const r = runScenario({ node: A, direction: 1 }, none, [ch(A, D, 1, 3), ch(A, B, 1, 3), ch(B, D, -1, 3)]);
    const d = r.effects.find((e) => e.node === D)!;
    expect(d.direction).toBeNull();
    expect(d.path).toHaveLength(1);
    expect(d.counterPath).toHaveLength(2);
    expect(d.vsCurrent).toBe('none');
  });
  test('opposing path weaker than half does not diverge', () => {
    const r = runScenario({ node: A, direction: 1 }, none, [ch(A, D, 1, 3), ch(A, B, 1, 1), ch(B, D, -1, 1)]);
    expect(r.effects.find((e) => e.node === D)).toMatchObject({ direction: 1 });
    expect(r.effects.find((e) => e.node === D)!.counterPath).toBeUndefined();
  });
  test('ties prefer fewer hops, then channel ids', () => {
    const a = ch(A, B, 1, 3), b = ch(A, C, 1, 3), c = ch(C, B, 1, 3);
    // A→B 權重 1（1 跳）勝過 A→C→B 0.7
    expect(runScenario({ node: A, direction: 1 }, none, [c, b, a]).effects.find((e) => e.node === B)!.path).toEqual([a.id]);
    const x = ch(A, B, 1, 2), y = ch(A, B, 1, 2);
    expect(runScenario({ node: A, direction: 1 }, none, [y, x]).effects[0]!.path).toEqual([x.id]);
  });
  test('wave is the slowest lag on the main path', () => {
    const r = runScenario({ node: A, direction: 1 }, none, [ch(A, B, 1, 3, 'months'), ch(B, C, 1, 3, 'days')]);
    expect(r.effects.find((e) => e.node === C)!.wave).toBe(3);
  });
  test('compares with current state and flags extremes', () => {
    const states = { [B]: st('high', 1), [C]: st('low', 1), [D]: st('mid', 0) };
    const r = runScenario({ node: A, direction: 1 }, states, [ch(A, B), ch(A, C, -1), ch(A, D)]);
    expect(r.effects.find((e) => e.node === B)).toMatchObject({ vsCurrent: 'same', extreme: 'high' });
    expect(r.effects.find((e) => e.node === C)).toMatchObject({ vsCurrent: 'opposite', extreme: 'low' });
    expect(r.effects.find((e) => e.node === D)).toMatchObject({ vsCurrent: 'none' });
    expect(r.effects.find((e) => e.node === D)!.extreme).toBeUndefined();
  });
  test('stepDirections follows the signs along a path', () => {
    const c1 = ch(A, B, -1), c2 = ch(B, C, -1);
    expect(stepDirections({ node: A, direction: 1 }, [c1.id, c2.id], [c1, c2])).toEqual([-1, 1]);
  });
});
