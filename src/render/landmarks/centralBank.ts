import * as THREE from 'three';
import { anchorAt, finish, mesh, std, type LandmarkBuilder } from './shared';

/** 央行：柱廊建築。 */
export const centralBank: LandmarkBuilder = ({ plot }) => {
  const g = new THREE.Group();
  const stone = std('#e9e4d8');
  g.add(mesh(new THREE.BoxGeometry(1.5, 0.22, 1.1), stone, 0, 0.11, 0));
  for (const x of [-0.55, -0.18, 0.18, 0.55]) g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6), stone, x, 0.62, 0.38));
  g.add(mesh(new THREE.BoxGeometry(1.4, 0.8, 0.6), std('#d7d0c0'), 0, 0.62, -0.1));
  const roof = mesh(new THREE.ConeGeometry(0.95, 0.45, 4), std('#b9b1a0'), 0, 1.25, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.75);
  g.add(roof);
  return finish(g, 1.5, plot, { roof: anchorAt(0, 1.45, 0) });
};
