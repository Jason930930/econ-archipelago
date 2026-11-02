import * as THREE from 'three';
import { anchorAt, finish, mesh, std, type LandmarkBuilder } from './shared';

/** 能源：油井架與儲槽（火焰儀表掛在部位 flameTop）。 */
export const energy: LandmarkBuilder = ({ plot }) => {
  const g = new THREE.Group();
  const steel = std('#5b5b5b');
  for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]] as const) {
    const leg = mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.9, 4), steel, x * 0.6, 0.95, z * 0.6);
    leg.rotation.set(z * 0.35, 0, -x * 0.35);
    g.add(leg);
  }
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), steel, 0, 1.85, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 8), std('#c9b28a'), 0.85, 0.25, 0.4));
  g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 8), std('#c9b28a'), 0.85, 0.25, -0.4));
  return finish(g, 2.0, plot, { roof: anchorAt(0, 1.9, 0), flameTop: anchorAt(0, 1.9, 0) });
};
