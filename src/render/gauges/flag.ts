import * as THREE from 'three';
import { mountAt, type Gauge } from './types';

/** 旗幟（匯率）：旗面高度 0.6 + 1.7·level，隨風擺動。 */
export function flag(): Gauge {
  const g = new THREE.Group();
  const f = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.02), new THREE.MeshStandardMaterial({ color: '#e5484d', flatShading: true }));
  f.position.x = 0.27;
  f.castShadow = true;
  g.add(f);
  return {
    attach: (host) => void mountAt(host, 'pole', g),
    set(r) {
      f.position.y = 0.6 + 1.7 * r.level;
    },
    update(_dt, t) {
      f.rotation.y = Math.sin(t * 3) * 0.25;
    },
    dispose: () => g.removeFromParent(),
  };
}
