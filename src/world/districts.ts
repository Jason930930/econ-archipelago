import { getRegion, type RegionId } from './regions';
import { isSectorAllowed, isSectorId, SECTOR_IDS, type SectorId } from './sectors';

/** 島上的區塊 = 預設部門 ∪ 被引用的合法部門，依 SECTOR_IDS 順序。 */
export function districtsFor(region: RegionId, referenced: Iterable<SectorId>): SectorId[] {
  const set = new Set<SectorId>(getRegion(region).defaultSectors);
  for (const s of referenced) if (isSectorId(s) && isSectorAllowed(region, s)) set.add(s);
  return SECTOR_IDS.filter((s) => set.has(s));
}

const FILL = 0.92;
const SPACING = 1.05;
/** 區塊上限隨島嶼半徑放大（經濟體越大，區塊越大），介於 1.4 到 3.0。 */
const maxPlot = (radius: number) => Math.min(3.0, Math.max(1.4, radius * 0.42));

/** 中心 1 格，之後每圈半徑 = k·plot·1.05，容量以弦長計。回傳 null 表示放不下。 */
function pack(radius: number, n: number, plot: number): [number, number][] | null {
  const step = plot * SPACING;
  const limit = radius * FILL - plot / 2;
  if (limit < 0) return null;
  const out: [number, number][] = [[0, 0]];
  for (let k = 1; out.length < n; k++) {
    const rho = k * step;
    if (rho > limit + 1e-12) return null;
    const cap = Math.floor(Math.PI / Math.asin(Math.min(1, step / (2 * rho))) + 1e-9);
    const m = Math.min(cap, n - out.length);
    const phase = (k % 2) * (Math.PI / Math.max(m, 1));
    for (let i = 0; i < m; i++) {
      const a = phase + (i * 2 * Math.PI) / m - Math.PI / 2;
      out.push([rho * Math.cos(a), rho * Math.sin(a)]);
    }
  }
  return out.slice(0, n);
}

export function districtSlots(radius: number, n: number): { offsets: [number, number][]; plot: number } {
  if (n <= 0) return { offsets: [], plot: maxPlot(radius) };
  let lo = 0.01, hi = maxPlot(radius);
  if (pack(radius, n, hi)) return { offsets: pack(radius, n, hi)!, plot: hi };
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (pack(radius, n, mid)) lo = mid;
    else hi = mid;
  }
  return { offsets: pack(radius, n, lo)!, plot: lo };
}

/** 本週提到的優先，再依歷史提及次數由多到少，最後依 id 字母序。 */
export function pickVisibleEntities(candidates: { id: string; mentioned: number }[], inWeek: Set<string>, max = 4): string[] {
  return [...candidates]
    .sort((a, b) => Number(inWeek.has(b.id)) - Number(inWeek.has(a.id)) || b.mentioned - a.mentioned || a.id.localeCompare(b.id))
    .slice(0, max)
    .map((c) => c.id);
}
