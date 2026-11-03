import type { FredFile, FredSeries, Point } from '../data/fredFile';
import { resolveIndicators, type ResolvedIndicators } from '../data/indicators';
import type { WeekData } from '../data/types';
import { CHANNEL_NODES } from './channels';
import { fredUrl, NODE_SOURCES, type FredSource, type ReportNumericSource } from './stateSources';

/**
 * 節點狀態（子專案 3）：在建置索引時把 FRED 快照與週檔算成每個節點的水準、方向、新鮮度。
 * 純邏輯，可在 Node 中測試；畫面只讀結果。
 */

export type Level = 'high' | 'mid' | 'low';
export type Direction = 1 | 0 | -1;
export type Freshness = 'fresh' | 'aging' | 'stale' | 'unknown';

export type StateSource =
  | { kind: 'fred'; series: string; url: string; label: string }
  | { kind: 'report'; weekId: string; evidence: string[] };

export interface NodeState {
  node: string;
  kind: 'numeric' | 'qualitative';
  level: Level | null;
  percentile: number | null;
  direction: Direction | null;
  value: number | null;
  unit: string | null;
  asOf: string | null;
  /** 方向比較用的回看點（數值節點）。 */
  lookback: Point | null;
  source: StateSource | null;
  freshness: Freshness;
  basis: string | null;
  carriedWeeks: number;
}

export interface StateIndex {
  byWeek: Record<string, Record<string, NodeState>>;
  latest: Record<string, NodeState>;
  latestRef: string | null;
  series: Record<string, Point[]>;
}

export const HIGH_PCT = 80;
export const LOW_PCT = 20;
const WINDOW_DAYS = Math.round(365.25 * 5);
const MIN_POINTS = { daily: 26, monthly: 24 } as const;
/** 月資料標在當月 1 日，下一筆通常在 M+2 月中旬才發布（例：歐元區 HICP 約 17–19 日），所以給 100 天。 */
const FRESH_DAYS = { daily: 14, monthly: 100 } as const;
const DAILY_LOOKBACK = 28;
const DAILY_LOOKBACK_MAX = 42;
const MONTHLY_LOOKBACK = 3;
const REPORT_LOOKBACK_DAYS = 28;
const REPORT_MIN_CHANGE = 0.01;
const SERIES_DAYS = 731;
export const STALE_WEEKS = 8;

const day = (s: string) => Date.parse(`${s}T00:00:00Z`) / 86_400_000;
const addDays = (s: string, n: number) => new Date((day(s) + n) * 86_400_000).toISOString().slice(0, 10);
const round = (v: number, d = 6) => Math.round(v * 10 ** d) / 10 ** d;

function emptyState(node: string, kind: NodeState['kind']): NodeState {
  return { node, kind, level: null, percentile: null, direction: null, value: null, unit: null, asOf: null, lookback: null, source: null, freshness: 'unknown', basis: null, carriedWeeks: 0 };
}

export function levelOf(percentile: number): Level {
  return percentile >= HIGH_PCT ? 'high' : percentile <= LOW_PCT ? 'low' : 'mid';
}

/** 樣本＋最新值（若較新），再依 transform 轉換。 */
function transformed(src: FredSource, s: FredSeries): Point[] {
  const pts = [...s.samples];
  if (!pts.length || s.latest[0] > pts.at(-1)![0]) pts.push(s.latest);
  if (src.transform === 'level') return pts.map(([d, v]) => [d, round(v)]);
  const byDate = new Map(pts);
  const out: Point[] = [];
  for (const [d, v] of pts) {
    const prev = byDate.get(`${Number(d.slice(0, 4)) - 1}${d.slice(4)}`);
    if (prev) out.push([d, round((v / prev - 1) * 100, 2)]);
  }
  return out;
}

/** 回看點：日資料取 asOf − 28 天當天或之前最後一點（不早於 42 天）；月資料取 3 個月前同日。 */
function lookbackIndex(pts: Point[], i: number, cadence: 'daily' | 'monthly'): number {
  const d = pts[i]![0];
  if (cadence === 'monthly') {
    const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)) - 1 - MONTHLY_LOOKBACK;
    const target = `${y + Math.floor(m / 12)}-${String(((m % 12) + 12) % 12 + 1).padStart(2, '0')}${d.slice(7)}`;
    for (let j = i - 1; j >= 0; j--) if (pts[j]![0] === target) return j;
    return -1;
  }
  const target = addDays(d, -DAILY_LOOKBACK), floor = addDays(d, -DAILY_LOOKBACK_MAX);
  for (let j = i - 1; j >= 0; j--) {
    if (pts[j]![0] <= target) return pts[j]![0] >= floor ? j : -1;
  }
  return -1;
}

function stdev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
}

export function numericState(node: string, src: FredSource, s: FredSeries | undefined, ref: string): NodeState {
  const base = emptyState(node, 'numeric');
  base.unit = src.unit;
  base.source = { kind: 'fred', series: src.series, url: fredUrl(src.series), label: src.label };
  if (!s) return base;
  const pts = transformed(src, s);
  let i = -1;
  for (let j = 0; j < pts.length && pts[j]![0] <= ref; j++) i = j;
  if (i < 0) return base;
  const [asOf, value] = pts[i]!;
  const sign = src.invert ? -1 : 1;
  const start = addDays(ref, -WINDOW_DAYS);
  const window: number[] = [];
  for (let j = 0; j <= i; j++) if (pts[j]![0] >= start) window.push(j);

  let percentile: number | null = null;
  if (window.length >= MIN_POINTS[src.cadence]) {
    const raw = Math.round((100 * window.filter((j) => pts[j]![1] <= value).length) / window.length);
    percentile = src.invert ? 100 - raw : raw;
  }

  let direction: Direction | null = null;
  let lookback: Point | null = null;
  const k = lookbackIndex(pts, i, src.cadence);
  if (k >= 0) {
    lookback = pts[k]!;
    const changes: number[] = [];
    for (const j of window) {
      const b = lookbackIndex(pts, j, src.cadence);
      if (b >= 0) changes.push(pts[j]![1] - pts[b]![1]);
    }
    const sd = stdev(changes);
    const diff = value - lookback[1];
    const threshold = 0.5 * sd;
    const raw: Direction = sd === 0 ? (diff > 0 ? 1 : diff < 0 ? -1 : 0) : diff > threshold ? 1 : diff < -threshold ? -1 : 0;
    direction = (raw * sign || 0) as Direction;
  }

  return {
    ...base, value, asOf, lookback, percentile, direction,
    level: percentile === null ? null : levelOf(percentile),
    freshness: day(ref) - day(asOf) <= FRESH_DAYS[src.cadence] ? 'fresh' : 'stale',
  };
}

export function reportNumericState(node: string, src: ReportNumericSource, weeksAsc: WeekData[], resolved: ResolvedIndicators[], i: number): NodeState {
  const base = { ...emptyState(node, 'numeric'), unit: src.unit };
  const cur = resolved[i]?.[src.indicator];
  if (!cur || cur.value === null || !cur.fromWeek) return base;
  const value = cur.value;
  const asOf = cur.fromWeek;
  const fresh: Point[] = [];
  for (let j = 0; j <= i; j++) {
    const r = resolved[j]![src.indicator];
    if (r.status === 'fresh' && r.value !== null) fresh.push([weeksAsc[j]!.weekId, r.value]);
  }
  const start = addDays(weeksAsc[i]!.weekId, -WINDOW_DAYS);
  const window = fresh.filter(([d]) => d >= start);
  let percentile: number | null = null;
  if (window.length >= MIN_POINTS.daily) percentile = Math.round((100 * window.filter(([, v]) => v <= value).length) / window.length);
  const earliest = fresh.find(([d]) => d >= addDays(asOf, -REPORT_LOOKBACK_DAYS) && d < asOf) ?? null;
  let direction: Direction | null = null;
  if (earliest) {
    const rel = earliest[1] === 0 ? 0 : (value - earliest[1]) / Math.abs(earliest[1]);
    direction = rel >= REPORT_MIN_CHANGE ? 1 : rel <= -REPORT_MIN_CHANGE ? -1 : 0;
  }
  return {
    ...base, value, asOf, percentile, direction, lookback: earliest,
    level: percentile === null ? null : levelOf(percentile),
    source: { kind: 'report', weekId: asOf, evidence: [] },
    freshness: cur.status === 'fresh' ? 'fresh' : 'stale',
  };
}

const QUALITATIVE = CHANNEL_NODES.map((n) => n.id).filter((id) => NODE_SOURCES[id]?.kind === 'report-qualitative');

/** 每週的定性節點狀態（與 weeksAsc 對齊）：沿用最近一次填寫，依相隔週數標示新鮮度。 */
export function qualitativeStates(weeksAsc: WeekData[]): Record<string, NodeState>[] {
  const last = new Map<string, { i: number; weekId: string; e: NonNullable<WeekData['nodeStates']>[number] }>();
  return weeksAsc.map((w, i) => {
    for (const e of w.nodeStates ?? []) if (QUALITATIVE.includes(e.node)) last.set(e.node, { i, weekId: w.weekId, e });
    const out: Record<string, NodeState> = {};
    for (const id of QUALITATIVE) {
      const hit = last.get(id);
      if (!hit) { out[id] = emptyState(id, 'qualitative'); continue; }
      const carried = i - hit.i;
      out[id] = {
        ...emptyState(id, 'qualitative'),
        level: hit.e.level, direction: hit.e.direction, basis: hit.e.basis, asOf: hit.weekId, carriedWeeks: carried,
        source: { kind: 'report', weekId: hit.weekId, evidence: [...hit.e.evidence] },
        freshness: carried === 0 ? 'fresh' : carried >= STALE_WEEKS ? 'stale' : 'aging',
      };
    }
    return out;
  });
}

function statesAt(ref: string, fred: FredFile | null, weeksAsc: WeekData[], resolved: ResolvedIndicators[], qual: Record<string, NodeState>[], i: number): Record<string, NodeState> {
  const out: Record<string, NodeState> = {};
  for (const n of CHANNEL_NODES) {
    const src = NODE_SOURCES[n.id]!;
    if (src.kind === 'fred') out[n.id] = numericState(n.id, src, fred?.series[src.series], ref);
    else if (src.kind === 'report-numeric') out[n.id] = reportNumericState(n.id, src, weeksAsc, resolved, i);
    else out[n.id] = qual[i]![n.id]!;
  }
  return out;
}

export function computeState(weeks: WeekData[], fred: FredFile | null): StateIndex {
  const asc = [...weeks].sort((a, b) => a.weekId.localeCompare(b.weekId));
  const resolved = resolveIndicators(asc);
  const qual = qualitativeStates(asc);
  const byWeek: StateIndex['byWeek'] = {};
  asc.forEach((w, i) => (byWeek[w.weekId] = statesAt(w.weekId, fred, asc, resolved, qual, i)));
  const lastI = asc.length - 1;
  const latestRef = fred ? fred.fetchedAt.slice(0, 10) : null;
  const ref = latestRef && lastI >= 0 && latestRef > asc[lastI]!.weekId ? latestRef : asc[lastI]?.weekId ?? latestRef ?? '';
  const latest = lastI >= 0 ? statesAt(ref, fred, asc, resolved, qual, lastI) : {};
  const series: Record<string, Point[]> = {};
  if (fred && latestRef) {
    // 走勢圖要能涵蓋最舊的一週：取「最新 − 2 年」與「最舊週 − 1 年」較早者。
    const oldest = asc[0]?.weekId;
    const recent = addDays(latestRef, -SERIES_DAYS);
    const from = oldest && addDays(oldest, -366) < recent ? addDays(oldest, -366) : recent;
    for (const n of CHANNEL_NODES) {
      const src = NODE_SOURCES[n.id]!;
      const s = src.kind === 'fred' ? fred.series[src.series] : undefined;
      if (src.kind === 'fred' && s) series[n.id] = transformed(src, s).filter(([d]) => d >= from);
    }
  }
  return { byWeek, latest, latestRef, series };
}

/** 與上一週相比，水準或方向改變的節點（先列水準、再列方向；依節點順序）。 */
export function stateTransitions(prev: Record<string, NodeState>, cur: Record<string, NodeState>, limit = 5): { node: string; kind: 'level' | 'direction'; from: string; to: string }[] {
  const levels: { node: string; kind: 'level'; from: string; to: string }[] = [];
  const dirs: { node: string; kind: 'direction'; from: string; to: string }[] = [];
  for (const n of CHANNEL_NODES) {
    const a = prev[n.id], b = cur[n.id];
    if (!a || !b) continue;
    if (a.level && b.level && a.level !== b.level) levels.push({ node: n.id, kind: 'level', from: a.level, to: b.level });
    else if (a.direction !== null && b.direction !== null && a.direction !== b.direction) dirs.push({ node: n.id, kind: 'direction', from: String(a.direction), to: String(b.direction) });
  }
  return [...levels, ...dirs].slice(0, limit);
}
