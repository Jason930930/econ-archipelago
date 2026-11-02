import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildIndex } from '../src/data/buildIndex';
import type { WeekData } from '../src/data/types';
import type { EntityRecord } from '../src/world/registry';

const SRC = 'data/weeks';
const OUT = 'public/data';

const names = readdirSync(SRC).filter((n) => n.endsWith('.json')).sort();
const weeks = names.map((n) => JSON.parse(readFileSync(join(SRC, n), 'utf8')) as WeekData);
const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];
const index = buildIndex(weeks, seed);
const registry = JSON.stringify(index.entities, null, 2) + '\n';
const json = JSON.stringify(index, null, 2) + '\n';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'weeks'), { recursive: true });
writeFileSync('data/index.json', json);
writeFileSync(join(OUT, 'index.json'), json);
writeFileSync('data/world/registry.json', registry);
writeFileSync(join(OUT, 'registry.json'), registry);
for (const n of names) copyFileSync(join(SRC, n), join(OUT, 'weeks', n));
console.log(`✓ 索引已產生：${index.weeks.length} 週、${index.storylines.length} 條主線、${index.entities.length} 個實體`);
