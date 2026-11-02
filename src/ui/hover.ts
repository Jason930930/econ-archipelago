import type { ArchiveIndex } from '../data/buildIndex';
import { bindingFor } from '../world/indicators';
import { layoutIslands } from '../world/layout';
import { getRegion, isRegionId } from '../world/regions';
import { labelOf } from '../world/registry';
import { formatIndicator } from './format';

/** 滑鼠移到節點上時的提示內容（純資料，由 UI 以文字顯示）。 */
export function hoverInfo(path: string, weekId: string, index: ArchiveIndex): { title: string; lines: string[] } {
  const title = labelOf(path, index.entities).join(' › ');
  const lines: string[] = [];
  if (!path.includes('/') && isRegionId(path)) {
    const r = getRegion(path);
    if (r.gdp !== null) lines.push(`約略 GDP ${r.gdp.toFixed(1)} 兆美元`);
    if (layoutIslands().get(path)?.enlarged) lines.push('（島嶼為可讀性放大）');
  }
  const b = bindingFor(path);
  const ind = index.indicators[weekId];
  if (b && ind) {
    const key = b.keys.find((k) => ind[k].value !== null) ?? b.keys[0]!;
    const r = ind[key];
    lines.push(formatIndicator(key, r));
    if (r.note) lines.push(r.note);
  }
  return { title, lines };
}
