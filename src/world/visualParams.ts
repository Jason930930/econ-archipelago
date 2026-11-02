import type { ResolvedIndicator, ResolvedIndicators } from '../data/indicators';
import { INDICATOR_KEYS, type IndicatorKey, type WeekEvent } from '../data/types';

export type Weather = 'sunny' | 'cloudy' | 'overcast' | 'storm';

export interface Light {
  trend: -1 | 0 | 1;
  /** 0..1 */
  intensity: number;
}

export interface VisualParams {
  oilFlame: number;
  tankers: number;
  fedBeam: number;
  bondFloors: number;
  wallst: Light;
  twse: Light;
  cpiHaze: number;
  goldGlow: number;
  cryptoFlicker: number;
  cbcFlag: number;
  weather: Weather;
  sentimentScore: number;
  status: Partial<Record<IndicatorKey, 'stale' | 'missing'>>;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const linear = (v: number, lo: number, hi: number) => clamp01((v - lo) / (hi - lo));

function scaled(r: ResolvedIndicator, lo: number, hi: number, neutral: number): number {
  return r.value === null ? neutral : linear(r.value, lo, hi);
}

function light(change: number | null): Light {
  if (change === null) return { trend: 0, intensity: 0 };
  const trend = Math.abs(change) < 0.1 ? 0 : change > 0 ? 1 : -1;
  return { trend, intensity: linear(Math.abs(change), 0, 3) };
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

export function computeVisualParams(ind: ResolvedIndicators, events: WeekEvent[]): VisualParams {
  const oilFlame = scaled(ind.brent, 60, 140, 0.5);
  const status: VisualParams['status'] = {};
  for (const k of INDICATOR_KEYS) {
    const s = ind[k].status;
    if (s !== 'fresh') status[k] = s;
  }
  const score = sentimentScore(events);
  return {
    oilFlame,
    tankers: ind.brent.value === null ? 5 : Math.round(2 + 6 * oilFlame),
    fedBeam: scaled(ind.fedFunds, 0, 6, 0.5),
    bondFloors: ind.us10y.value === null ? 7 : Math.round(3 + 9 * linear(ind.us10y.value, 2, 6)),
    wallst: light(ind.nasdaq.changePct ?? ind.sp500.changePct),
    twse: light(ind.taiex.changePct),
    cpiHaze: scaled(ind.cpiYoY, 1, 6, 0),
    goldGlow: scaled(ind.gold, 2000, 5000, 0.5),
    cryptoFlicker: ind.btc.changePct === null ? 0 : linear(Math.abs(ind.btc.changePct), 0, 10),
    cbcFlag: scaled(ind.usdtwd, 28, 34, 0.5),
    weather: sentimentToWeather(score),
    sentimentScore: score,
    status,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpLight = (a: Light, b: Light, t: number): Light => ({ trend: t >= 0.5 ? b.trend : a.trend, intensity: lerp(a.intensity, b.intensity, t) });

export function lerpVisualParams(a: VisualParams, b: VisualParams, t: number): VisualParams {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const late = t >= 0.5;
  return {
    oilFlame: lerp(a.oilFlame, b.oilFlame, t),
    tankers: Math.round(lerp(a.tankers, b.tankers, t)),
    fedBeam: lerp(a.fedBeam, b.fedBeam, t),
    bondFloors: Math.round(lerp(a.bondFloors, b.bondFloors, t)),
    wallst: lerpLight(a.wallst, b.wallst, t),
    twse: lerpLight(a.twse, b.twse, t),
    cpiHaze: lerp(a.cpiHaze, b.cpiHaze, t),
    goldGlow: lerp(a.goldGlow, b.goldGlow, t),
    cryptoFlicker: lerp(a.cryptoFlicker, b.cryptoFlicker, t),
    cbcFlag: lerp(a.cbcFlag, b.cbcFlag, t),
    weather: late ? b.weather : a.weather,
    sentimentScore: lerp(a.sentimentScore, b.sentimentScore, t),
    status: late ? b.status : a.status,
  };
}
