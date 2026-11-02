/**
 * 一次性遷移：v1 週檔（地標 id）→ v2（路徑）。純對照轉換，不做人工細修。
 * 用法：npx tsx scripts/migrate-v1-to-v2.ts [資料夾=data/weeks]  （原地改寫 schemaVersion 1 的檔案）
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WeekData } from '../src/data/types';

export const V1_TO_V2: Record<string, string> = {
  'us-fed': 'us/central-bank',
  'us-wallst': 'us/equity',
  'us-bonds': 'us/bonds',
  'us-tech': 'us/tech',
  'tw-cbc': 'tw/central-bank',
  'tw-twse': 'tw/equity',
  'tw-fab': 'tw/semiconductor',
  'kr-memory': 'kr/memory',
  'me-oil': 'gulf/energy',
  'eu-ecb': 'ez/central-bank',
  'jp-boj': 'jp/central-bank',
  'cn-industry': 'cn/industry',
  'gold-vault': 'intl/commodities/gold',
  crypto: 'intl/crypto/bitcoin',
  'sea-hormuz': 'seas/shipping-lane/hormuz',
  'sea-pacific': 'seas/shipping-lane/pacific',
  global: 'intl/organization',
};

function map(id: string): string {
  const p = V1_TO_V2[id];
  if (!p) throw new Error(`未知的 v1 地標 id「${id}」`);
  return p;
}

type V1Event = Record<string, unknown> & { primaryEntity: string; entities: string[] };
type V1Watch = { date: string | null; text: string; entities: string[]; confirmed: boolean };

export function migrateWeek(raw: unknown): WeekData {
  const w = structuredClone(raw) as Record<string, unknown> & { events: V1Event[]; watchlist: V1Watch[] };
  const events = w.events.map((e) => {
    const { primaryEntity, entities, ...rest } = e;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      out[k] = v;
      if (k === 'taiwanImpact') {
        out.primary = map(primaryEntity);
        out.places = [...new Set(entities.map(map))];
      }
    }
    return out;
  });
  const watchlist = w.watchlist.map((x) => ({ date: x.date, text: x.text, places: [...new Set(x.entities.map(map))], confirmed: x.confirmed }));
  return { ...w, schemaVersion: 2, events, watchlist } as unknown as WeekData;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = process.argv[2] ?? 'data/weeks';
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    const file = join(dir, name);
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { schemaVersion?: number };
    if (raw.schemaVersion !== 1) continue;
    writeFileSync(file, JSON.stringify(migrateWeek(raw), null, 2) + '\n');
    console.log(`✓ 已遷移 ${file}`);
  }
}
