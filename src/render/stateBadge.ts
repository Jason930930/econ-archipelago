import type { Direction, Level, NodeState } from '../world/state';

/** 狀態徽章的純函式（不 import three）：文字、顏色、提示、顯示時機。UI 的狀態卡也共用這些文字。 */

/** 水準是「相對過去 5 年的位置」，不是漲跌，所以刻意不用紅綠。 */
export const LEVEL_COLORS: Record<Level, string> = { low: '#4a90d9', mid: '#8a96a3', high: '#e0a030' };
export const LEVEL_TEXT: Record<Level, string> = { high: '高', mid: '中', low: '低' };
export const DIRECTION_TEXT: Record<string, string> = { '1': '上升', '0': '持平', '-1': '下降' };
export const ARROWS: Record<string, string> = { '1': '↑', '0': '→', '-1': '↓' };
/** 與部門名稱同一個縮放門檻。 */
export const BADGE_ZOOM = 1.8;

export const arrowOf = (d: Direction | null) => (d === null ? '·' : ARROWS[String(d)]!);

export function badgeText(s: NodeState): string {
  return s.freshness === 'unknown' ? '?' : arrowOf(s.direction);
}

export function levelLabel(s: NodeState): string {
  return s.level ? LEVEL_TEXT[s.level] : s.kind === 'numeric' ? '無歷史基準' : '未知';
}

export function badgeLabel(name: string, s: NodeState): string {
  if (s.freshness === 'unknown') return `${name}：未知`;
  return `${name}：${levelLabel(s)}${s.direction === null ? '' : `，${DIRECTION_TEXT[String(s.direction)]}`}`;
}

export function formatStateValue(v: number, unit: string | null): string {
  const a = Math.abs(v);
  const digits = a >= 1000 ? 0 : a >= 100 ? 1 : 2;
  const n = v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  if (!unit) return n;
  return unit === '%' ? `${n}%` : `${n} ${unit}`;
}

const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

export function badgeTooltip(name: string, s: NodeState): string {
  if (s.freshness === 'unknown') return `${name}・尚無資料`;
  const parts: string[] = [];
  const level = s.level ? `${LEVEL_TEXT[s.level]}${s.percentile !== null ? `（5 年第 ${s.percentile} 百分位）` : ''}` : levelLabel(s);
  if (s.kind === 'numeric' && s.value !== null) parts.push(`${name} ${formatStateValue(s.value, s.unit)}`);
  else parts.push(name);
  parts.push(level, arrowOf(s.direction));
  if (s.asOf) {
    if (s.kind === 'qualitative') parts.push(`${md(s.asOf)} 週報${s.carriedWeeks > 0 ? `（沿用 ${s.carriedWeeks} 週）` : ''}`);
    else parts.push(md(s.asOf));
  }
  return parts.join('・');
}

/** 地區層節點（路徑沒有 /）永遠顯示；其餘在拉近或網絡模式時顯示。 */
export function badgeVisible(nodePath: string, zoom: number, network: boolean): boolean {
  return !nodePath.includes('/') || network || zoom >= BADGE_ZOOM;
}
