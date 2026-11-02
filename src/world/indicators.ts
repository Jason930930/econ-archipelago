import type { ResolvedIndicator, ResolvedIndicators } from '../data/indicators';
import type { IndicatorKey, WeekEvent } from '../data/types';

/** 指標綁定表：唯一一處決定「哪個指標掛在世界哪個位置、用哪種儀表呈現」。 */
export type GaugeKind = 'flame' | 'beam' | 'stack' | 'lightBand' | 'halo' | 'flicker' | 'flag' | 'haze';

export interface IndicatorBinding {
  path: string;
  gauge: GaugeKind;
  /** keys[0] 為主要指標，其餘依序為後備。 */
  keys: IndicatorKey[];
  /** level：以數值決定；change：以漲跌幅絕對值決定，並帶出漲跌方向。 */
  mode: 'level' | 'change';
  range: [number, number];
  neutral: number;
  /** 子專案 3（狀態鏡像）預留：資料來源。 */
  source?: string;
}

export const INDICATOR_BINDINGS: readonly IndicatorBinding[] = [
  { path: 'gulf/energy', gauge: 'flame', keys: ['brent', 'wti'], mode: 'level', range: [60, 140], neutral: 0.5 },
  { path: 'us/central-bank', gauge: 'beam', keys: ['fedFunds'], mode: 'level', range: [0, 6], neutral: 0.5 },
  { path: 'us/bonds', gauge: 'stack', keys: ['us10y'], mode: 'level', range: [2, 6], neutral: 4 / 9 },
  { path: 'us/equity', gauge: 'lightBand', keys: ['nasdaq', 'sp500'], mode: 'change', range: [0, 3], neutral: 0 },
  { path: 'tw/equity', gauge: 'lightBand', keys: ['taiex'], mode: 'change', range: [0, 3], neutral: 0 },
  { path: 'tw/fx', gauge: 'flag', keys: ['usdtwd'], mode: 'level', range: [28, 34], neutral: 0.5 },
  { path: 'intl/commodities/gold', gauge: 'halo', keys: ['gold'], mode: 'level', range: [2000, 5000], neutral: 0.5 },
  { path: 'intl/crypto/bitcoin', gauge: 'flicker', keys: ['btc'], mode: 'change', range: [0, 10], neutral: 0 },
  { path: 'us', gauge: 'haze', keys: ['cpiYoY'], mode: 'level', range: [1, 6], neutral: 0 },
];

const BY_PATH = new Map(INDICATOR_BINDINGS.map((b) => [b.path, b]));

export function bindingFor(path: string): IndicatorBinding | undefined {
  return BY_PATH.get(path);
}

export type Weather = 'sunny' | 'cloudy' | 'overcast' | 'storm';

export interface GaugeReading {
  /** 0..1 */
  level: number;
  trend: -1 | 0 | 1;
  status: 'fresh' | 'stale' | 'missing';
  key: IndicatorKey | null;
}

export interface WorldParams {
  gauges: Record<string, GaugeReading>;
  tankers: number;
  weather: Weather;
  sentimentScore: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const linear = (v: number, [lo, hi]: [number, number]) => clamp01((v - lo) / (hi - lo));

export function stackFloors(level: number): number {
  return Math.round(3 + 9 * level);
}

function read(b: IndicatorBinding, ind: ResolvedIndicators): GaugeReading {
  const entries = b.keys.map((k) => [k, ind[k]] as [IndicatorKey, ResolvedIndicator]);
  if (b.mode === 'level') {
    const hit = entries.find(([, r]) => r.value !== null);
    if (!hit) return { level: b.neutral, trend: 0, status: 'missing', key: null };
    return { level: linear(hit[1].value!, b.range), trend: 0, status: hit[1].status, key: hit[0] };
  }
  const withChange = entries.find(([, r]) => r.changePct !== null);
  if (withChange) {
    const c = withChange[1].changePct!;
    const trend = Math.abs(c) < 0.1 ? 0 : c > 0 ? 1 : -1;
    return { level: linear(Math.abs(c), b.range), trend, status: withChange[1].status, key: withChange[0] };
  }
  const withValue = entries.find(([, r]) => r.value !== null);
  if (withValue) return { level: b.neutral, trend: 0, status: withValue[1].status, key: withValue[0] };
  return { level: b.neutral, trend: 0, status: 'missing', key: null };
}

export function sentimentScore(events: WeekEvent[]): number {
  const n = events.length;
  if (n === 0) return 0;
  let sum = 0;
  let weights = 0;
  for (const e of events) {
    const w = n + 1 - e.rank;
    sum += w * e.sentiment;
    weights += w;
  }
  return weights === 0 ? 0 : sum / weights;
}

export function sentimentToWeather(score: number): Weather {
  if (score >= 0.5) return 'sunny';
  if (score >= -0.5) return 'cloudy';
  if (score >= -1.5) return 'overcast';
  return 'storm';
}

export function computeWorldParams(ind: ResolvedIndicators, events: WeekEvent[]): WorldParams {
  const gauges: Record<string, GaugeReading> = {};
  for (const b of INDICATOR_BINDINGS) gauges[b.path] = read(b, ind);
  const oil = gauges['gulf/energy']!;
  const score = sentimentScore(events);
  return {
    gauges,
    tankers: oil.status === 'missing' ? 5 : Math.round(2 + 6 * oil.level),
    weather: sentimentToWeather(score),
    sentimentScore: score,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function lerpWorldParams(a: WorldParams, b: WorldParams, t: number): WorldParams {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const late = t >= 0.5;
  const gauges: Record<string, GaugeReading> = {};
  for (const path of Object.keys(b.gauges)) {
    const ga = a.gauges[path] ?? b.gauges[path]!;
    const gb = b.gauges[path]!;
    gauges[path] = { level: lerp(ga.level, gb.level, t), trend: late ? gb.trend : ga.trend, status: late ? gb.status : ga.status, key: late ? gb.key : ga.key };
  }
  return {
    gauges,
    tankers: Math.round(lerp(a.tankers, b.tankers, t)),
    weather: late ? b.weather : a.weather,
    sentimentScore: lerp(a.sentimentScore, b.sentimentScore, t),
  };
}
