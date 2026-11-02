import * as THREE from 'three';
import { anchorAt, finish, mesh, std, type LandmarkBuilder } from './shared';

/** 科技：玻璃園區與旋轉晶片。 */
export const tech: LandmarkBuilder = ({ plot }) => {
  const g = new THREE.Group();
  const glass = std('#7cc6e8', { metalness: 0.3, roughness: 0.3 });
  g.add(mesh(new THREE.BoxGeometry(0.7, 1.6, 0.7), glass, -0.35, 0.8, -0.2));
  g.add(mesh(new THREE.BoxGeometry(0.6, 1.1, 0.6), glass, 0.45, 0.55, 0.15));
  g.add(mesh(new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std('#e7f3f9'), 0.1, 0, 0.6));
  const chip = mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), std('#2b2b2b', { emissive: new THREE.Color('#5be3ff'), emissiveIntensity: 0.8 }), -0.35, 1.65, -0.2);
  g.add(chip);
  return finish(g, 2.0, plot, { roof: anchorAt(-0.35, 1.7, -0.2) }, (_dt, t) => {
    chip.rotation.y = t * 0.8;
  });
};
