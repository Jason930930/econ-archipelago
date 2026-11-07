import { isChannelNodeId } from '../world/channels';
import type { Shock } from '../world/scenario';

export type Route = { weekId: string; eventId: string | null; invalid: boolean; scenario: Shock | null };

const WHAT_IF = /^\/(\d{4}-\d{2}-\d{2})\/what-if\/([a-z0-9.-]+)\/([a-z]+)\/?$/;

/** weekIds 為升冪排序，最新週 = 最後一個。 */
export function parseHash(hash: string, weekIds: string[], eventIdsOf: (weekId: string) => string[]): Route {
  const latest = weekIds[weekIds.length - 1] ?? '';
  const raw = hash.replace(/^#/, '');
  if (raw === '' || raw === '/') return { weekId: latest, eventId: null, invalid: false, scenario: null };
  // 情境推演：#/<週>/what-if/<節點>/<up|down>
  const w = WHAT_IF.exec(raw);
  if (w) {
    if (!weekIds.includes(w[1]!)) return { weekId: latest, eventId: null, invalid: true, scenario: null };
    const ok = isChannelNodeId(w[2]!) && (w[3] === 'up' || w[3] === 'down');
    return { weekId: w[1]!, eventId: null, invalid: !ok, scenario: ok ? { node: w[2]!, direction: w[3] === 'up' ? 1 : -1 } : null };
  }
  const m = /^\/(\d{4}-\d{2}-\d{2})(?:\/([A-Za-z0-9-]+))?\/?$/.exec(raw);
  if (!m || !weekIds.includes(m[1]!)) return { weekId: latest, eventId: null, invalid: true, scenario: null };
  const weekId = m[1]!;
  const eventId = m[2] ?? null;
  if (eventId !== null && !eventIdsOf(weekId).includes(eventId)) return { weekId, eventId: null, invalid: true, scenario: null };
  return { weekId, eventId, invalid: false, scenario: null };
}

export function toHash(r: { weekId: string; eventId: string | null; scenario?: Shock | null }): string {
  if (r.scenario) return `#/${r.weekId}/what-if/${r.scenario.node}/${r.scenario.direction > 0 ? 'up' : 'down'}`;
  return r.eventId ? `#/${r.weekId}/${r.eventId}` : `#/${r.weekId}`;
}
