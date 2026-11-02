import type { ResolvedIndicator } from '../data/indicators';
import type { IndicatorKey } from '../data/types';

export const INDICATOR_LABELS: Record<IndicatorKey, string> = {
  brent: 'Brent 油價', wti: 'WTI 油價', fedFunds: 'Fed 利率（上緣）', us10y: '美 10 年期殖利率',
  sp500: 'S&P 500', nasdaq: '那斯達克', dow: '道瓊', taiex: '加權指數', cpiYoY: '美國 CPI 年增',
  gold: '黃金', btc: '比特幣', usdtwd: '美元兌新台幣',
};

const UNITS: Partial<Record<IndicatorKey, string>> = {
  brent: '美元', wti: '美元', fedFunds: '%', us10y: '%', cpiYoY: '%', gold: '美元', btc: '美元',
};

export function shortDate(iso: string | null): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export function formatNumber(v: number): string {
  return v.toLocaleString('zh-TW', { maximumFractionDigits: v >= 1000 ? 2 : 3 });
}

/** 例：「113.5 美元（區間 112–115）· 沿用上週」 */
export function formatIndicator(key: IndicatorKey, r: ResolvedIndicator): string {
  if (r.status === 'missing' || r.value === null) return '無資料';
  const unit = UNITS[key] ? ` ${UNITS[key]}` : '';
  const range = r.range ? `（區間 ${formatNumber(r.range[0])}–${formatNumber(r.range[1])}）` : '';
  const change = r.changePct !== null && r.status === 'fresh' ? ` ${r.changePct > 0 ? '+' : ''}${r.changePct}%` : '';
  const stale = r.status === 'stale' ? ' · 沿用上週' : '';
  return `${formatNumber(r.value)}${unit}${range}${change}${stale}`;
}
