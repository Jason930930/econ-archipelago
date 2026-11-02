import { expect, test } from 'vitest';
import { supportsWebGL } from '../../src/render/support';
import { ENTITY_INDICATORS, primaryIndicator } from '../../src/world/entityIndicators';

test('supportsWebGL returns false when getContext returns null', () => {
  const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
  expect(supportsWebGL(canvas)).toBe(false);
});

test('supportsWebGL returns false when getContext throws', () => {
  const canvas = { getContext: () => { throw new Error('blocked'); } } as unknown as HTMLCanvasElement;
  expect(supportsWebGL(canvas)).toBe(false);
});

test('supportsWebGL returns false when only WebGL1 is available (three requires WebGL2)', () => {
  const canvas = { getContext: (k: string) => (k === 'webgl' ? {} : null) } as unknown as HTMLCanvasElement;
  expect(supportsWebGL(canvas)).toBe(false);
});

test('supportsWebGL returns true when a webgl2 context exists', () => {
  const canvas = { getContext: (k: string) => (k === 'webgl2' ? {} : null) } as unknown as HTMLCanvasElement;
  expect(supportsWebGL(canvas)).toBe(true);
});

test('entity → indicator mapping matches the plan', () => {
  expect(ENTITY_INDICATORS).toEqual({
    'me-oil': ['brent'], 'us-fed': ['fedFunds'], 'us-bonds': ['us10y'], 'us-wallst': ['nasdaq', 'sp500'],
    'tw-twse': ['taiex'], 'gold-vault': ['gold'], crypto: ['btc'], 'tw-cbc': ['usdtwd'],
  });
  expect(primaryIndicator('us-wallst')).toBe('nasdaq');
  expect(primaryIndicator('kr-memory')).toBeNull();
});
