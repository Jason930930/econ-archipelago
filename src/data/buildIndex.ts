import { resolveIndicators, type ResolvedIndicators } from './indicators';
import { districtsFor } from '../world/districts';
import { ancestorsOf, parsePath } from '../world/paths';
import { REGION_IDS, type RegionId } from '../world/regions';
import { mergeRegistry, type EntityRecord } from '../world/registry';
import type { SectorId } from '../world/sectors';
import type { WeekData } from './types';

export interface ArchiveIndex {
  weeks: { weekId: string; title: string; period: { start: string; end: string } }[];
  storylines: { id: string; name: string; events: { weekId: string; eventId: string; title: string }[] }[];
  indicators: Record<string, ResolvedIndicators>;
  /** 種子 + 各週 newEntities。 */
  entities: EntityRecord[];
  /** 每個路徑（含祖先）被事件 places 引用的總次數。 */
  mentions: Record<string, number>;
  /** 每座島的區塊（預設部門 ∪ 被引用或有實體的部門）。 */
  districts: Record<RegionId, SectorId[]>;
}

export function sortWeeks(weeks: WeekData[]): WeekData[] {
  return [...weeks].sort((a, b) => a.weekId.localeCompare(b.weekId));
}

export function buildIndex(weeks: WeekData[], seed: EntityRecord[]): ArchiveIndex {
  const asc = sortWeeks(weeks);
  const resolved = resolveIndicators(asc);
  const lines = new Map<string, ArchiveIndex['storylines'][number]>();
  for (const w of asc) {
    for (const s of w.storylines) if (!lines.has(s.id)) lines.set(s.id, { id: s.id, name: s.name, events: [] });
    for (const ev of [...w.events].sort((x, y) => x.rank - y.rank)) {
      for (const sid of ev.storylines) lines.get(sid)?.events.push({ weekId: w.weekId, eventId: ev.id, title: ev.title });
    }
  }
  const entities = mergeRegistry(seed, asc);
  const mentions: Record<string, number> = {};
  const referenced = new Map<RegionId, Set<SectorId>>(REGION_IDS.map((r) => [r, new Set<SectorId>()]));
  const reference = (path: string) => {
    const p = parsePath(path);
    if (p?.sector) referenced.get(p.region as RegionId)?.add(p.sector as SectorId);
  };
  for (const w of asc) {
    for (const ev of w.events) for (const place of ev.places) {
      for (const p of [place, ...ancestorsOf(place)]) mentions[p] = (mentions[p] ?? 0) + 1;
      reference(place);
    }
    for (const x of w.watchlist) x.places.forEach(reference);
  }
  for (const e of entities) referenced.get(e.region)?.add(e.sector);
  const districts = Object.fromEntries(REGION_IDS.map((r) => [r, districtsFor(r, referenced.get(r)!)])) as Record<RegionId, SectorId[]>;

  return {
    entities,
    mentions,
    districts,
    weeks: asc.map((w) => ({ weekId: w.weekId, title: w.title, period: w.period })),
    storylines: [...lines.values()],
    indicators: Object.fromEntries(asc.map((w, i) => [w.weekId, resolved[i]!])),
  };
}
