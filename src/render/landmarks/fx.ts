import * as THREE from 'three';
import { anchorAt, finish, mesh, std, type LandmarkBuilder } from './shared';

/** 匯市：兌換亭與旗桿（旗幟儀表掛在部位 pole）。 */
export const fx: LandmarkBuilder = ({ plot }) => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.6, 0.7), std('#e8e2d0'), -0.25, 0.3, 0));
  g.add(mesh(new THREE.BoxGeometry(1.0, 0.1, 0.8), std('#2a9d8f'), -0.25, 0.65, 0));
  g.add(mesh(new THREE.BoxGeometry(0.6, 0.25, 0.04), std('#111', { emissive: new THREE.Color('#5be3ff'), emissiveIntensity: 0.8 }), -0.25, 0.4, 0.37));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5), std('#999'), 0.55, 1.2, 0.2));
  return finish(g, 2.45, plot, { roof: anchorAt(-0.25, 0.8, 0), pole: anchorAt(0.55, 0, 0.2) });
};
