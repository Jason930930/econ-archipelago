import { resolveIndicators, type ResolvedIndicators } from './indicators';
import type { WeekData } from './types';

export interface ArchiveIndex {
  weeks: { weekId: string; title: string; period: { start: string; end: string } }[];
  storylines: { id: string; name: string; events: { weekId: string; eventId: string; title: string }[] }[];
  indicators: Record<string, ResolvedIndicators>;
}

export function sortWeeks(weeks: WeekData[]): WeekData[] {
  return [...weeks].sort((a, b) => a.weekId.localeCompare(b.weekId));
}

export function buildIndex(weeks: WeekData[]): ArchiveIndex {
  const asc = sortWeeks(weeks);
  const resolved = resolveIndicators(asc);
  const lines = new Map<string, ArchiveIndex['storylines'][number]>();
  for (const w of asc) {
    for (const s of w.storylines) if (!lines.has(s.id)) lines.set(s.id, { id: s.id, name: s.name, events: [] });
    for (const ev of [...w.events].sort((x, y) => x.rank - y.rank)) {
      for (const sid of ev.storylines) lines.get(sid)?.events.push({ weekId: w.weekId, eventId: ev.id, title: ev.title });
    }
  }
  return {
    weeks: asc.map((w) => ({ weekId: w.weekId, title: w.title, period: w.period })),
    storylines: [...lines.values()],
    indicators: Object.fromEntries(asc.map((w, i) => [w.weekId, resolved[i]!])),
  };
}
