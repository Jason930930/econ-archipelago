import type { IndicatorKey } from '../data/types';
import { isWithin } from './paths';

/**
 * 常駐傳導網絡（精選、需要審查）：節點是「位置上的狀態變數」，管道是教科書層級的定性傳導關係。
 * 方向與強度不是量化模型或預測。排程只能標註這裡的管道，或在週檔提議新管道等待審閱。
 */

export type ChannelFamily = 'energy-inflation' | 'monetary' | 'markets' | 'flows-fx' | 'supply-chain' | 'geopolitics' | 'policy-trade';

export const FAMILY_INFO: Record<ChannelFamily, { name: string; color: string }> = {
  'energy-inflation': { name: '能源與通膨', color: '#f08c2e' },
  monetary: { name: '貨幣政策', color: '#3a7bd5' },
  markets: { name: '金融市場', color: '#2fa36b' },
  'flows-fx': { name: '資金流與匯率', color: '#1fb5b5' },
  'supply-chain': { name: '供應鏈與產業', color: '#8e6cc2' },
  geopolitics: { name: '地緣與航運', color: '#e5484d' },
  'policy-trade': { name: '政策與貿易', color: '#d9b52c' },
};

export const LAG_LABEL = { days: '數日', weeks: '數週', months: '數月' } as const;

export interface ChannelNode {
  id: string;
  path: string;
  name: string;
  indicator?: IndicatorKey;
  /** 指標方向與變數方向相反時為 -1（例：新台幣強弱 vs usdtwd）。 */
  indicatorSign?: 1 | -1;
}

export interface Channel {
  id: string;
  from: string;
  to: string;
  sign: 1 | -1;
  strength: 1 | 2 | 3;
  lag: keyof typeof LAG_LABEL;
  family: ChannelFamily;
  mechanism: string;
}

export const CHANNEL_NODES: readonly ChannelNode[] = [
  { id: 'gulf.oil-price', path: 'gulf/energy', name: '油價', indicator: 'brent' },
  { id: 'gulf.geopolitics', path: 'gulf/government', name: '中東地緣衝突' },
  { id: 'intl.opec-supply', path: 'intl/organization/opec', name: 'OPEC+ 供給' },
  { id: 'seas.hormuz-risk', path: 'seas/shipping-lane/hormuz', name: '荷莫茲航運風險' },
  { id: 'seas.red-sea-risk', path: 'seas/shipping-lane/red-sea', name: '紅海航運風險' },
  { id: 'us.inflation', path: 'us', name: '美國通膨', indicator: 'cpiYoY' },
  { id: 'us.policy-rate', path: 'us/central-bank', name: 'Fed 政策利率', indicator: 'fedFunds' },
  { id: 'us.long-yield', path: 'us/bonds', name: '美債長天期殖利率', indicator: 'us10y' },
  { id: 'us.dollar', path: 'us/fx', name: '美元強弱' },
  { id: 'us.equity', path: 'us/equity', name: '美股大盤', indicator: 'sp500' },
  { id: 'us.tech-valuation', path: 'us/tech', name: '美國科技股估值', indicator: 'nasdaq' },
  { id: 'us.ai-capex', path: 'us/tech', name: 'AI 資本支出' },
  { id: 'us.tariff', path: 'us/trade', name: '美國關稅' },
  { id: 'us.fiscal', path: 'us/government', name: '美國財政赤字' },
  { id: 'ez.inflation', path: 'ez', name: '歐元區通膨' },
  { id: 'ez.policy-rate', path: 'ez/central-bank', name: 'ECB 政策利率' },
  { id: 'ez.energy-cost', path: 'ez/energy', name: '歐洲能源成本' },
  { id: 'ru.energy-supply', path: 'ru/energy', name: '俄羅斯能源供給' },
  { id: 'jp.policy-rate', path: 'jp/central-bank', name: '日銀政策利率' },
  { id: 'jp.yen', path: 'jp/fx', name: '日圓強弱' },
  { id: 'cn.industry', path: 'cn/industry', name: '中國製造業' },
  { id: 'cn.real-estate', path: 'cn/real-estate', name: '中國房地產' },
  { id: 'kr.memory', path: 'kr/memory', name: '韓國記憶體景氣' },
  { id: 'kr.equity', path: 'kr/equity', name: '韓股' },
  { id: 'au.commodities', path: 'au/commodities', name: '澳洲原物料出口' },
  { id: 'intl.gold', path: 'intl/commodities/gold', name: '金價', indicator: 'gold' },
  { id: 'intl.bitcoin', path: 'intl/crypto/bitcoin', name: '比特幣', indicator: 'btc' },
  { id: 'intl.risk-appetite', path: 'intl', name: '全球風險偏好' },
  { id: 'tw.semis', path: 'tw/semiconductor', name: '台灣半導體景氣' },
  { id: 'tw.tsmc', path: 'tw/semiconductor/tsmc', name: '台積電營運' },
  { id: 'tw.equity', path: 'tw/equity', name: '台股', indicator: 'taiex' },
  { id: 'tw.foreign-flow', path: 'tw/equity', name: '外資買賣超' },
  { id: 'tw.twd', path: 'tw/fx', name: '新台幣強弱', indicator: 'usdtwd', indicatorSign: -1 },
  { id: 'tw.policy-rate', path: 'tw/central-bank', name: '台灣央行利率' },
  { id: 'tw.exports', path: 'tw/trade', name: '台灣出口' },
  { id: 'tw.strait-risk', path: 'seas/shipping-lane/taiwan-strait', name: '台海緊張' },
];

const c = (id: string, from: string, to: string, sign: 1 | -1, strength: 1 | 2 | 3, lag: Channel['lag'], family: ChannelFamily, mechanism: string): Channel =>
  ({ id, from, to, sign, strength, lag, family, mechanism });

export const CHANNELS: readonly Channel[] = [
  c('mideast-to-hormuz', 'gulf.geopolitics', 'seas.hormuz-risk', 1, 3, 'days', 'geopolitics', '衝突升溫使油輪遇襲與保險成本上升，海峽通行風險升高。'),
  c('hormuz-to-oil', 'seas.hormuz-risk', 'gulf.oil-price', 1, 3, 'days', 'energy-inflation', '全球約五分之一原油經荷莫茲海峽，運輸中斷風險直接推升油價。'),
  c('opec-to-oil', 'intl.opec-supply', 'gulf.oil-price', -1, 3, 'weeks', 'energy-inflation', '減產使市場供給縮減，油價上升；增產則壓低油價。'),
  c('red-sea-to-us-inflation', 'seas.red-sea-risk', 'us.inflation', 1, 1, 'months', 'geopolitics', '繞道好望角拉長航程、推高運費與進口成本。'),
  c('mideast-to-gold', 'gulf.geopolitics', 'intl.gold', 1, 2, 'days', 'geopolitics', '避險需求升溫，資金流向黃金。'),
  c('russia-to-eu-energy', 'ru.energy-supply', 'ez.energy-cost', -1, 3, 'weeks', 'geopolitics', '俄國天然氣與原油供給減少，歐洲能源價格上升。'),
  c('oil-to-us-inflation', 'gulf.oil-price', 'us.inflation', 1, 3, 'weeks', 'energy-inflation', '汽油與運輸成本直接計入 CPI，並透過生產成本間接推升核心物價。'),
  c('oil-to-eu-energy', 'gulf.oil-price', 'ez.energy-cost', 1, 2, 'weeks', 'energy-inflation', '歐洲高度依賴進口能源，油價上升直接墊高能源成本。'),
  c('eu-energy-to-ez-inflation', 'ez.energy-cost', 'ez.inflation', 1, 3, 'weeks', 'energy-inflation', '能源在歐元區 HICP 權重高，成本上升直接反映在物價。'),
  c('us-inflation-to-fed', 'us.inflation', 'us.policy-rate', 1, 3, 'months', 'monetary', '通膨高於目標時，Fed 傾向升息或延後降息。'),
  c('fed-to-us-yield', 'us.policy-rate', 'us.long-yield', 1, 3, 'days', 'monetary', '政策利率預期上升，帶動整條殖利率曲線走高。'),
  c('fed-to-dollar', 'us.policy-rate', 'us.dollar', 1, 2, 'days', 'monetary', '美國利率相對走高，吸引資金流入美元資產。'),
  c('fiscal-to-us-yield', 'us.fiscal', 'us.long-yield', 1, 2, 'weeks', 'policy-trade', '赤字擴大增加公債供給，投資人要求更高的期限溢酬。'),
  c('ez-inflation-to-ecb', 'ez.inflation', 'ez.policy-rate', 1, 3, 'months', 'monetary', '通膨高於目標時，ECB 傾向維持緊縮。'),
  c('boj-to-yen', 'jp.policy-rate', 'jp.yen', 1, 2, 'days', 'monetary', '日銀升息縮小與海外的利差，日圓走強。'),
  c('us-yield-to-yen', 'us.long-yield', 'jp.yen', -1, 2, 'days', 'flows-fx', '美日利差擴大鼓勵套利交易，日圓走弱。'),
  c('fed-to-tw-policy-rate', 'us.policy-rate', 'tw.policy-rate', 1, 1, 'months', 'monetary', '台灣央行需兼顧台美利差與資金外流壓力，常跟隨 Fed 方向。'),
  c('us-yield-to-tech', 'us.long-yield', 'us.tech-valuation', -1, 3, 'days', 'markets', '折現率上升，壓縮高成長股的未來現金流現值。'),
  c('us-yield-to-gold', 'us.long-yield', 'intl.gold', -1, 2, 'days', 'markets', '實質利率上升提高持有黃金的機會成本。'),
  c('tech-to-us-equity', 'us.tech-valuation', 'us.equity', 1, 3, 'days', 'markets', '科技股在 S&P 500 權重高，帶動大盤。'),
  c('us-equity-to-tw-equity', 'us.equity', 'tw.equity', 1, 3, 'days', 'markets', '台股與美股（尤其科技股）連動度高，美股大跌常隔日反映。'),
  c('us-equity-to-kr-equity', 'us.equity', 'kr.equity', 1, 2, 'days', 'markets', '全球風險情緒與科技股連動帶動韓股。'),
  c('us-equity-to-risk', 'us.equity', 'intl.risk-appetite', 1, 2, 'days', 'markets', '美股下跌常引發全球去槓桿與風險趨避。'),
  c('risk-to-bitcoin', 'intl.risk-appetite', 'intl.bitcoin', 1, 2, 'days', 'markets', '加密資產屬高風險資產，隨風險偏好起伏。'),
  c('dollar-to-twd', 'us.dollar', 'tw.twd', -1, 3, 'days', 'flows-fx', '美元走強時，新台幣通常走弱。'),
  c('dollar-to-gold', 'us.dollar', 'intl.gold', -1, 2, 'days', 'flows-fx', '金價以美元計價，美元走強壓抑金價。'),
  c('us-yield-to-foreign-flow', 'us.long-yield', 'tw.foreign-flow', -1, 2, 'weeks', 'flows-fx', '美國利率走高吸引資金回流美國，外資賣超新興市場。'),
  c('foreign-flow-to-tw-equity', 'tw.foreign-flow', 'tw.equity', 1, 3, 'days', 'flows-fx', '外資是台股主要成交力量，大額賣超直接壓抑指數。'),
  c('foreign-flow-to-twd', 'tw.foreign-flow', 'tw.twd', 1, 3, 'days', 'flows-fx', '外資匯出需賣新台幣換美元，造成新台幣貶值。'),
  c('ai-capex-to-tw-semis', 'us.ai-capex', 'tw.semis', 1, 3, 'months', 'supply-chain', '雲端業者的 AI 資本支出決定先進製程與封裝的訂單。'),
  c('ai-capex-to-kr-memory', 'us.ai-capex', 'kr.memory', 1, 3, 'months', 'supply-chain', 'AI 伺服器帶動 HBM 與高階 DRAM 需求。'),
  c('tw-semis-to-tw-equity', 'tw.semis', 'tw.equity', 1, 3, 'weeks', 'supply-chain', '半導體佔台股權重過半，景氣變化直接反映在指數。'),
  c('tsmc-to-tw-equity', 'tw.tsmc', 'tw.equity', 1, 3, 'days', 'supply-chain', '台積電單一個股約佔加權指數三成權重。'),
  c('tw-semis-to-exports', 'tw.semis', 'tw.exports', 1, 3, 'months', 'supply-chain', '電子零組件與資通訊產品佔台灣出口大宗。'),
  c('kr-memory-to-kr-equity', 'kr.memory', 'kr.equity', 1, 2, 'weeks', 'supply-chain', 'Samsung、SK Hynix 在韓股權重高。'),
  c('cn-industry-to-au', 'cn.industry', 'au.commodities', 1, 2, 'months', 'supply-chain', '中國是澳洲鐵礦砂與煤炭的最大買家。'),
  c('cn-property-to-industry', 'cn.real-estate', 'cn.industry', 1, 2, 'months', 'supply-chain', '房地產牽動鋼鐵、建材與家電等上游製造需求。'),
  c('strait-to-tw-equity', 'tw.strait-risk', 'tw.equity', -1, 3, 'days', 'geopolitics', '地緣風險升溫，外資降低台灣資產曝險。'),
  c('tariff-to-cn-industry', 'us.tariff', 'cn.industry', -1, 2, 'months', 'policy-trade', '關稅提高壓抑對美出口訂單。'),
  c('tariff-to-us-inflation', 'us.tariff', 'us.inflation', 1, 2, 'months', 'policy-trade', '進口成本部分轉嫁給消費者。'),
];

const NODE_BY_ID = new Map(CHANNEL_NODES.map((n) => [n.id, n]));
const CHANNEL_BY_ID = new Map(CHANNELS.map((ch) => [ch.id, ch]));

export function getChannelNode(id: string): ChannelNode {
  const n = NODE_BY_ID.get(id);
  if (!n) throw new Error(`unknown channel node: ${id}`);
  return n;
}

export function isChannelNodeId(id: string): boolean {
  return NODE_BY_ID.has(id);
}

export function getChannel(id: string): Channel | undefined {
  return CHANNEL_BY_ID.get(id);
}

export function isChannelId(s: string): boolean {
  return CHANNEL_BY_ID.has(s);
}

/** 事件地點 place 是否「碰到」節點路徑：兩者相等或互為上下層。 */
export function touches(place: string, nodePath: string): boolean {
  return isWithin(place, nodePath) || isWithin(nodePath, place);
}

/** 任一端節點位於 path（含其下層）的管道。 */
export function channelsTouching(path: string): Channel[] {
  return CHANNELS.filter((ch) => isWithin(getChannelNode(ch.from).path, path) || isWithin(getChannelNode(ch.to).path, path));
}
