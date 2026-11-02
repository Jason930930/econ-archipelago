import * as THREE from 'three';
import { mountAt, type Gauge } from './types';

/** 火焰（油價）：高度 0.3 + 1.8·level，附點光源。 */
export function flame(): Gauge {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#ff8a1f', emissive: new THREE.Color('#ff6a00'), emissiveIntensity: 1.6, transparent: true, opacity: 0.92, flatShading: true });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1, 6).translate(0, 0.5, 0), mat);
  const light = new THREE.PointLight('#ff7a1a', 2, 8, 2);
  light.position.y = 0.6;
  g.add(cone, light);
  let base = 1;
  return {
    attach: (host) => void mountAt(host, 'flameTop', g),
    set(r) {
      base = 0.3 + 1.8 * r.level;
      light.intensity = 1 + 4 * r.level;
    },
    update(_dt, t) {
      const f = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
      cone.scale.set(0.8 + base * 0.3, base * f, 0.8 + base * 0.3);
    },
    dispose: () => g.removeFromParent(),
  };
}
