import * as THREE from 'three';
import { anchorAt, finish, mesh, std, type LandmarkBuilder } from './shared';

/** 消費：低矮寬商場與彩色雨遮。 */
export const consumer: LandmarkBuilder = ({ plot }) => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.5, 0.6, 1.0), std('#f3efe8'), 0, 0.3, 0));
  const awnings = ['#e76f51', '#2a9d8f', '#e9c46a', '#8ab17d'];
  awnings.forEach((c, i) => {
    const a = mesh(new THREE.BoxGeometry(0.34, 0.05, 0.25), std(c), -0.54 + i * 0.36, 0.45, 0.58);
    a.rotation.x = 0.35;
    g.add(a);
  });
  g.add(mesh(new THREE.BoxGeometry(0.7, 0.22, 0.05), std('#c0392b', { emissive: new THREE.Color('#ff6b6b'), emissiveIntensity: 0.5 }), 0, 0.78, 0.45));
  return finish(g, 0.95, plot, { roof: anchorAt(0, 0.7, 0) });
};
