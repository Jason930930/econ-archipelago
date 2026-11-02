/** 路徑：`region`、`region/sector` 或 `region/sector/entity`。只處理格式，不檢查是否存在。 */
export const PATH_SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const PATH_PATTERN = '^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*){0,2}$';

export interface ParsedPath {
  region: string;
  sector?: string;
  entity?: string;
  depth: 1 | 2 | 3;
}

export function parsePath(s: string): ParsedPath | null {
  const parts = s.split('/');
  if (parts.length < 1 || parts.length > 3 || !parts.every((p) => PATH_SEGMENT.test(p))) return null;
  const [region, sector, entity] = parts as [string, string?, string?];
  const out: ParsedPath = { region, depth: parts.length as 1 | 2 | 3 };
  if (sector) out.sector = sector;
  if (entity) out.entity = entity;
  return out;
}

export function formatPath(p: { region: string; sector?: string; entity?: string }): string {
  return [p.region, p.sector, p.entity].filter(Boolean).join('/');
}

export function parentOf(path: string): string | null {
  const i = path.lastIndexOf('/');
  return i < 0 ? null : path.slice(0, i);
}

/** 由近到遠，不含自己。 */
export function ancestorsOf(path: string): string[] {
  const out: string[] = [];
  for (let p = parentOf(path); p !== null; p = parentOf(p)) out.push(p);
  return out;
}

/** path 等於 root 或位於 root 底下。 */
export function isWithin(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}
