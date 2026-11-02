import type { WeekData } from '../data/types';

export type Step = { kind: 'event'; eventId: string } | { kind: 'finale' };

/** Kahn 拓撲排序：每次從入度 0 的事件中取 rank 最小者；有循環時整週退回純 rank 順序。 */
export function orderEvents(week: WeekData): string[] {
  const byRank = [...week.events].sort((a, b) => a.rank - b.rank);
  const ids = new Set(byRank.map((e) => e.id));
  const rank = new Map(byRank.map((e) => [e.id, e.rank]));
  const indeg = new Map(byRank.map((e) => [e.id, 0]));
  const out = new Map<string, string[]>(byRank.map((e) => [e.id, []]));
  for (const l of week.links) {
    if (!ids.has(l.from) || !ids.has(l.to) || l.from === l.to) continue;
    out.get(l.from)!.push(l.to);
    indeg.set(l.to, indeg.get(l.to)! + 1);
  }
  const ready = byRank.filter((e) => indeg.get(e.id) === 0).map((e) => e.id);
  const result: string[] = [];
  while (ready.length > 0) {
    ready.sort((a, b) => rank.get(a)! - rank.get(b)!);
    const id = ready.shift()!;
    result.push(id);
    for (const to of out.get(id)!) {
      const d = indeg.get(to)! - 1;
      indeg.set(to, d);
      if (d === 0) ready.push(to);
    }
  }
  return result.length === byRank.length ? result : byRank.map((e) => e.id);
}

export function buildSteps(week: WeekData): Step[] {
  return [...orderEvents(week).map((eventId): Step => ({ kind: 'event', eventId })), { kind: 'finale' }];
}
