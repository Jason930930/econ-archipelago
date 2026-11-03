import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../../schema/fred.schema.json';
import { FRED_SERIES, fredSeriesSource } from '../world/stateSources';

export type Point = [string, number];

export interface FredSeries {
  cadence: 'daily' | 'monthly';
  /** 最新一筆觀測值。 */
  latest: Point;
  /** 日資料：每週五當天或之前的最後一筆觀測（保留觀測日）；月資料：全部月點。 */
  samples: Point[];
}

export interface FredFile {
  fetchedAt: string;
  series: Record<string, FredSeries>;
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
const checkSchema = ajv.compile(schema);

/** 單一序列的合理性檢查；回傳問題清單（空 = 通過）。 */
export function checkSeries(id: string, s: FredSeries): string[] {
  const out: string[] = [];
  const src = fredSeriesSource(id);
  const pts = [...s.samples, s.latest];
  if (s.samples.length === 0) out.push(`${id}：沒有任何樣本`);
  if (pts.some(([, v]) => !Number.isFinite(v))) out.push(`${id}：含非有限數值`);
  for (let i = 1; i < s.samples.length; i++) {
    if (s.samples[i]![0] <= s.samples[i - 1]![0]) {
      out.push(`${id}：樣本日期必須遞增（${s.samples[i - 1]![0]} → ${s.samples[i]![0]}）`);
      break;
    }
  }
  const last = s.samples.at(-1);
  if (last && s.latest[0] < last[0]) out.push(`${id}：latest 不可早於最後一個樣本`);
  if (src) {
    const [lo, hi] = src.sane;
    const bad = pts.find(([, v]) => Number.isFinite(v) && (v < lo || v > hi));
    if (bad) out.push(`${id}：${bad[0]} 的數值 ${bad[1]} 超出合理範圍 ${lo}–${hi}`);
  }
  return out;
}

/** 檔案層級驗證：schema 與每個既有序列的合理性。缺少的序列不算錯（網站顯示「未知」），見 fredFileWarnings。 */
export function validateFredFile(raw: unknown): string[] {
  if (!checkSchema(raw)) return (checkSchema.errors ?? []).map((e) => `fred.json ${e.instancePath || '/'}: ${e.message ?? '格式錯誤'}`);
  const f = raw as unknown as FredFile;
  const out: string[] = [];
  for (const [id, s] of Object.entries(f.series)) if (fredSeriesSource(id)) out.push(...checkSeries(id, s));
  return out;
}

/** 來源表需要、但檔案裡還沒有的序列（例如剛新增的序列第一次抓取失敗）：只提醒，不擋建置。 */
export function fredFileWarnings(f: FredFile): string[] {
  return FRED_SERIES.filter((id) => !f.series[id]).map((id) => `fred.json 缺少序列 ${id}（相關節點會顯示「未知」）`);
}
