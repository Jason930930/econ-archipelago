/**
 * 排程演練用：以最新一週為底，產生「下一個週五」的合成週檔，
 * 讓 CI 驗證「多一週資料後」驗證、測試、建置仍全部通過。
 * 只在 CI 的演練 job 或本機使用，產生的檔案不可 commit。
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { WeekData } from '../src/data/types';

const SYNTHETIC_ENTITY = { id: 'synthetic-co', name: '演練公司', region: 'in' as const, sector: 'tech' as const, aliases: [] as string[] };

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const slash = (iso: string) => iso.replaceAll('-', '/');
const uniq = (xs: string[]) => [...new Set(xs)];

/** 純函式：演練 v2 的新實體（rank 1 引用）與新區塊（rank 2 引用日本房地產）；路徑一律去重。 */
export function synthesizeNextWeek(w: WeekData): WeekData {
  const end = addDays(w.weekId, 7);
  const start = addDays(end, -6);
  const alreadyHas = (w.newEntities ?? []).some((e) => e.id === SYNTHETIC_ENTITY.id);
  return {
    ...w,
    weekId: end,
    period: { start, end },
    title: `財金週報（${slash(start)}–${slash(end)}）【演練】`,
    events: w.events.map((e) => ({
      ...e,
      date: e.date ? addDays(e.date, 7) : null,
      places: uniq(e.rank === 1 ? [...e.places, 'in/tech/synthetic-co'] : e.rank === 2 ? [...e.places, 'jp/real-estate'] : e.places),
    })),
    newEntities: alreadyHas ? [] : [SYNTHETIC_ENTITY],
    storylines: [],
    watchlist: w.watchlist.map((x) => ({ ...x, date: x.date ? addDays(x.date, 7) : null })),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const DIR = 'data/weeks';
  const latest = readdirSync(DIR).filter((n) => n.endsWith('.json')).sort().at(-1);
  if (!latest) throw new Error('沒有週資料');
  const next = synthesizeNextWeek(JSON.parse(readFileSync(`${DIR}/${latest}`, 'utf8')) as WeekData);
  writeFileSync(`${DIR}/${next.weekId}.json`, JSON.stringify(next, null, 2) + '\n');
  console.log(`✓ 已產生演練週 ${DIR}/${next.weekId}.json`);
}
