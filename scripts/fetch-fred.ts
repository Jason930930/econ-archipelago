/**
 * 每日工作流程（.github/workflows/fred.yml）用：從 FRED 下載節點狀態需要的序列，
 * 只保留每週五的樣本與最新值，寫入 data/state/fred.json。
 * 單一序列失敗時沿用舊檔中的該序列；全部失敗時不寫檔並以代碼 1 結束。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSeries, type FredFile, type FredSeries, type Point } from '../src/data/fredFile';
import { FRED_SERIES, fredSeriesSource } from '../src/world/stateSources';

const OUT = 'data/state/fred.json';
const YEARS = 6;

export function parseFredCsv(text: string): Point[] {
  const out: Point[] = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    const [date, raw] = line.split(',');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || raw === undefined) continue;
    const v = Number(raw);
    if (raw.trim() === '.' || raw.trim() === '' || !Number.isFinite(v)) continue;
    out.push([date, v]);
  }
  return out;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(new Date(Date.parse(`${s}T00:00:00Z`) + n * 86_400_000));

/** 日資料：每個週五取「當天或之前的最後一筆」（保留觀測日，連續重複只留一次）；月資料原樣。 */
export function weeklySamples(points: Point[], cadence: 'daily' | 'monthly'): Point[] {
  if (cadence === 'monthly' || points.length === 0) return [...points];
  const first = points[0]![0];
  const last = points.at(-1)![0];
  const dow = new Date(`${first}T00:00:00Z`).getUTCDay();
  let friday = addDays(first, (5 - dow + 7) % 7);
  const out: Point[] = [];
  let i = 0;
  while (friday <= last) {
    while (i + 1 < points.length && points[i + 1]![0] <= friday) i++;
    const p = points[i]!;
    if (p[0] <= friday && out.at(-1)?.[0] !== p[0]) out.push(p);
    friday = addDays(friday, 7);
  }
  return out;
}

/** 每個序列一行，讓每日提交的差異看得懂。 */
export function formatFredFile(f: FredFile): string {
  const rows = Object.entries(f.series).map(([id, s]) => `    ${JSON.stringify(id)}: ${JSON.stringify(s)}`);
  return `{\n  "fetchedAt": ${JSON.stringify(f.fetchedAt)},\n  "series": {\n${rows.join(',\n')}\n  }\n}\n`;
}

/** 下載起點：今天與最舊週檔中較早者，再往前 6 年（5 年百分位視窗＋1 年 YoY），讓舊週的狀態不會隨時間漂移。 */
export function startDate(now: Date, earliestWeek?: string): string {
  const today = iso(now);
  const base = earliestWeek && earliestWeek < today ? earliestWeek : today;
  return `${Number(base.slice(0, 4)) - YEARS}${base.slice(4)}`;
}

export function fredCsvUrl(id: string, now: Date, earliestWeek?: string): string {
  return `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}&cosd=${startDate(now, earliestWeek)}`;
}

export async function fetchAll(opts: {
  fetchText(url: string): Promise<string>;
  previous: FredFile | null;
  now: Date;
  /** 檔案庫中最舊的週（weekId）。 */
  earliestWeek?: string;
}): Promise<{ file: FredFile | null; warnings: string[] }> {
  const series: Record<string, FredSeries> = {};
  const warnings: string[] = [];
  let fetched = 0;
  for (const id of FRED_SERIES) {
    const cadence = fredSeriesSource(id)!.cadence;
    let next: FredSeries | null = null;
    let problem = '';
    try {
      const pts = parseFredCsv(await opts.fetchText(fredCsvUrl(id, opts.now, opts.earliestWeek)));
      if (pts.length === 0) problem = '沒有任何觀測值';
      else {
        next = { cadence, latest: pts.at(-1)!, samples: weeklySamples(pts, cadence) };
        if (next.samples.length === 0) next.samples = [next.latest];
        const issues = checkSeries(id, next);
        if (issues.length) { problem = issues.join('；'); next = null; }
      }
    } catch (e) {
      problem = `下載失敗：${(e as Error).message}`;
    }
    if (next) {
      series[id] = next;
      fetched++;
    } else {
      const prev = opts.previous?.series[id];
      if (prev) series[id] = prev;
      warnings.push(`${id}：${problem}${prev ? '（沿用舊資料）' : '（沒有舊資料，略過）'}`);
    }
  }
  if (fetched === 0) return { file: null, warnings };
  // 資料完全沒變時沿用舊檔（含 fetchedAt），工作流程就不會提交、也不會部署。
  const prev = opts.previous;
  if (prev && Object.keys(prev.series).length === Object.keys(series).length && Object.entries(series).every(([id, s]) => JSON.stringify(prev.series[id]) === JSON.stringify(s))) {
    return { file: prev, warnings };
  }
  return { file: { fetchedAt: opts.now.toISOString(), series }, warnings };
}

async function fetchText(url: string): Promise<string> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const previous = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as FredFile) : null;
  const earliestWeek = readdirSync('data/weeks').filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort()[0]?.slice(0, 10);
  const { file, warnings } = await fetchAll({ fetchText, previous, now: new Date(), earliestWeek });
  for (const w of warnings) console.warn(`⚠ ${w}`);
  if (!file) {
    console.error('✗ 所有 FRED 序列都抓取失敗，不更新檔案');
    process.exit(1);
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, formatFredFile(file));
  console.log(`✓ 已更新 ${OUT}（${Object.keys(file.series).length} 個序列）`);
}
