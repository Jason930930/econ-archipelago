import type { SectorId } from './sectors';

/** 第 1 層：地區。15 個經濟體 + 海域、國際兩個虛擬地區。 */
export const REGION_IDS = [
  'us', 'cn', 'ez', 'jp', 'in', 'uk', 'asean', 'ca', 'br', 'ru', 'mx', 'kr', 'au', 'gulf', 'tw', 'seas', 'intl',
] as const;

export type RegionId = (typeof REGION_IDS)[number];

export interface RegionDef {
  id: RegionId;
  name: string;
  anchor: { lat: number; lon: number } | null;
  /** 名目 GDP（兆美元），只用於比例。 */
  gdp: number | null;
  virtual: boolean;
  defaultSectors: SectorId[];
}

export const GDP_NOTE = 'IMF《世界經濟展望》2026 年 10 月版之 2026 年名目 GDP 預估，約略值；歐元區、東南亞（東協）、中東／海灣（海灣合作理事會）為成員國合計。';

export const REGIONS: readonly RegionDef[] = [
  { id: 'us', name: '美國', anchor: { lat: 39, lon: -98 }, gdp: 32.6, virtual: false, defaultSectors: ['central-bank', 'equity', 'bonds', 'tech', 'semiconductor', 'energy', 'finance', 'government'] },
  { id: 'cn', name: '中國', anchor: { lat: 34, lon: 104 }, gdp: 21.5, virtual: false, defaultSectors: ['central-bank', 'equity', 'industry', 'real-estate', 'trade', 'government'] },
  { id: 'ez', name: '歐元區', anchor: { lat: 49, lon: 9 }, gdp: 19.3, virtual: false, defaultSectors: ['central-bank', 'equity', 'bonds', 'industry', 'energy'] },
  { id: 'jp', name: '日本', anchor: { lat: 36, lon: 139 }, gdp: 4.3, virtual: false, defaultSectors: ['central-bank', 'equity', 'bonds', 'fx', 'industry'] },
  { id: 'in', name: '印度', anchor: { lat: 22, lon: 79 }, gdp: 4.1, virtual: false, defaultSectors: ['central-bank', 'equity', 'tech', 'consumer'] },
  { id: 'uk', name: '英國', anchor: { lat: 54, lon: -2 }, gdp: 4.3, virtual: false, defaultSectors: ['central-bank', 'equity', 'finance'] },
  { id: 'asean', name: '東南亞', anchor: { lat: 5, lon: 110 }, gdp: 4.5, virtual: false, defaultSectors: ['trade', 'industry', 'consumer'] },
  { id: 'ca', name: '加拿大', anchor: { lat: 56, lon: -106 }, gdp: 2.5, virtual: false, defaultSectors: ['central-bank', 'energy', 'commodities'] },
  { id: 'br', name: '巴西', anchor: { lat: -10, lon: -52 }, gdp: 2.7, virtual: false, defaultSectors: ['central-bank', 'commodities', 'equity'] },
  { id: 'ru', name: '俄羅斯', anchor: { lat: 55.7, lon: 37.6 }, gdp: 2.9, virtual: false, defaultSectors: ['central-bank', 'energy', 'government'] },
  { id: 'mx', name: '墨西哥', anchor: { lat: 23, lon: -102 }, gdp: 2.2, virtual: false, defaultSectors: ['trade', 'industry'] },
  { id: 'kr', name: '韓國', anchor: { lat: 36.5, lon: 128 }, gdp: 2.2, virtual: false, defaultSectors: ['central-bank', 'equity', 'memory', 'industry'] },
  { id: 'au', name: '澳洲', anchor: { lat: -25, lon: 134 }, gdp: 2.1, virtual: false, defaultSectors: ['central-bank', 'commodities'] },
  { id: 'gulf', name: '中東／海灣', anchor: { lat: 24, lon: 47 }, gdp: 2.5, virtual: false, defaultSectors: ['energy', 'finance', 'government'] },
  { id: 'tw', name: '台灣', anchor: { lat: 23.7, lon: 121 }, gdp: 1.0, virtual: false, defaultSectors: ['central-bank', 'equity', 'fx', 'semiconductor', 'government'] },
  { id: 'seas', name: '海域', anchor: null, gdp: null, virtual: true, defaultSectors: ['shipping-lane'] },
  { id: 'intl', name: '國際', anchor: { lat: -5, lon: -165 }, gdp: null, virtual: true, defaultSectors: ['organization', 'commodities', 'crypto'] },
];

export const ECONOMY_IDS = REGION_IDS.filter((id) => id !== 'seas' && id !== 'intl');

const BY_ID = new Map(REGIONS.map((r) => [r.id, r]));

export function isRegionId(s: string): s is RegionId {
  return BY_ID.has(s as RegionId);
}

export function getRegion(id: RegionId): RegionDef {
  return BY_ID.get(id)!;
}
