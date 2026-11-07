import { CHANNEL_NODES, CHANNELS, getChannelNode, type Channel } from './channels';
import { isWithin } from './paths';
import type { NodeState } from './state';

/**
 * 情境推演（子專案 4）：從一個節點的衝擊出發，沿常駐傳導網絡列舉路徑，
 * 彙總每個節點的方向、強弱、時間與主要路徑。純邏輯、定性推演，不是預測。
 */

export interface Shock {
  node: string;
  direction: 1 | -1;
}
export type Strength = 'strong' | 'medium' | 'weak';
export type Wave = 1 | 2 | 3;

export interface Effect {
  node: string;
  /** null = 方向分歧。 */
  direction: 1 | -1 | null;
  weight: number;
  strength: Strength;
  wave: Wave;
  /** 主要路徑的管道 id（依序）。 */
  path: string[];
  /** 方向分歧時，方向相反的最強路徑。 */
  counterPath?: string[];
  vsCurrent: 'same' | 'opposite' | 'none';
  extreme?: 'high' | 'low';
}

export interface ScenarioResult {
  shock: Shock;
  effects: Effect[];
  taiwan: Effect[];
}

export const MAX_HOPS = 4;
export const HOP_DECAY = 0.7;
export const MIN_WEIGHT = 0.05;
export const DIVERGE_RATIO = 0.5;
export const STRENGTH_TEXT: Record<Strength, string> = { strong: '強', medium: '中', weak: '弱' };
export const WAVE_TEXT: Record<Wave, string> = { 1: '數日', 2: '數週', 3: '數月' };
export const SCENARIO_NOTE = '依教科書層級的定性傳導關係推演，不是預測。';
const LAG_WAVE: Record<Channel['lag'], Wave> = { days: 1, weeks: 2, months: 3 };

export function strengthOf(weight: number): Strength | null {
  return weight >= 0.5 ? 'strong' : weight >= 0.2 ? 'medium' : weight >= MIN_WEIGHT ? 'weak' : null;
}

/** 台灣節點：路徑在 tw 之下，或台海。 */
export function isTaiwanNode(nodeId: string): boolean {
  const p = getChannelNode(nodeId).path;
  return isWithin(p, 'tw') || p === 'seas/shipping-lane/taiwan-strait';
}

interface Path {
  channels: Channel[];
  direction: 1 | -1;
  weight: number;
  key: string;
}

/** 主要路徑的比較：權重大者優先，平手時跳數少者，再依管道 id 串接字串。 */
function better(a: Path, b: Path): boolean {
  if (Math.abs(a.weight - b.weight) > 1e-12) return a.weight > b.weight;
  if (a.channels.length !== b.channels.length) return a.channels.length < b.channels.length;
  return a.key < b.key;
}

/** 路徑上每一步終點節點的方向。 */
export function stepDirections(shock: Shock, path: string[], channels: readonly Channel[] = CHANNELS): (1 | -1)[] {
  const byId = new Map(channels.map((c) => [c.id, c] as const));
  let d: 1 | -1 = shock.direction;
  return path.map((id) => {
    d = (d * (byId.get(id)?.sign ?? 1)) as 1 | -1;
    return d;
  });
}

export function runScenario(shock: Shock, states: Record<string, NodeState>, channels: readonly Channel[] = CHANNELS): ScenarioResult {
  getChannelNode(shock.node); // 不存在時丟錯
  const out = new Map<string, Channel[]>();
  for (const c of channels) out.set(c.from, [...(out.get(c.from) ?? []), c]);
  for (const list of out.values()) list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // 每個節點、每個方向的最強路徑。
  const best = new Map<string, { up?: Path; down?: Path }>();
  const visited = new Set([shock.node]);
  const walk = (node: string, trail: Channel[], direction: 1 | -1, weight: number) => {
    if (trail.length === MAX_HOPS) return;
    for (const c of out.get(node) ?? []) {
      if (visited.has(c.to)) continue;
      const next = [...trail, c];
      const w = weight * (c.strength / 3) * (trail.length > 0 ? HOP_DECAY : 1);
      const d = (direction * c.sign) as 1 | -1;
      const p: Path = { channels: next, direction: d, weight: w, key: next.map((x) => x.id).join('>') };
      const slot = best.get(c.to) ?? {};
      const k = d > 0 ? 'up' : 'down';
      if (!slot[k] || better(p, slot[k]!)) slot[k] = p;
      best.set(c.to, slot);
      visited.add(c.to);
      walk(c.to, next, d, w);
      visited.delete(c.to);
    }
  };
  walk(shock.node, [], shock.direction, 1);

  const order = new Map(CHANNEL_NODES.map((n, i) => [n.id, i] as const));
  const effects: Effect[] = [];
  for (const [node, slot] of best) {
    const cands = [slot.up, slot.down].filter((p): p is Path => !!p);
    const main = cands.reduce((a, b) => (better(b, a) ? b : a));
    const strength = strengthOf(main.weight);
    if (!strength) continue;
    const other = main === slot.up ? slot.down : slot.up;
    const diverge = !!other && other.weight >= main.weight * DIVERGE_RATIO;
    const direction = diverge ? null : main.direction;
    const s = states[node];
    let vsCurrent: Effect['vsCurrent'] = 'none';
    if (direction !== null && s && (s.direction === 1 || s.direction === -1)) vsCurrent = s.direction === direction ? 'same' : 'opposite';
    const e: Effect = {
      node, direction, weight: Math.round(main.weight * 1e6) / 1e6, strength,
      wave: Math.max(...main.channels.map((c) => LAG_WAVE[c.lag])) as Wave,
      path: main.channels.map((c) => c.id), vsCurrent,
    };
    if (diverge) e.counterPath = other!.channels.map((c) => c.id);
    if (direction === 1 && s?.level === 'high') e.extreme = 'high';
    if (direction === -1 && s?.level === 'low') e.extreme = 'low';
    effects.push(e);
  }
  effects.sort((a, b) => a.wave - b.wave || b.weight - a.weight || (order.get(a.node) ?? 99) - (order.get(b.node) ?? 99));
  return { shock: { ...shock }, effects, taiwan: effects.filter((e) => isTaiwanNode(e.node)) };
}
