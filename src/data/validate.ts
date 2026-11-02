import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../../schema/week.schema.json';
import { checkNewEntities, mergeRegistry, resolvePath, type EntityRecord } from '../world/registry';
import { CHANNELS, getChannel, getChannelNode, isChannelId, touches } from '../world/channels';
import { PATH_SEGMENT } from '../world/paths';
import type { WeekData, WeekEvent } from './types';
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

export interface ValidateContext {
  knownStorylines: ReadonlySet<string>;
  /** 種子 + 較早週的 newEntities（不含本週）。 */
  entities: EntityRecord[];
  /** 較早週出現過的提議管道（id → 兩端與方向）。 */
  proposals?: ReadonlyMap<string, ProposalKey>;
}

export interface ProposalKey {
  fromPath: string;
  toPath: string;
  sign: 1 | -1;
}

const touchesAny = (ev: WeekEvent | undefined, nodePath: string) => !!ev && ev.places.some((p) => touches(p, nodePath));

export const V1_HINT = '請使用 schemaVersion 2（見 docs/WEEKLY_DATA_GUIDE.md）';

export function validateWeek(raw: unknown, fileName: string, ctx: ValidateContext): ValidationError[] {
  const err = (path: string, message: string): ValidationError => ({ file: fileName, path, message });
  const { knownStorylines } = ctx;

  if (raw && typeof raw === 'object' && 'schemaVersion' in raw && (raw as { schemaVersion: unknown }).schemaVersion !== 2) {
    return [err('/schemaVersion', `schemaVersion 為 ${String((raw as { schemaVersion: unknown }).schemaVersion)}；${V1_HINT}`)];
  }

  if (!checkSchema(raw)) {
    return (checkSchema.errors ?? []).map((e) => {
      const extra = e.keyword === 'additionalProperties' ? `：${String((e.params as { additionalProperty?: string }).additionalProperty)}` : '';
      return err(e.instancePath || '/', `${e.message ?? '格式錯誤'}${extra}`);
    });
  }

  const w = raw as unknown as WeekData;
  const out: ValidationError[] = [];
  const added = w.newEntities ?? [];
  for (const issue of checkNewEntities(ctx.entities, added)) out.push(err(`/newEntities/${issue.index}/${issue.field}`, issue.message));
  const entities = mergeRegistry(ctx.entities, [{ weekId: w.weekId, newEntities: added }]);
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
  const byId = new Map(w.events.map((e) => [e.id, e] as const));
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
    if (!ev.places.includes(ev.primary)) out.push(err(`${p}/primary`, 'primary 必須包含在 places 中'));
    ev.places.forEach((path, j) => {
      const r = resolvePath(path, entities);
      if (!r.ok) out.push(err(`${p}/places/${j}`, r.reason));
    });
    ev.storylines.forEach((s, j) => {
      if (!definedStorylines.has(s)) out.push(err(`${p}/storylines/${j}`, `主線「${s}」未定義：首次使用時必須在 storylines 提供名稱`));
    });
    ev.sources.forEach((s, j) => {
      if (isGoogleRedirect(s.url)) out.push(err(`${p}/sources/${j}/url`, '來源網址不可為 Google 轉址，請改存原始網址'));
    });
  });

  w.watchlist.forEach((x, i) => x.places.forEach((path, j) => {
    const r = resolvePath(path, entities);
    if (!r.ok) out.push(err(`/watchlist/${i}/places/${j}`, r.reason));
  }));

  w.links.forEach((l, i) => {
    const p = `/links/${i}`;
    if (!ids.has(l.from)) out.push(err(`${p}/from`, `找不到事件「${l.from}」`));
    if (!ids.has(l.to)) out.push(err(`${p}/to`, `找不到事件「${l.to}」`));
    if (l.from === l.to) out.push(err(p, '因果連線的 from 與 to 不可相同'));
    if (l.channel === undefined) return;
    if (!isChannelId(l.channel)) { out.push(err(`${p}/channel`, `找不到精選管道「${l.channel}」`)); return; }
    const c = getChannel(l.channel)!;
    const from = getChannelNode(c.from), to = getChannelNode(c.to);
    const evFrom = byId.get(l.from), evTo = byId.get(l.to);
    if (evFrom && !touchesAny(evFrom, from.path)) out.push(err(`${p}/channel`, `管道「${c.id}」的起點「${from.path}」沒有碰到事件 ${l.from} 的任何 place`));
    if (evTo && !touchesAny(evTo, to.path)) out.push(err(`${p}/channel`, `管道「${c.id}」的終點「${to.path}」沒有碰到事件 ${l.to} 的任何 place`));
  });

  w.events.forEach((ev, i) => {
    const seenCh = new Set<string>();
    (ev.channels ?? []).forEach((id, j) => {
      const p = `/events/${i}/channels`;
      if (seenCh.has(id)) out.push(err(p, `管道「${id}」在同一則事件重複`));
      seenCh.add(id);
      if (!isChannelId(id)) { out.push(err(`${p}/${j}`, `找不到精選管道「${id}」`)); return; }
      const c = getChannel(id)!;
      const ends = [getChannelNode(c.from).path, getChannelNode(c.to).path];
      if (!ends.some((n) => touchesAny(ev, n))) out.push(err(`${p}/${j}`, `事件的 place 沒有碰到管道「${id}」的起點或終點（${ends.join('、')}）`));
    });
  });

  const propIds = new Set<string>();
  (w.proposedChannels ?? []).forEach((pc, i) => {
    const p = `/proposedChannels/${i}`;
    if (propIds.has(pc.id)) out.push(err(`${p}/id`, `提議 id「${pc.id}」在本週重複`));
    propIds.add(pc.id);
    if (!PATH_SEGMENT.test(pc.id)) out.push(err(`${p}/id`, `提議 id「${pc.id}」必須是小寫英文、數字與連字號`));
    // 已收錄：精選管道沿用提議的 id 與兩端。較早週的提議保持原樣，不算錯。
    const core = getChannel(pc.id);
    const promoted = !!core && getChannelNode(core.from).path === pc.fromPath && getChannelNode(core.to).path === pc.toPath;
    if (core && !promoted) out.push(err(`${p}/id`, `「${pc.id}」已是精選管道，請改用 links[].channel 或 events[].channels`));
    const rFrom = resolvePath(pc.fromPath, entities);
    if (!rFrom.ok) out.push(err(`${p}/fromPath`, rFrom.reason));
    const rTo = resolvePath(pc.toPath, entities);
    if (!rTo.ok) out.push(err(`${p}/toPath`, rTo.reason));
    if (pc.fromPath === pc.toPath) out.push(err(`${p}/toPath`, 'fromPath 與 toPath 不可相同'));
    for (const f of ['fromVar', 'toVar', 'mechanism'] as const) if (pc[f].trim() === '') out.push(err(`${p}/${f}`, `${f} 不可為空`));
    const dup = CHANNELS.filter((c) => c.id !== pc.id && getChannelNode(c.from).path === pc.fromPath && getChannelNode(c.to).path === pc.toPath).map((c) => c.id);
    if (dup.length > 0) out.push(err(p, `這組起點與終點已有精選管道：${dup.join('、')}，請改用精選管道`));
    pc.evidence.forEach((eid, j) => {
      const ev = byId.get(eid);
      if (!ev) out.push(err(`${p}/evidence/${j}`, `找不到事件「${eid}」`));
      else if (!touchesAny(ev, pc.fromPath) && !touchesAny(ev, pc.toPath)) out.push(err(`${p}/evidence/${j}`, `事件 ${eid} 的 place 沒有碰到 fromPath 或 toPath`));
    });
    const prev = ctx.proposals?.get(pc.id);
    if (prev && (prev.fromPath !== pc.fromPath || prev.toPath !== pc.toPath || prev.sign !== pc.sign)) {
      out.push(err(p, `提議「${pc.id}」與較早週不一致（較早為 ${prev.fromPath} → ${prev.toPath}，方向 ${prev.sign}）`));
    }
  });

  return out;
}

export function validateArchive(files: { fileName: string; raw: unknown }[], seed: EntityRecord[]): ValidationError[] {
  const sorted = [...files].sort((a, b) => a.fileName.localeCompare(b.fileName));
  const known = new Set<string>();
  let entities = [...seed];
  const proposals = new Map<string, ProposalKey>();
  const seen = new Set<string>();
  const out: ValidationError[] = [];
  for (const f of sorted) {
    if (seen.has(f.fileName)) {
      out.push({ file: f.fileName, path: '/weekId', message: '同一週有重複的檔案' });
      continue;
    }
    seen.add(f.fileName);
    const errs = validateWeek(f.raw, f.fileName, { knownStorylines: known, entities, proposals });
    out.push(...errs);
    const w = f.raw as Partial<WeekData> | null;
    if (errs.length === 0) {
      for (const s of w!.storylines!) known.add(s.id);
      for (const pc of w!.proposedChannels ?? []) if (!proposals.has(pc.id)) proposals.set(pc.id, { fromPath: pc.fromPath, toPath: pc.toPath, sign: pc.sign });
    }
    // 新實體一律加入（即使本週有其他錯誤），避免後續週連帶報錯；重複新增會在後面的週被抓到。
    if (w && typeof w === 'object' && Array.isArray(w.newEntities) && typeof w.weekId === 'string') {
      entities = mergeRegistry(entities, [{ weekId: w.weekId, newEntities: w.newEntities }]);
    }
  }
  return out;
}
