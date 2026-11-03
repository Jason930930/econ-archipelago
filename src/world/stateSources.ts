import type { IndicatorKey } from '../data/types';
import { CHANNEL_NODES } from './channels';

/**
 * 節點狀態的來源對照表（子專案 3）：唯一一處決定每個傳導節點的狀態從哪裡來。
 * FRED 由每日工作流程抓取；週報指標沿用週檔 indicators；其餘由排程依週報填定性判斷。
 */

export interface FredSource {
  kind: 'fred';
  series: string;
  /** level：原值；yoy：年增率（月資料指數）。 */
  transform: 'level' | 'yoy';
  /** 數值越高 = 節點變數越低（例：USD/JPY 上升 = 日圓走弱）。 */
  invert?: true;
  unit: string;
  cadence: 'daily' | 'monthly';
  /** 卡片上的序列說明。 */
  label: string;
  /** 原始值的合理範圍；超出視為壞資料。 */
  sane: [number, number];
  /** 反向序列的顯示註記。 */
  invertNote?: string;
}

export interface ReportNumericSource {
  kind: 'report-numeric';
  indicator: IndicatorKey;
  unit: string;
}

export type NodeSource = FredSource | ReportNumericSource | { kind: 'report-qualitative' };

const fred = (series: string, unit: string, cadence: 'daily' | 'monthly', label: string, sane: [number, number], extra: Partial<FredSource> = {}): FredSource =>
  ({ kind: 'fred', series, transform: 'level', unit, cadence, label, sane, ...extra });

const NUMERIC: Record<string, NodeSource> = {
  'gulf.oil-price': fred('DCOILBRENTEU', '美元／桶', 'daily', 'Brent 原油現貨', [5, 300]),
  'us.inflation': fred('CPIAUCSL', '%', 'monthly', '美國 CPI 年增率', [50, 1000], { transform: 'yoy' }),
  'us.policy-rate': fred('DFEDTARU', '%', 'daily', '聯邦資金利率目標上限', [0, 25]),
  'us.long-yield': fred('DGS10', '%', 'daily', '美國 10 年期公債殖利率', [0, 20]),
  'us.dollar': fred('DTWEXBGS', '指數', 'daily', '美元廣義貿易加權指數', [50, 250]),
  'us.equity': fred('SP500', '點', 'daily', 'S&P 500', [100, 50000]),
  'us.tech-valuation': fred('NASDAQCOM', '點', 'daily', '以 Nasdaq 綜合指數代理', [100, 200000]),
  'ez.inflation': fred('CP0000EZ19M086NEST', '%', 'monthly', '歐元區 HICP 年增率', [30, 500], { transform: 'yoy' }),
  'ez.policy-rate': fred('ECBDFR', '%', 'daily', 'ECB 存款機制利率', [-2, 15]),
  'ez.energy-cost': fred('PNGASEUUSDM', '美元／百萬英熱', 'monthly', '歐洲天然氣價格', [0.5, 200]),
  'jp.policy-rate': fred('IRSTCI01JPM156N', '%', 'monthly', '日本隔夜拆款利率', [-2, 15]),
  'jp.yen': fred('DEXJPUS', '日圓／美元', 'daily', '日圓兌美元匯率', [50, 400], { invert: true, invertNote: '數值越高日圓越弱' }),
  'au.commodities': fred('PIORECRUSDM', '美元／噸', 'monthly', '鐵礦砂價格', [10, 500]),
  'intl.bitcoin': fred('CBBTCUSD', '美元', 'daily', 'Coinbase 比特幣', [10, 10_000_000]),
  'intl.risk-appetite': fred('VIXCLS', '點', 'daily', '以 VIX 恐慌指數反向代理', [5, 150], { invert: true, invertNote: 'VIX 越高風險偏好越低' }),
  'tw.twd': fred('DEXTAUS', '新台幣／美元', 'daily', '新台幣兌美元匯率', [15, 60], { invert: true, invertNote: '數值越高新台幣越弱' }),
  'intl.gold': { kind: 'report-numeric', indicator: 'gold', unit: '美元／盎司' },
  'tw.equity': { kind: 'report-numeric', indicator: 'taiex', unit: '點' },
};

export const NODE_SOURCES: Readonly<Record<string, NodeSource>> = Object.fromEntries(
  CHANNEL_NODES.map((n) => [n.id, NUMERIC[n.id] ?? { kind: 'report-qualitative' }]),
);

export function sourceOf(nodeId: string): NodeSource {
  const s = NODE_SOURCES[nodeId];
  if (!s) throw new Error(`沒有節點「${nodeId}」的狀態來源`);
  return s;
}

export function isQualitative(nodeId: string): boolean {
  return NODE_SOURCES[nodeId]?.kind === 'report-qualitative';
}

export const FRED_SOURCES: readonly FredSource[] = Object.values(NODE_SOURCES).filter((s): s is FredSource => s.kind === 'fred');
export const FRED_SERIES: readonly string[] = [...new Set(FRED_SOURCES.map((s) => s.series))];

export function fredSeriesSource(series: string): FredSource | undefined {
  return FRED_SOURCES.find((s) => s.series === series);
}

export function fredUrl(series: string): string {
  return `https://fred.stlouisfed.org/series/${series}`;
}
