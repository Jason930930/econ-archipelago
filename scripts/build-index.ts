import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildIndex } from '../src/data/buildIndex';
import { splitIndex } from '../src/data/splitIndex';
import type { FredFile } from '../src/data/fredFile';
import type { WeekData } from '../src/data/types';
import type { EntityRecord } from '../src/world/registry';

const SRC = 'data/weeks';
const OUT = 'public/data';

const names = readdirSync(SRC).filter((n) => n.endsWith('.json')).sort();
const weeks = names.map((n) => JSON.parse(readFileSync(join(SRC, n), 'utf8')) as WeekData);
const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];
const FRED = 'data/state/fred.json';
const fred = existsSync(FRED) ? (JSON.parse(readFileSync(FRED, 'utf8')) as FredFile) : null;
const index = buildIndex(weeks, seed, fred);
const registry = JSON.stringify(index.entities, null, 2) + '\n';
// 開頁只載入目錄（catalog）；每週的衍生資料另存一檔，切到那週才載入。發佈的 JSON 一律壓縮。
const { catalog, derived } = splitIndex(index);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'weeks'), { recursive: true });
mkdirSync(join(OUT, 'derived'), { recursive: true });
writeFileSync('data/index.json', JSON.stringify(catalog, null, 2) + '\n');
writeFileSync(join(OUT, 'index.json'), JSON.stringify(catalog));
for (const d of derived) writeFileSync(join(OUT, 'derived', `${d.weekId}.json`), JSON.stringify(d));
writeFileSync('data/world/registry.json', registry);
writeFileSync(join(OUT, 'registry.json'), registry);
for (const n of names) copyFileSync(join(SRC, n), join(OUT, 'weeks', n));
console.log(`✓ 索引已產生：${index.weeks.length} 週、${index.storylines.length} 條主線、${index.entities.length} 個實體`);
