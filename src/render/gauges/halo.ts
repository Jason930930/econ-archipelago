import * as THREE from 'three';
import type { Gauge, GaugeHost } from './types';

/** 光暈（金價）：大小與透明度隨 level。 */
export function halo(): Gauge {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.2, depthWrite: false }));
  let level = 0.5;
  let size = 1;
  return {
    attach(host: GaugeHost) {
      size = (host.landmark?.top ?? 1) * 0.6 + 0.3;
      m.position.y = (host.landmark?.top ?? 1) * 0.4;
      host.object.add(m);
    },
    set(r) {
      level = r.level;
    },
    update(_dt, t) {
      m.scale.setScalar(size * (0.7 + level * 0.8 + Math.sin(t * 2) * 0.05));
      (m.material as THREE.MeshBasicMaterial).opacity = 0.08 + level * 0.3;
    },
    dispose: () => m.removeFromParent(),
  };
}
