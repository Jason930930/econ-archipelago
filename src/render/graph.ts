import type * as THREE from 'three';
import { isWithin, parentOf } from '../world/paths';

export type NodeKind = 'region' | 'district' | 'entity';
export type NodeState = 'normal' | 'dim' | 'highlight';

/** 場景樹節點：地區島 → 部門區塊 → 實體建築，三者共用此介面。 */
export interface WorldNode {
  readonly path: string;
  readonly kind: NodeKind;
  readonly object: THREE.Object3D;
  /** 鏡頭、粒子、旗子、漣漪的落點（世界座標）。 */
  anchor(): THREE.Vector3;
  setState(s: NodeState): void;
  update(dt: number, t: number): void;
  dispose(): void;
}

/** 以路徑索引的節點表。本檔不在執行期 import three，可在 Node 中測試。 */
export class WorldGraph {
  private readonly nodes = new Map<string, WorldNode>();

  add(n: WorldNode): void {
    this.nodes.set(n.path, n);
  }

  get(path: string): WorldNode | undefined {
    return this.nodes.get(path);
  }

  /** 自己 → 父 → 祖父；找不到就回傳 undefined。 */
  nearest(path: string): WorldNode | undefined {
    for (let p: string | null = path; p !== null; p = parentOf(p)) {
      const n = this.nodes.get(p);
      if (n) return n;
    }
    return undefined;
  }

  children(path: string): WorldNode[] {
    return [...this.nodes.values()].filter((n) => parentOf(n.path) === path);
  }

  all(): WorldNode[] {
    return [...this.nodes.values()];
  }

  /** 移除 path 本身與所有子孫（會呼叫 dispose）。 */
  removeSubtree(path: string): void {
    for (const [p, n] of this.nodes) {
      if (isWithin(p, path)) {
        n.dispose();
        this.nodes.delete(p);
      }
    }
  }
}
