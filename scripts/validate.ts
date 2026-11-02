import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { validateFredFile } from '../src/data/fredFile';
import { join } from 'node:path';
import { validateArchive, type ValidationError } from '../src/data/validate';
import { checkNewEntities, type EntityRecord } from '../src/world/registry';

const dir = process.argv[2] ?? 'data/weeks';
let names: string[] = [];
try {
  names = readdirSync(dir).filter((n) => n.endsWith('.json'));
} catch {
  console.error(`✗ 找不到資料夾 ${dir}`);
  process.exit(1);
}
if (names.length === 0) {
  console.error(`✗ ${dir} 中沒有週資料`);
  process.exit(1);
}

const parseErrors: ValidationError[] = [];
const files = names.flatMap((fileName) => {
  try {
    return [{ fileName, raw: JSON.parse(readFileSync(join(dir, fileName), 'utf8')) as unknown }];
  } catch (e) {
    parseErrors.push({ file: fileName, path: '/', message: `JSON 解析失敗：${(e as Error).message}` });
    return [];
  }
});

const SEED = process.env.SEED_FILE ?? 'data/world/entities.json';
let seed: EntityRecord[] = [];
try {
  seed = JSON.parse(readFileSync(SEED, 'utf8')) as EntityRecord[];
} catch (e) {
  parseErrors.push({ file: 'entities.json', path: '/', message: `種子實體檔讀取失敗：${(e as Error).message}` });
}
const seedErrors: ValidationError[] = checkNewEntities([], seed).map((i) => ({ file: 'entities.json', path: `/${i.index}/${i.field}`, message: i.message }));

// FRED 快照（子專案 3）：存在時一併驗證；不存在時只提醒，網站會把 FRED 節點顯示為「未知」。
const FRED = process.env.FRED_FILE ?? 'data/state/fred.json';
const fredErrors: ValidationError[] = [];
if (existsSync(FRED)) {
  try {
    for (const m of validateFredFile(JSON.parse(readFileSync(FRED, 'utf8')))) fredErrors.push({ file: 'fred.json', path: '/', message: m });
  } catch (e) {
    fredErrors.push({ file: 'fred.json', path: '/', message: `JSON 解析失敗：${(e as Error).message}` });
  }
} else {
  console.log(`（尚無 ${FRED}）`);
}

const errors = [...parseErrors, ...seedErrors, ...fredErrors, ...validateArchive(files, seed)];
if (errors.length > 0) {
  for (const e of errors) console.error(`${e.file} ${e.path}: ${e.message}`);
  console.error(`✗ ${errors.length} 個錯誤`);
  process.exit(1);
}
console.log(`✓ ${files.length} 週資料驗證通過`);
