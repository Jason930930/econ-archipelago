import { getChannelNode, type Channel } from '../world/channels';

/** 管線路線的純函式（不 import three，可在 Node 中測試）。 */

/** 跨地區管線中點的高度（貼近海面）。 */
export const SEA_Y = 0.15;
/** 同地區管線拱頂的高度。 */
export const ARCH_Y = 2.5;
/** 同一對地區之間，每多一條管道往側邊錯開的距離。 */
export const LANE_GAP = 1.2;
/** 跨地區弧度：距離 × 此係數。 */
export const BOW = 0.18;
/** 兩端重合（同一區塊）時，拉開成小環的半寬。 */
const LOOP_HALF = 0.7;

type XZ = [number, number];

export function regionOf(path: string): string {
  return path.split('/')[0]!;
}

export function sameRegion(a: string, b: string): boolean {
  return regionOf(a) === regionOf(b);
}

/**
 * 二次貝茲曲線的起點、終點（水平座標）與控制點。
 * 法線依兩端的固定順序決定，所以 A→B 與 B→A 會彎向同一側，再依 lane 錯開。
 */
export function routeControls(a: XZ, b: XZ, laneIndex: number, same: boolean): { start: XZ; end: XZ; mid: [number, number, number] } {
  let start: XZ = [a[0], a[1]];
  let end: XZ = [b[0], b[1]];
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.3) {
    start = [a[0] - LOOP_HALF, a[1]];
    end = [a[0] + LOOP_HALF, a[1]];
  }
  const [p, q] = start[0] < end[0] || (start[0] === end[0] && start[1] <= end[1]) ? [start, end] : [end, start];
  const dx = q[0] - p[0], dz = q[1] - p[1];
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len, nz = dx / len;
  const cx = (start[0] + end[0]) / 2, cz = (start[1] + end[1]) / 2;
  if (same) {
    const off = laneIndex * 0.5;
    return { start, end, mid: [cx + nx * off, ARCH_Y + laneIndex * 0.35, cz + nz * off] };
  }
  const off = len * BOW + laneIndex * LANE_GAP;
  return { start, end, mid: [cx + nx * off, SEA_Y, cz + nz * off] };
}

/** 依端點路徑分配側道：同一對地區（不分方向）的管道依 key 排序後給 0、1、2…。 */
export function laneIndexesByPath(items: { key: string; from: string; to: string }[]): Map<string, number> {
  const groups = new Map<string, string[]>();
  for (const it of items) {
    const pair = [regionOf(it.from), regionOf(it.to)].sort().join('|');
    const g = groups.get(pair) ?? [];
    g.push(it.key);
    groups.set(pair, g);
  }
  const out = new Map<string, number>();
  for (const keys of groups.values()) [...keys].sort().forEach((k, i) => out.set(k, i));
  return out;
}

export function laneIndexes(channels: readonly Channel[]): Map<string, number> {
  return laneIndexesByPath(channels.map((c) => ({ key: c.id, from: getChannelNode(c.from).path, to: getChannelNode(c.to).path })));
}
