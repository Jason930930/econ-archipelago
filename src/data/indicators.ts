import { INDICATOR_KEYS, type IndicatorKey, type WeekData } from './types';

export type ResolvedIndicator = {
  status: 'fresh' | 'stale' | 'missing';
  value: number | null;
  changePct: number | null;
  range?: [number, number];
  note?: string;
  fromWeek: string | null;
};

export type ResolvedIndicators = Record<IndicatorKey, ResolvedIndicator>;

const MISSING: ResolvedIndicator = { status: 'missing', value: null, changePct: null, fromWeek: null };

/** 依週次升冪補值：缺值沿用最近一次有值的週（stale），從未有值則 missing。stale 不沿用漲跌幅。 */
export function resolveIndicators(weeksAsc: WeekData[]): ResolvedIndicators[] {
  const last = new Map<IndicatorKey, ResolvedIndicator>();
  return weeksAsc.map((w) => {
    const out = {} as ResolvedIndicators;
    for (const k of INDICATOR_KEYS) {
      const ind = w.indicators[k];
      if (ind) {
        const fresh: ResolvedIndicator = { status: 'fresh', value: ind.value, changePct: ind.changePct ?? null, fromWeek: w.weekId };
        if (ind.range) fresh.range = ind.range;
        if (ind.note) fresh.note = ind.note;
        last.set(k, fresh);
        out[k] = fresh;
      } else {
        const prev = last.get(k);
        out[k] = prev ? { ...prev, status: 'stale', changePct: null } : { ...MISSING };
      }
    }
    return out;
  });
}
