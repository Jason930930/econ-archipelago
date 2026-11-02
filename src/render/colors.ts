import type { SectorGroup } from '../world/sectors';
import type { ColorMode } from './scene';

export const UP_DOWN: Record<ColorMode, { up: string; down: string }> = {
  tw: { up: '#e5484d', down: '#2fa36b' },
  intl: { up: '#2fa36b', down: '#e5484d' },
};
export const FLAT = '#f2d27a';

/** 區塊地皮依部門分組上色：總經藍、市場綠、產業橙、全球紫。 */
export const GROUP_COLORS: Record<SectorGroup, string> = {
  macro: '#7da7d9',
  market: '#8cc084',
  industry: '#e3a868',
  global: '#a58fd1',
};

/** FNV-1a 32-bit，確定性雜湊（形狀、外觀用）。 */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
