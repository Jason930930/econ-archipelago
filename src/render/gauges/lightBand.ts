import * as THREE from 'three';
import { FLAT, UP_DOWN } from '../colors';
import type { Gauge, GaugeHost } from './types';

/** 燈帶（指數漲跌）：窗帶顏色依漲跌與配色慣例，亮度依幅度。 */
export function lightBand(): Gauge {
  const mats: THREE.MeshStandardMaterial[] = [];
  let pulse = 0.5;
  return {
    attach(host: GaugeHost) {
      host.landmark?.parts.windows?.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m?.isMeshStandardMaterial && !mats.includes(m)) mats.push(m);
      });
    },
    set(r, mode) {
      const c = new THREE.Color(r.trend > 0 ? UP_DOWN[mode].up : r.trend < 0 ? UP_DOWN[mode].down : FLAT);
      for (const m of mats) m.emissive.copy(c);
      pulse = 0.35 + 1.4 * r.level;
    },
    update(_dt, t) {
      for (const m of mats) m.emissiveIntensity = pulse * (0.85 + Math.sin(t * 3) * 0.15);
    },
    dispose() {},
  };
}
