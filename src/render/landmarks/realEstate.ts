import * as THREE from 'three';
import { anchorAt, finish, mesh, std, type LandmarkBuilder } from './shared';

/** 房地產：住宅群與吊車。 */
export const realEstate: LandmarkBuilder = ({ plot }) => {
  const g = new THREE.Group();
  const walls = ['#f4e1c1', '#e9c8a5', '#dfe7ef'];
  const spots: [number, number, number][] = [[-0.5, -0.3, 0.9], [0, -0.35, 1.2], [-0.45, 0.35, 0.7], [0.1, 0.3, 0.6]];
  spots.forEach(([x, z, h], i) => {
    g.add(mesh(new THREE.BoxGeometry(0.4, h, 0.4), std(walls[i % 3]!), x, h / 2, z));
    const roof = mesh(new THREE.ConeGeometry(0.32, 0.25, 4), std('#b5523b'), x, h + 0.12, z);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
  });
  const crane = std('#f2b632');
  g.add(mesh(new THREE.BoxGeometry(0.08, 1.9, 0.08), crane, 0.6, 0.95, 0));
  g.add(mesh(new THREE.BoxGeometry(1.0, 0.07, 0.07), crane, 0.3, 1.85, 0));
  return finish(g, 1.95, plot, { roof: anchorAt(0, 1.4, -0.35) });
};
