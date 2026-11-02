import * as THREE from 'three';
import type { Gauge, GaugeHost } from './types';

/** 熱霧（通膨）：地區上空半透明暖色霧片，透明度 0.38·level。 */
export function haze(): Gauge {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff9a4d', transparent: true, opacity: 0, depthWrite: false }));
  let target = 0;
  let baseY = 3;
  return {
    attach(host: GaugeHost) {
      const a = host.anchor();
      const r = (host.object.userData.radius as number | undefined) ?? 5;
      m.scale.setScalar(r * 0.9);
      baseY = a.y + 2.5;
      m.position.set(a.x, baseY, a.z);
      host.object.add(m);
    },
    set(r) {
      target = r.level * 0.38;
    },
    update(dt, t) {
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity += (target - mat.opacity) * Math.min(1, dt * 1.5);
      m.position.y = baseY + Math.sin(t * 0.8) * 0.15;
    },
    dispose: () => m.removeFromParent(),
  };
}
