import type * as THREE from 'three';
import type { Gauge, GaugeHost } from './types';

/** 閃爍（比特幣漲跌幅）：晶體發光隨 level 快速脈動。 */
export function flicker(): Gauge {
  let gem: THREE.Mesh | undefined;
  let level = 0;
  return {
    attach(host: GaugeHost) {
      gem = host.landmark?.parts.gem as THREE.Mesh | undefined;
    },
    set(r) {
      level = r.level;
    },
    update(_dt, t) {
      const m = gem?.material as THREE.MeshStandardMaterial | undefined;
      if (m) m.emissiveIntensity = 0.35 + level * (0.5 + 0.5 * Math.sin(t * 18)) * 1.2;
    },
    dispose() {},
  };
}
