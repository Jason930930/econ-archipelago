import * as THREE from 'three';
import { anchorAt, finish, mesh, std, type LandmarkBuilder } from './shared';

/** 債市：疊層塔。12 層以部位 floors 公開（樓層儀表決定顯示幾層），預設 7 層。 */
export const bonds: LandmarkBuilder = ({ plot }) => {
  const g = new THREE.Group();
  const floors = new THREE.Group();
  const mats = [std('#c9d3dd'), std('#9fb0c2')];
  for (let i = 0; i < 12; i++) {
    const f = mesh(new THREE.BoxGeometry(0.9 - i * 0.02, 0.24, 0.9 - i * 0.02), mats[i % 2]!, 0, 0.12 + i * 0.25, 0);
    f.visible = i < 7;
    floors.add(f);
  }
  g.add(floors);
  const cap = mesh(new THREE.ConeGeometry(0.35, 0.4, 4), std('#7d8fa3'), 0, 7 * 0.25 + 0.2, 0);
  g.add(cap);
  return finish(g, 2.3, plot, { roof: anchorAt(0, 2, 0), floors, cap });
};
