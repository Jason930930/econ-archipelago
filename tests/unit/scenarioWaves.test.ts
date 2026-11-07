import { expect, test } from 'vitest';
import { markerText, scenarioWaves } from '../../src/render/scenarioWaves';
import { runScenario, type Effect, type ScenarioResult } from '../../src/world/scenario';

const eff = (node: string, wave: 1 | 2 | 3, path: string[], over: Partial<Effect> = {}): Effect =>
  ({ node, direction: 1, weight: 0.5, strength: 'strong', wave, path, vsCurrent: 'none', ...over });

test('groups by wave, plays each channel once, skips empty waves', () => {
  const r: ScenarioResult = {
    shock: { node: 'gulf.oil-price', direction: 1 },
    effects: [eff('us.inflation', 2, ['a']), eff('us.policy-rate', 3, ['a', 'b']), eff('us.long-yield', 3, ['a', 'b', 'c'])],
    taiwan: [],
  };
  expect(scenarioWaves(r)).toEqual([
    { wave: 2, channels: ['a'], nodes: ['us.inflation'] },
    { wave: 3, channels: ['b', 'c'], nodes: ['us.policy-rate', 'us.long-yield'] },
  ]);
});

test('counter paths are played too', () => {
  const r: ScenarioResult = { shock: { node: 'gulf.oil-price', direction: 1 }, effects: [eff('us.long-yield', 1, ['a'], { direction: null, counterPath: ['x', 'y'] })], taiwan: [] };
  expect(scenarioWaves(r)[0]!.channels).toEqual(['a', 'x', 'y']);
});

test('real scenario: every effect node appears exactly once', () => {
  const r = runScenario({ node: 'us.policy-rate', direction: 1 }, {});
  expect(scenarioWaves(r).flatMap((w) => w.nodes).sort()).toEqual(r.effects.map((e) => e.node).sort());
});

test('marker text', () => {
  expect(markerText(eff('x', 1, ['a']))).toBe('↑ 強');
  expect(markerText(eff('x', 1, ['a'], { direction: -1, strength: 'weak' }))).toBe('↓ 弱');
  expect(markerText(eff('x', 1, ['a'], { direction: null, strength: 'medium' }))).toBe('⇅ 中');
});
