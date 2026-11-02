// @vitest-environment jsdom
import type * as THREE from 'three';
import { expect, test } from 'vitest';
import { buildDistrict } from '../../src/render/layers/district';
import { LANDMARKS } from '../../src/render/landmarks';

test('district slab is round so the circle-based slot math holds', () => {
  const plot = 1.19;
  const d = buildDistrict('tw/fx', 'fx', [0, 0], plot, LANDMARKS.fx({ plot: plot * 0.5 }));
  const slab = d.group.children[0] as THREE.Mesh;
  expect(slab.geometry.type).toBe('CylinderGeometry');
  const p = (slab.geometry as THREE.CylinderGeometry).parameters;
  expect(Math.max(p.radiusTop, p.radiusBottom)).toBeLessThanOrEqual(plot * 0.46 + 1e-9);
});
