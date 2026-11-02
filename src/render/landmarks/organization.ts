import * as THREE from 'three';
import { anchorAt, finish, mesh, std, type LandmarkBuilder } from './shared';

/** 國際組織：會館與一排旗陣。 */
export const organization: LandmarkBuilder = ({ plot }) => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.2, 0.5, 0.6), std('#eef1f4'), 0, 0.25, -0.2));
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12), std('#5b8def'), 0, 0.56, -0.2));
  const flags = ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#8d99ae'];
  flags.forEach((c, i) => {
    const x = -0.6 + i * 0.3;
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 5), std('#ccc'), x, 0.55, 0.45));
    g.add(mesh(new THREE.BoxGeometry(0.22, 0.14, 0.02), std(c), x + 0.12, 1.0, 0.45));
  });
  return finish(g, 1.2, plot, { roof: anchorAt(0, 0.7, -0.2) });
};
