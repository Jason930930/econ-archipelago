import type { RegionId } from './regions';

/** 第 2 層：部門。順序即島上區塊的排列順序。 */
export const SECTOR_IDS = [
  'central-bank', 'government', 'trade', 'equity', 'bonds', 'fx', 'finance',
  'energy', 'commodities', 'industry', 'tech', 'semiconductor', 'memory', 'real-estate', 'consumer',
  'crypto', 'shipping-lane', 'organization',
] as const;

export type SectorId = (typeof SECTOR_IDS)[number];
export type Archetype = SectorId;
export type SectorGroup = 'macro' | 'market' | 'industry' | 'global';

export interface SectorDef {
  id: SectorId;
  name: string;
  archetype: Archetype;
  allowed: 'economy' | 'economy+intl' | 'seas' | 'intl';
  group: SectorGroup;
}

export const SECTORS: readonly SectorDef[] = [
  { id: 'central-bank', name: '央行', archetype: 'central-bank', allowed: 'economy', group: 'macro' },
  { id: 'government', name: '政府與財政', archetype: 'government', allowed: 'economy', group: 'macro' },
  { id: 'trade', name: '貿易與關稅', archetype: 'trade', allowed: 'economy', group: 'macro' },
  { id: 'equity', name: '股市', archetype: 'equity', allowed: 'economy', group: 'market' },
  { id: 'bonds', name: '債市', archetype: 'bonds', allowed: 'economy', group: 'market' },
  { id: 'fx', name: '匯市', archetype: 'fx', allowed: 'economy', group: 'market' },
  { id: 'finance', name: '銀行與金融', archetype: 'finance', allowed: 'economy', group: 'market' },
  { id: 'energy', name: '能源', archetype: 'energy', allowed: 'economy', group: 'industry' },
  { id: 'commodities', name: '原物料', archetype: 'commodities', allowed: 'economy+intl', group: 'industry' },
  { id: 'industry', name: '製造與工業', archetype: 'industry', allowed: 'economy', group: 'industry' },
  { id: 'tech', name: '科技', archetype: 'tech', allowed: 'economy', group: 'industry' },
  { id: 'semiconductor', name: '半導體', archetype: 'semiconductor', allowed: 'economy', group: 'industry' },
  { id: 'memory', name: '記憶體', archetype: 'memory', allowed: 'economy', group: 'industry' },
  { id: 'real-estate', name: '房地產', archetype: 'real-estate', allowed: 'economy', group: 'industry' },
  { id: 'consumer', name: '消費', archetype: 'consumer', allowed: 'economy', group: 'industry' },
  { id: 'crypto', name: '加密', archetype: 'crypto', allowed: 'economy+intl', group: 'global' },
  { id: 'shipping-lane', name: '航道', archetype: 'shipping-lane', allowed: 'seas', group: 'global' },
  { id: 'organization', name: '國際組織', archetype: 'organization', allowed: 'intl', group: 'global' },
];

const BY_ID = new Map(SECTORS.map((s) => [s.id, s]));

export function isSectorId(s: string): s is SectorId {
  return BY_ID.has(s as SectorId);
}

export function getSector(id: SectorId): SectorDef {
  return BY_ID.get(id)!;
}

export function isSectorAllowed(region: RegionId, sector: SectorId): boolean {
  const a = getSector(sector).allowed;
  if (region === 'seas') return a === 'seas';
  if (region === 'intl') return a === 'intl' || a === 'economy+intl';
  return a === 'economy' || a === 'economy+intl';
}
