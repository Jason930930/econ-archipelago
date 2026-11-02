import { project } from './geo';
import { REGIONS, type RegionId } from './regions';

export const ISLAND_K = 1.7;
export const ISLAND_R_MIN = 2.0;
export const ISLAND_GAP = 0.8;
/** 虛擬地區「國際」的小港口半徑。 */
const INTL_RADIUS = 2.4;
const ITERATIONS = 300;
const SETTLE_ITERATIONS = 400;
const SPRING = 0.04;
const STRENGTH: Partial<Record<RegionId, number>> = { tw: 4 };

export interface IslandLayout {
  center: [number, number];
  radius: number;
  enlarged: boolean;
  anchor: [number, number];
}

let cache: Map<RegionId, IslandLayout> | null = null;

/**
 * 島的面積 ∝ GDP（r = K·√GDP，最小 R_MIN），再以確定性鬆弛避免重疊：
 * 每回合把重疊的島沿連線推開（依強度分配位移），並朝錨點拉回。最後只做推開直到完全不重疊。
 */
export function layoutIslands(): Map<RegionId, IslandLayout> {
  if (cache) return cache;
  const items = REGIONS.filter((r) => r.anchor).map((r) => {
    const anchor = project(r.anchor!.lat, r.anchor!.lon);
    const raw = r.gdp === null ? INTL_RADIUS : ISLAND_K * Math.sqrt(r.gdp);
    const radius = Math.max(ISLAND_R_MIN, raw);
    return { id: r.id, anchor, pos: [...anchor] as [number, number], radius, enlarged: r.gdp !== null && raw < ISLAND_R_MIN, s: STRENGTH[r.id] ?? 1 };
  });

  const separate = () => {
    let moved = false;
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!, b = items[j]!;
      let dx = b.pos[0] - a.pos[0], dz = b.pos[1] - a.pos[1];
      let d = Math.hypot(dx, dz);
      const overlap = a.radius + b.radius + ISLAND_GAP - d;
      if (overlap <= 1e-9) continue;
      if (d === 0) { dx = 1; dz = 0; d = 1; }
      const ux = dx / d, uz = dz / d;
      const push = overlap + 1e-6;
      const wa = b.s / (a.s + b.s), wb = a.s / (a.s + b.s);
      a.pos[0] -= ux * push * wa; a.pos[1] -= uz * push * wa;
      b.pos[0] += ux * push * wb; b.pos[1] += uz * push * wb;
      moved = true;
    }
    return moved;
  };

  for (let k = 0; k < ITERATIONS; k++) {
    separate();
    for (const it of items) {
      const f = Math.min(1, SPRING * it.s);
      it.pos[0] += f * (it.anchor[0] - it.pos[0]);
      it.pos[1] += f * (it.anchor[1] - it.pos[1]);
    }
  }
  for (let k = 0; k < SETTLE_ITERATIONS && separate(); k++);

  cache = new Map(items.map((it) => [it.id, { center: it.pos, radius: it.radius, enlarged: it.enlarged, anchor: it.anchor }]));
  return cache;
}
