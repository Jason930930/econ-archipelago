import type * as THREE from 'three';
import { stackFloors } from '../../world/indicators';
import type { Gauge, GaugeHost } from './types';

/** 樓層（殖利率）：顯示 round(3 + 9·level) 層，頂蓋跟著移動。 */
export function stack(): Gauge {
  let floors: THREE.Object3D | undefined;
  let cap: THREE.Object3D | undefined;
  return {
    attach(host: GaugeHost) {
      floors = host.landmark?.parts.floors;
      cap = host.landmark?.parts.cap;
    },
    set(r) {
      const n = stackFloors(r.level);
      floors?.children.forEach((f, i) => (f.visible = i < n));
      if (cap) cap.position.y = n * 0.25 + 0.2;
    },
    update() {},
    dispose() {},
  };
}
