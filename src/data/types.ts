import type { EntityId } from '../world/entities';

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
  primaryEntity: EntityId;
  entities: EntityId[];
  sentiment: number;
  storylines: string[];
  metrics: Metric[];
  sources: Source[];
}

export interface CausalLink {
  from: string;
  to: string;
  label: string;
}

export interface StorylineDef {
  id: string;
  name: string;
}

export interface WatchItem {
  date: string | null;
  text: string;
  entities: EntityId[];
  confirmed: boolean;
}

export interface WeekData {
  schemaVersion: 1;
  weekId: string;
  period: { start: string; end: string };
  title: string;
  indicators: Partial<Record<IndicatorKey, Indicator>>;
  events: WeekEvent[];
  links: CausalLink[];
  storylines: StorylineDef[];
  watchlist: WatchItem[];
}
