import * as THREE from 'three';
import { anchorAt, finish, mesh, std, type LandmarkBuilder } from './shared';

/** 股市：交易所大樓，窗帶材質以部位 windows 公開（燈帶儀表會改它的顏色）。 */
export const equity: LandmarkBuilder = ({ plot }) => {
  const g = new THREE.Group();
  const body = std('#5d6b7a');
  const windows = std('#222', { emissive: new THREE.Color('#f2d27a'), emissiveIntensity: 0.5 });
  g.add(mesh(new THREE.BoxGeometry(1.1, 2.2, 1.1), body, 0, 1.1, 0));
  g.add(mesh(new THREE.BoxGeometry(0.75, 0.6, 0.75), body, 0, 2.5, 0));
  const bands = new THREE.Group();
  for (let i = 0; i < 5; i++) bands.add(mesh(new THREE.BoxGeometry(1.12, 0.14, 1.12), windows, 0, 0.35 + i * 0.38, 0));
  g.add(bands);
  return finish(g, 3.1, plot, { roof: anchorAt(0, 2.8, 0), windows: bands });
};
