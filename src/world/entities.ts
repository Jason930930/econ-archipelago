/** 世界實體清單：唯一來源。schema enum 與說明書都以這份為準（有測試防止漂移）。 */

export type IslandId = 'us' | 'tw' | 'kr' | 'me' | 'eu' | 'jp' | 'cn' | 'gold' | 'crypto' | 'sea' | 'port';

export type EntityKind =
  | 'bank' | 'exchange' | 'bonds' | 'tech' | 'fab' | 'memory'
  | 'oil' | 'industry' | 'vault' | 'crypto' | 'sea' | 'board';

export const ENTITY_IDS = [
  'us-fed', 'us-wallst', 'us-bonds', 'us-tech',
  'tw-cbc', 'tw-twse', 'tw-fab',
  'kr-memory',
  'me-oil',
  'eu-ecb', 'jp-boj', 'cn-industry',
  'gold-vault', 'crypto',
  'sea-hormuz', 'sea-pacific',
  'global',
] as const;

export type EntityId = (typeof ENTITY_IDS)[number];

export interface EntityDef {
  id: EntityId;
  name: string;
  island: IslandId;
  kind: EntityKind;
  /** 世界座標 [x, z]；x 向東、z 向南。 */
  position: [x: number, z: number];
  covers: string;
}

export const ENTITIES: readonly EntityDef[] = [
  { id: 'us-fed', name: 'Fed 大樓', island: 'us', kind: 'bank', position: [12, -2], covers: '美國貨幣政策' },
  { id: 'us-wallst', name: '華爾街交易所', island: 'us', kind: 'exchange', position: [15, -1], covers: '美股大盤' },
  { id: 'us-bonds', name: '美債塔', island: 'us', kind: 'bonds', position: [14, 2], covers: '美債殖利率' },
  { id: 'us-tech', name: '科技園區', island: 'us', kind: 'tech', position: [16.5, 1.5], covers: 'Big Tech、AI 財報與資本支出' },
  { id: 'tw-cbc', name: '台灣央行', island: 'tw', kind: 'bank', position: [-3, 3], covers: '台灣貨幣政策、新台幣' },
  { id: 'tw-twse', name: '證交所', island: 'tw', kind: 'exchange', position: [-1, 3.5], covers: '台股' },
  { id: 'tw-fab', name: '晶圓廠', island: 'tw', kind: 'fab', position: [-2, 5.5], covers: '半導體供應鏈' },
  { id: 'kr-memory', name: '記憶體廠', island: 'kr', kind: 'memory', position: [-2, -8], covers: 'Samsung、SK Hynix、HBM、記憶體價格' },
  { id: 'me-oil', name: '油田', island: 'me', kind: 'oil', position: [-15, 6], covers: '原油供給、中東地緣政治' },
  { id: 'eu-ecb', name: 'ECB', island: 'eu', kind: 'bank', position: [-18, -8], covers: '歐洲貨幣政策與經濟' },
  { id: 'jp-boj', name: '日銀', island: 'jp', kind: 'bank', position: [2.5, -6], covers: '日本貨幣政策、日圓' },
  { id: 'cn-industry', name: '工業區', island: 'cn', kind: 'industry', position: [-6.5, -2], covers: '中國經濟、貿易' },
  { id: 'gold-vault', name: '金庫', island: 'gold', kind: 'vault', position: [-9, 10], covers: '黃金' },
  { id: 'crypto', name: '加密島', island: 'crypto', kind: 'crypto', position: [8, 9], covers: '比特幣、加密交易所' },
  { id: 'sea-hormuz', name: '荷莫茲海峽', island: 'sea', kind: 'sea', position: [-11.5, 4.5], covers: '能源運輸' },
  { id: 'sea-pacific', name: '太平洋航線', island: 'sea', kind: 'sea', position: [5, 2], covers: '供應鏈、貿易、資金流' },
  { id: 'global', name: '港口公告板', island: 'port', kind: 'board', position: [3, 11], covers: '無法對應上述實體的事件' },
];

const BY_ID = new Map(ENTITIES.map((e) => [e.id, e]));

export function isEntityId(id: string): id is EntityId {
  return BY_ID.has(id as EntityId);
}

export function getEntity(id: EntityId): EntityDef {
  const e = BY_ID.get(id);
  if (!e) throw new Error(`unknown entity: ${id}`);
  return e;
}
