import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../../schema/week.schema.json';
import type { WeekData } from './types';
import { isGoogleRedirect } from './urls';

export interface ValidationError {
  file: string;
  path: string;
  message: string;
}

const ajv = new Ajv2020({ allErrors: true, strict: false });

/** 是否為真實存在的日曆日期（排除 2026-02-30 這類）。 */
function isRealDate(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

function isFriday(iso: string): boolean {
  return new Date(`${iso}T00:00:00Z`).getUTCDay() === 5;
}
const checkSchema = ajv.compile(schema);

export function validateWeek(raw: unknown, fileName: string, knownStorylines: ReadonlySet<string>): ValidationError[] {
  const err = (path: string, message: string): ValidationError => ({ file: fileName, path, message });

  if (!checkSchema(raw)) {
    return (checkSchema.errors ?? []).map((e) => {
      const extra = e.keyword === 'additionalProperties' ? `：${String((e.params as { additionalProperty?: string }).additionalProperty)}` : '';
      return err(e.instancePath || '/', `${e.message ?? '格式錯誤'}${extra}`);
    });
  }

  const w = raw as unknown as WeekData;
  const out: ValidationError[] = [];
  const expectedId = fileName.replace(/\.json$/, '');

  const dates: [string, string | null][] = [
    ['/weekId', w.weekId], ['/period/start', w.period.start], ['/period/end', w.period.end],
    ...w.events.map((e, i): [string, string | null] => [`/events/${i}/date`, e.date]),
    ...w.watchlist.map((x, i): [string, string | null] => [`/watchlist/${i}/date`, x.date]),
  ];
  for (const [path, d] of dates) if (d !== null && !isRealDate(d)) out.push(err(path, `「${d}」不是真實存在的日期`));
  if (isRealDate(w.weekId) && !isFriday(w.weekId)) out.push(err('/weekId', `weekId「${w.weekId}」必須是週五`));

  if (w.weekId !== expectedId) out.push(err('/weekId', `weekId「${w.weekId}」必須等於檔名「${expectedId}」`));
  if (w.period.end !== w.weekId) out.push(err('/period/end', 'period.end 必須等於 weekId（週五日期）'));
  if (w.period.start > w.period.end) out.push(err('/period/start', 'period.start 不可晚於 period.end'));

  const ids = new Set<string>();
  const ranks = new Set<number>();
  const n = w.events.length;
  const definedStorylines = new Set([...knownStorylines, ...w.storylines.map((s) => s.id)]);

  w.events.forEach((ev, i) => {
    const p = `/events/${i}`;
    if (ids.has(ev.id)) out.push(err(`${p}/id`, `事件 id「${ev.id}」重複`));
    ids.add(ev.id);
    if (ranks.has(ev.rank)) out.push(err(`${p}/rank`, `rank ${ev.rank} 重複`));
    else if (ev.rank > n) out.push(err(`${p}/rank`, `rank 必須為 1..${n} 連續整數`));
    ranks.add(ev.rank);
    if (!ev.entities.includes(ev.primaryEntity)) out.push(err(`${p}/primaryEntity`, 'primaryEntity 必須包含在 entities 中'));
    ev.storylines.forEach((s, j) => {
      if (!definedStorylines.has(s)) out.push(err(`${p}/storylines/${j}`, `主線「${s}」未定義：首次使用時必須在 storylines 提供名稱`));
    });
    ev.sources.forEach((s, j) => {
      if (isGoogleRedirect(s.url)) out.push(err(`${p}/sources/${j}/url`, '來源網址不可為 Google 轉址，請改存原始網址'));
    });
  });

  w.links.forEach((l, i) => {
    const p = `/links/${i}`;
    if (!ids.has(l.from)) out.push(err(`${p}/from`, `找不到事件「${l.from}」`));
    if (!ids.has(l.to)) out.push(err(`${p}/to`, `找不到事件「${l.to}」`));
    if (l.from === l.to) out.push(err(p, '因果連線的 from 與 to 不可相同'));
  });

  return out;
}

export function validateArchive(files: { fileName: string; raw: unknown }[]): ValidationError[] {
  const sorted = [...files].sort((a, b) => a.fileName.localeCompare(b.fileName));
  const known = new Set<string>();
  const seen = new Set<string>();
  const out: ValidationError[] = [];
  for (const f of sorted) {
    if (seen.has(f.fileName)) {
      out.push({ file: f.fileName, path: '/weekId', message: '同一週有重複的檔案' });
      continue;
    }
    seen.add(f.fileName);
    const errs = validateWeek(f.raw, f.fileName, known);
    out.push(...errs);
    if (errs.length === 0) for (const s of (f.raw as WeekData).storylines) known.add(s.id);
  }
  return out;
}
