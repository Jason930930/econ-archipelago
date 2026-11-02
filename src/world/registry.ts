import { parsePath, PATH_SEGMENT } from './paths';
import { getRegion, isRegionId, type RegionId } from './regions';
import { getSector, isSectorAllowed, isSectorId, type SectorId } from './sectors';

/** 第 3 層實體：種子（data/world/entities.json）＋各週 newEntities。人物不設實體。 */
export interface EntityRecord {
  id: string;
  name: string;
  region: RegionId;
  sector: SectorId;
  aliases: string[];
  addedIn: string;
  geo?: { lat: number; lon: number };
}

export type NewEntity = Omit<EntityRecord, 'addedIn'> & { addedIn?: string };

export interface EntityIssue {
  index: number;
  field: 'id' | 'name' | 'aliases' | 'region' | 'sector' | 'geo';
  message: string;
}

export function normalizeName(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

/** 逐筆檢查新實體；同一批中較早的項目也算「既有」。 */
export function checkNewEntities(existing: EntityRecord[], added: NewEntity[]): EntityIssue[] {
  const issues: EntityIssue[] = [];
  const ids = new Map<string, string>(existing.map((e) => [e.id, e.name]));
  const names = new Map<string, { id: string; name: string }>();
  const addNames = (e: { id: string; name: string; aliases: string[] }) => {
    for (const n of [e.name, ...e.aliases]) names.set(normalizeName(n), { id: e.id, name: e.name });
  };
  existing.forEach(addNames);

  added.forEach((e, index) => {
    const before = issues.length;
    const push = (field: EntityIssue['field'], message: string) => issues.push({ index, field, message });
    if (!PATH_SEGMENT.test(e.id)) push('id', `id「${e.id}」必須是小寫英文、數字與連字號`);
    else if (ids.has(e.id)) push('id', `id「${e.id}」已被「${ids.get(e.id)}」使用`);
    if (!e.name || !e.name.trim()) push('name', '名稱不可為空');
    const regionOk = isRegionId(e.region);
    if (!regionOk) push('region', `未知的地區「${e.region}」`);
    if (!isSectorId(e.sector)) push('sector', `未知的部門「${e.sector}」`);
    else if (regionOk && !isSectorAllowed(e.region, e.sector)) push('sector', `${getRegion(e.region).name}不能有「${getSector(e.sector).name}」部門`);
    if (regionOk && e.region === 'seas' && !e.geo) push('geo', '航道實體必須提供 geo（緯度、經度）');
    if (e.name && e.name.trim()) {
      const hit = names.get(normalizeName(e.name));
      if (hit) push('name', `名稱「${e.name}」與既有實體「${hit.name}」(${hit.id}) 的名稱或別名重複`);
    }
    for (const a of e.aliases ?? []) {
      const hit = names.get(normalizeName(a));
      if (hit) push('aliases', `別名「${a}」與既有實體「${hit.name}」(${hit.id}) 的名稱或別名重複`);
    }
    if (issues.length === before) {
      ids.set(e.id, e.name);
      addNames({ id: e.id, name: e.name, aliases: e.aliases ?? [] });
    }
  });
  return issues;
}

export function mergeRegistry(seed: EntityRecord[], weeks: { weekId: string; newEntities?: NewEntity[] }[]): EntityRecord[] {
  const out = [...seed];
  for (const w of [...weeks].sort((a, b) => a.weekId.localeCompare(b.weekId))) {
    for (const e of w.newEntities ?? []) out.push({ ...e, aliases: e.aliases ?? [], addedIn: w.weekId });
  }
  return out;
}

export function resolvePath(path: string, entities: EntityRecord[]): { ok: true } | { ok: false; reason: string } {
  const p = parsePath(path);
  if (!p) return { ok: false, reason: `路徑格式錯誤「${path}」` };
  if (!isRegionId(p.region)) return { ok: false, reason: `未知的地區「${p.region}」` };
  if (!p.sector) return { ok: true };
  if (!isSectorId(p.sector)) return { ok: false, reason: `未知的部門「${p.sector}」` };
  if (!isSectorAllowed(p.region, p.sector)) return { ok: false, reason: `${getRegion(p.region).name}不能有「${getSector(p.sector).name}」部門` };
  if (!p.entity) return { ok: true };
  const e = entities.find((x) => x.id === p.entity);
  if (!e) return { ok: false, reason: `找不到實體「${p.entity}」：請先在 newEntities 新增` };
  if (e.region !== p.region || e.sector !== p.sector) return { ok: false, reason: `實體「${e.name}」屬於 ${e.region}/${e.sector}，與路徑不符` };
  return { ok: true };
}

export function labelOf(path: string, entities: EntityRecord[]): string[] {
  const [region, sector, entity] = path.split('/');
  const out: string[] = [];
  if (region) out.push(isRegionId(region) ? getRegion(region).name : region);
  if (sector) out.push(isSectorId(sector) ? getSector(sector).name : sector);
  if (entity) out.push(entities.find((e) => e.id === entity)?.name ?? entity);
  return out;
}
