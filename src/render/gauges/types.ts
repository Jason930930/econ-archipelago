import type * as THREE from 'three';
import type { GaugeReading } from '../../world/indicators';
import type { WorldNode } from '../graph';
import type { Landmark } from '../landmarks';
import type { ColorMode } from '../scene';

/** 節點上可選的建築（部門區塊與實體節點才有）。 */
export type GaugeHost = WorldNode & { landmark?: Landmark };

/** L3 指標儀表：與建築分離，掛在節點上；建築只公開具名部位。 */
export interface Gauge {
  attach(node: GaugeHost): void;
  set(r: GaugeReading, mode: ColorMode): void;
  update(dt: number, t: number): void;
  dispose(): void;
}

/** 把物件放到建築某個部位的位置（同一座標系，會跟著建築縮放）。 */
export function mountAt(host: GaugeHost, part: string, obj: THREE.Object3D): boolean {
  const p = host.landmark?.parts[part];
  if (!p || !host.landmark) return false;
  obj.position.copy(p.position);
  host.landmark.group.add(obj);
  return true;
}
