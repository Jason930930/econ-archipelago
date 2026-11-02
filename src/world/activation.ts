import type { WeekData } from '../data/types';
import { isChannelId } from './channels';

/** 本週強度上限：同一條管道被超過 3 則事件引用也只算 3。 */
export const MAX_INTENSITY = 3;
/** 熱度每週衰減為一半（半衰期 1 週）。 */
export const HEAT_DECAY = 0.5;
/** 熱度低於此值視為已淡出，不寫進 byWeek。 */
export const HEAT_FLOOR = 0.01;

export interface ChannelActivity {
  intensity: number;
  heat: number;
  streak: number;
}

export interface ProposalSummary {
  id: string;
  fromPath: string;
  toPath: string;
  fromVar: string;
  toVar: string;
  sign: 1 | -1;
  /** 取最近一次的說法。 */
  mechanism: string;
  weeks: { weekId: string; evidence: string[] }[];
  /** 提議 id 已收錄為精選管道。 */
  promoted: boolean;
}

export interface ChannelIndex {
  byWeek: Record<string, Record<string, ChannelActivity>>;
  history: Record<string, { weekId: string; eventIds: string[] }[]>;
  proposals: ProposalSummary[];
}

/** 本週每條被引用管道的強度與引用它的事件（依事件在週資料中的順序）。 */
export function weekIntensity(week: WeekData): Record<string, { intensity: number; eventIds: string[] }> {
  const refs = new Map<string, Set<string>>();
  const add = (channel: string, eventId: string) => {
    if (!refs.has(channel)) refs.set(channel, new Set());
    refs.get(channel)!.add(eventId);
  };
  for (const l of week.links) if (l.channel) { add(l.channel, l.from); add(l.channel, l.to); }
  for (const ev of week.events) for (const c of ev.channels ?? []) add(c, ev.id);
  const order = new Map(week.events.map((e, i) => [e.id, i] as const));
  const out: Record<string, { intensity: number; eventIds: string[] }> = {};
  for (const [c, ids] of refs) {
    const eventIds = [...ids].sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity));
    out[c] = { intensity: Math.min(MAX_INTENSITY, eventIds.length), eventIds };
  }
  return out;
}

const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** 依 weekId 排序後逐週計算熱度、連續週數、歷史與提議彙總。 */
export function computeActivation(weeks: WeekData[]): ChannelIndex {
  const asc = [...weeks].sort((a, b) => a.weekId.localeCompare(b.weekId));
  const heat = new Map<string, number>();
  const streak = new Map<string, number>();
  const byWeek: ChannelIndex['byWeek'] = {};
  const history: ChannelIndex['history'] = {};
  const proposals = new Map<string, ProposalSummary>();

  for (const w of asc) {
    const now = weekIntensity(w);
    const ids = new Set([...heat.keys(), ...Object.keys(now)]);
    const row: Record<string, ChannelActivity> = {};
    for (const c of [...ids].sort()) {
      const intensity = now[c]?.intensity ?? 0;
      const h = intensity + HEAT_DECAY * (heat.get(c) ?? 0);
      const s = intensity > 0 ? (streak.get(c) ?? 0) + 1 : 0;
      heat.set(c, h);
      streak.set(c, s);
      if (h > HEAT_FLOOR) row[c] = { intensity, heat: round4(h), streak: s };
      else heat.delete(c);
    }
    byWeek[w.weekId] = row;
    for (const [c, r] of Object.entries(now)) (history[c] ??= []).push({ weekId: w.weekId, eventIds: r.eventIds });

    for (const p of w.proposedChannels ?? []) {
      const prev = proposals.get(p.id);
      const weekEntry = { weekId: w.weekId, evidence: [...p.evidence] };
      proposals.set(p.id, {
        id: p.id, fromPath: p.fromPath, toPath: p.toPath, fromVar: p.fromVar, toVar: p.toVar, sign: p.sign,
        mechanism: p.mechanism, weeks: [...(prev?.weeks ?? []), weekEntry], promoted: isChannelId(p.id),
      });
    }
  }
  return { byWeek, history, proposals: [...proposals.values()] };
}
