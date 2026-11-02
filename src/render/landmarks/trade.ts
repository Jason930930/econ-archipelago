import * as THREE from 'three';
import { anchorAt, finish, mesh, std, type LandmarkBuilder } from './shared';

/** 貿易與關稅：貨櫃碼頭與吊臂。 */
export const trade: LandmarkBuilder = ({ plot }) => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.5, 0.12, 1.1), std('#9aa3ab'), 0, 0.06, 0));
  const colors = ['#d9534f', '#2f7dd1', '#f0ad4e', '#5cb85c', '#8e6cc2'];
  let i = 0;
  for (let row = 0; row < 3; row++) for (let lvl = 0; lvl < 2 - (row % 2); lvl++) {
    g.add(mesh(new THREE.BoxGeometry(0.55, 0.22, 0.24), std(colors[i++ % colors.length]!), -0.35, 0.23 + lvl * 0.23, -0.35 + row * 0.3));
  }
  const steel = std('#e0b23a');
  g.add(mesh(new THREE.BoxGeometry(0.08, 1.5, 0.08), steel, 0.5, 0.8, 0.35));
  g.add(mesh(new THREE.BoxGeometry(0.08, 1.5, 0.08), steel, 0.5, 0.8, -0.35));
  g.add(mesh(new THREE.BoxGeometry(0.08, 0.08, 1.1), steel, 0.5, 1.55, 0));
  g.add(mesh(new THREE.BoxGeometry(1.2, 0.07, 0.07), steel, 0.1, 1.5, 0));
  return finish(g, 1.65, plot, { roof: anchorAt(0.3, 1.6, 0) });
};
