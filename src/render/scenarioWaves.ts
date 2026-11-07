import { STRENGTH_TEXT, type Effect, type ScenarioResult, type Wave } from '../world/scenario';

/** 情境推演動畫的純函式（不 import three）。 */

/** 每一波新出現的管道（不重複播放）與節點；沒有結果的波略過。 */
export function scenarioWaves(r: ScenarioResult): { wave: Wave; channels: string[]; nodes: string[] }[] {
  const played = new Set<string>();
  const out: { wave: Wave; channels: string[]; nodes: string[] }[] = [];
  for (const wave of [1, 2, 3] as Wave[]) {
    const effects = r.effects.filter((e) => e.wave === wave);
    if (effects.length === 0) continue;
    const channels: string[] = [];
    for (const e of effects) for (const id of [...e.path, ...(e.counterPath ?? [])]) {
      if (!played.has(id)) { played.add(id); channels.push(id); }
    }
    out.push({ wave, channels, nodes: effects.map((e) => e.node) });
  }
  return out;
}

/** 預估標記文字：箭頭＋強弱；方向分歧為 ⇅。 */
export function markerText(e: Effect): string {
  const arrow = e.direction === null ? '⇅' : e.direction > 0 ? '↑' : '↓';
  return `${arrow} ${STRENGTH_TEXT[e.strength]}`;
}
