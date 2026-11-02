import * as THREE from 'three';
import { expect, test } from 'vitest';
import { createPickRaycaster, LINE_PICK_THRESHOLD } from '../../src/render/pick';

/** 一條沿 x 軸的線，射線從正上方往下、在 z 方向偏離 offset。 */
function hitsLine(offset: number): boolean {
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-5, 0, 0), new THREE.Vector3(5, 0, 0)]), new THREE.LineBasicMaterial());
  line.updateMatrixWorld();
  const r = createPickRaycaster();
  r.set(new THREE.Vector3(0, 10, offset), new THREE.Vector3(0, -1, 0));
  return r.intersectObject(line).length > 0;
}

test('dashed proposal lines only pick within a thin band', () => {
  expect(LINE_PICK_THRESHOLD).toBeLessThanOrEqual(0.15);
  expect(hitsLine(0.05)).toBe(true);
  expect(hitsLine(0.5)).toBe(false);
});
