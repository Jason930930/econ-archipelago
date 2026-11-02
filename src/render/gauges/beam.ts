import * as THREE from 'three';
import { mountAt, type Gauge } from './types';

/** 光柱（政策利率）：高度 0.6 + 4.5·level。 */
export function beam(): Gauge {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.24, 1, 10, 1, true).translate(0, 0.5, 0),
    new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
  );
  return {
    attach: (host) => void mountAt(host, 'roof', m),
    set(r) {
      m.scale.y = 0.6 + 4.5 * r.level;
    },
    update(_dt, t) {
      (m.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 2.2) * 0.12;
    },
    dispose: () => m.removeFromParent(),
  };
}
