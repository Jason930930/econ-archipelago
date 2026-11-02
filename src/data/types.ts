import type { NewEntity } from '../world/registry';

export const INDICATOR_KEYS = [
  'brent', 'wti', 'fedFunds', 'us10y', 'sp500', 'nasdaq', 'dow', 'taiex', 'cpiYoY', 'gold', 'btc', 'usdtwd',
] as const;

export type IndicatorKey = (typeof INDICATOR_KEYS)[number];

export interface Indicator {
  value: number;
  range?: [number, number];
  unit?: string;
  changePct?: number | null;
  note?: string;
}

export interface TaiwanImpact {
  summary: string;
  direction: -1 | 0 | 1;
  channels: string[];
}

export interface Metric {
  label: string;
  value: string;
  change?: string;
}

export interface Source {
  title: string;
  url: string;
}

export interface WeekEvent {
  id: string;
  rank: number;
  date: string | null;
  title: string;
  what: string;
  why: string;
  discrepancy: string | null;
  taiwanImpact: TaiwanImpact | null;
  /** 最直接受衝擊的位置（路徑），必須包含在 places 中。 */
  primary: string;
  places: string[];
  sentiment: number;
  storylines: string[];
  metrics: Metric[];
  sources: Source[];
  /** 本則事件點亮的精選管道 id（單一事件內的傳導）。 */
  channels?: string[];
}

export interface CausalLink {
  from: string;
  to: string;
  label: string;
  /** 這條因果所走的精選管道 id。 */
  channel?: string;
}

/** 排程提議、尚未收錄的管道。 */
export interface ProposedChannel {
  id: string;
  fromPath: string;
  toPath: string;
  fromVar: string;
  toVar: string;
  sign: 1 | -1;
  mechanism: string;
  /** 本週的事件 id。 */
  evidence: string[];
}

export interface StorylineDef {
  id: string;
  name: string;
}

export interface WatchItem {
  date: string | null;
  text: string;
  places: string[];
  confirmed: boolean;
}

export interface WeekData {
  schemaVersion: 2;
  weekId: string;
  period: { start: string; end: string };
  title: string;
  indicators: Partial<Record<IndicatorKey, Indicator>>;
  events: WeekEvent[];
  links: CausalLink[];
  storylines: StorylineDef[];
  watchlist: WatchItem[];
  /** 本週第一次出現的第 3 層實體。 */
  newEntities?: NewEntity[];
  proposedChannels?: ProposedChannel[];
}
