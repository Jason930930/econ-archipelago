import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildIndex } from '../src/data/buildIndex';
import type { WeekData } from '../src/data/types';

const SRC = 'data/weeks';
const OUT = 'public/data';

const names = readdirSync(SRC).filter((n) => n.endsWith('.json')).sort();
const weeks = names.map((n) => JSON.parse(readFileSync(join(SRC, n), 'utf8')) as WeekData);
const index = buildIndex(weeks);
const json = JSON.stringify(index, null, 2) + '\n';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'weeks'), { recursive: true });
writeFileSync('data/index.json', json);
writeFileSync(join(OUT, 'index.json'), json);
for (const n of names) copyFileSync(join(SRC, n), join(OUT, 'weeks', n));
console.log(`✓ 索引已產生：${index.weeks.length} 週、${index.storylines.length} 條主線`);
