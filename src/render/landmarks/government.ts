import * as THREE from 'three';
import { anchorAt, finish, mesh, std, type LandmarkBuilder } from './shared';

/** 政府與財政：圓頂議事堂。 */
export const government: LandmarkBuilder = ({ plot }) => {
  const g = new THREE.Group();
  const white = std('#f1eee6');
  g.add(mesh(new THREE.BoxGeometry(1.5, 0.45, 0.9), white, 0, 0.225, 0));
  for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 6), white, x, 0.67, 0.35));
  g.add(mesh(new THREE.BoxGeometry(1.3, 0.08, 0.85), std('#ddd7c8'), 0, 0.92, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.35, 12), white, 0, 1.13, 0));
  g.add(mesh(new THREE.SphereGeometry(0.36, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#c8d3dc', { metalness: 0.3 }), 0, 1.3, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 5), std('#888'), 0, 1.82, 0));
  return finish(g, 2.0, plot, { roof: anchorAt(0, 1.95, 0) });
};
