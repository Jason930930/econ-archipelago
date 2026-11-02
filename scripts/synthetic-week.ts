/**
 * 排程演練用：以最新一週為底，產生「下一個週五」的合成週檔，
 * 讓 CI 驗證「多一週資料後」驗證、測試、建置仍全部通過。
 * 只在 CI 的演練 job 或本機使用，產生的檔案不可 commit。
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ProposedChannel, WeekData, WeekEvent } from '../src/data/types';
import { CHANNELS, getChannelNode, touches } from '../src/world/channels';

const SYNTHETIC_ENTITY = { id: 'synthetic-co', name: '演練公司', region: 'in' as const, sector: 'tech' as const, aliases: [] as string[] };

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const slash = (iso: string) => iso.replaceAll('-', '/');
const uniq = (xs: string[]) => [...new Set(xs)];

/** rank 1 事件碰得到的第一條精選管道（找不到就不加）。 */
function channelFor(e: WeekEvent): string[] {
  const c = CHANNELS.find((ch) => [ch.from, ch.to].some((n) => e.places.some((p) => touches(p, getChannelNode(n).path))));
  return uniq([...(e.channels ?? []), ...(c ? [c.id] : [])]);
}

/** 依序取 rank 1 事件的第一組（起點, 終點）：兩者不同，且不是某條精選管道的兩端。 */
function proposalFor(e: WeekEvent): ProposedChannel[] {
  const core = new Set(CHANNELS.map((c) => `${getChannelNode(c.from).path}>${getChannelNode(c.to).path}`));
  for (let i = 0; i < e.places.length; i++) {
    for (let j = i + 1; j < e.places.length; j++) {
      const [fromPath, toPath] = [e.places[i]!, e.places[j]!];
      if (fromPath === toPath || core.has(`${fromPath}>${toPath}`)) continue;
      return [{ id: 'synthetic-proposal', fromPath, toPath, fromVar: '演練起點', toVar: '演練終點', sign: 1, mechanism: '演練用的提議管道。', evidence: [e.id] }];
    }
  }
  return [];
}

/** 純函式：演練 v2 的新實體（rank 1 引用）、新區塊（rank 2 引用日本房地產）、管道標註與提議；路徑一律去重。 */
export function synthesizeNextWeek(w: WeekData): WeekData {
  const end = addDays(w.weekId, 7);
  const start = addDays(end, -6);
  const alreadyHas = (w.newEntities ?? []).some((e) => e.id === SYNTHETIC_ENTITY.id);
  const events = w.events.map((e) => ({
    ...e,
    date: e.date ? addDays(e.date, 7) : null,
    places: uniq(e.rank === 1 ? [...e.places, 'in/tech/synthetic-co'] : e.rank === 2 ? [...e.places, 'jp/real-estate'] : e.places),
  }));
  const r1 = events.find((e) => e.rank === 1);
  if (r1) r1.channels = channelFor(r1);
  return {
    ...w,
    weekId: end,
    period: { start, end },
    title: `財金週報（${slash(start)}–${slash(end)}）【演練】`,
    events,
    newEntities: alreadyHas ? [] : [SYNTHETIC_ENTITY],
    // 只保留演練提議；沿用底週的提議會讓演練週和真實週重複。
    proposedChannels: r1 ? proposalFor(r1) : [],
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
