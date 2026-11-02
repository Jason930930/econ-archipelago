import * as THREE from 'three';
import { anchorAt, finish, mesh, std, type LandmarkBuilder } from './shared';

/** 原物料：台階式礦坑與料堆。 */
export const commodities: LandmarkBuilder = ({ plot }) => {
  const g = new THREE.Group();
  const earth = ['#a0785a', '#b98d68', '#cfa77f'];
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.75 - i * 0.2, 0.8 - i * 0.2, 0.15, 10), std(earth[i]!), -0.15, 0.075 + i * 0.15, 0));
  g.add(mesh(new THREE.ConeGeometry(0.3, 0.45, 7), std('#6b6b6b'), 0.55, 0.225, 0.45));
  g.add(mesh(new THREE.ConeGeometry(0.25, 0.4, 7), std('#c08a3e'), 0.6, 0.2, -0.4));
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.2, 0.18), std('#e0b23a'), 0.15, 0.55, 0.1));
  return finish(g, 0.8, plot, { roof: anchorAt(0, 0.7, 0) });
};
