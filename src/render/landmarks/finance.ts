import * as THREE from 'three';
import { anchorAt, finish, mesh, std, type LandmarkBuilder } from './shared';

/** 銀行與金融：窄高銀行塔，頂端尖頂。 */
export const finance: LandmarkBuilder = ({ plot }) => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.4, 0.9), std('#b8b2a6'), 0, 0.2, 0));
  g.add(mesh(new THREE.BoxGeometry(0.6, 2.4, 0.6), std('#3e5b76', { metalness: 0.4, roughness: 0.4 }), 0, 1.6, 0));
  g.add(mesh(new THREE.ConeGeometry(0.3, 0.6, 4), std('#c9a227', { metalness: 0.6 }), 0, 3.1, 0));
  return finish(g, 3.4, plot, { roof: anchorAt(0, 3.3, 0) });
};
