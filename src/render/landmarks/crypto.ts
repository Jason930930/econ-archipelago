import * as THREE from 'three';
import { anchorAt, finish, mesh, std, type LandmarkBuilder } from './shared';

/** 加密：懸浮八面體（閃爍儀表改部位 gem 的發光）。 */
export const crypto: LandmarkBuilder = ({ plot }) => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.3, 6), std('#4a4a5a'), 0, 0.15, 0));
  const gem = mesh(new THREE.OctahedronGeometry(0.55, 0), std('#f7931a', { emissive: new THREE.Color('#f7931a'), emissiveIntensity: 0.4, metalness: 0.4 }), 0, 1.4, 0);
  g.add(gem);
  return finish(g, 2.2, plot, { roof: anchorAt(0, 2, 0), gem }, (_dt, t) => {
    gem.rotation.y = t * 1.2;
    gem.position.y = 1.4 + Math.sin(t * 1.6) * 0.15;
  });
};
