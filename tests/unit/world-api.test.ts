import { expect, test } from 'vitest';
import { supportsWebGL } from '../../src/render/support';

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
