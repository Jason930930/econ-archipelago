import type { IndicatorKey } from '../data/types';
import type { EntityId } from './entities';

/** 地標 ↔ 指標對應（地標面板走勢圖、stale/missing 變暗都用這份）。第一個為主要指標。 */
export const ENTITY_INDICATORS: Partial<Record<EntityId, IndicatorKey[]>> = {
  'me-oil': ['brent'],
  'us-fed': ['fedFunds'],
  'us-bonds': ['us10y'],
  'us-wallst': ['nasdaq', 'sp500'],
  'tw-twse': ['taiex'],
  'gold-vault': ['gold'],
  crypto: ['btc'],
  'tw-cbc': ['usdtwd'],
};

export function primaryIndicator(id: EntityId): IndicatorKey | null {
  return ENTITY_INDICATORS[id]?.[0] ?? null;
}
