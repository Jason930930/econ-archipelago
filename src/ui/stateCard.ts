import type { ArchiveIndex } from '../data/buildIndex';
import { arrowOf, formatStateValue, LEVEL_COLORS, LEVEL_TEXT, levelLabel } from '../render/stateBadge';
import { CHANNEL_NODES, getChannelNode } from '../world/channels';
import { isWithin } from '../world/paths';
import { getRegion, isRegionId, REGION_IDS } from '../world/regions';
import type { NodeState } from '../world/state';
import { sourceOf } from '../world/stateSources';
import { el, svg } from './dom';
import { INDICATOR_LABELS, shortDate } from './format';

export const STATE_NOTE = '高／中／低為相對過去 5 年的位置，不代表好壞，也不是預測。';
export const FRED_NOTE = '部分數據來自 FRED（聖路易聯邦準備銀行），各指數版權屬原提供者。';

/** 看最新一週時用最新狀態（含兩次週報之間的每日更新），較早的週用該週五的狀態。 */
export function statesFor(weekId: string, index: ArchiveIndex): Record<string, NodeState> {
  const last = index.weeks.at(-1)?.weekId;
  return weekId === last ? index.state.latest : index.state.byWeek[weekId] ?? {};
}

function emit(node: HTMLElement, type: string, detail: unknown) {
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
}
function button(label: string, attrs: Record<string, string>, type: string, detail: unknown): HTMLButtonElement {
  const b = el('button', { type: 'button', ...attrs }, label);
  b.addEventListener('click', () => emit(b, type, detail));
  return b;
}

/** 水準＋方向的小標（例：「高 ↑」）。 */
export function stateChip(s: NodeState | undefined): HTMLElement {
  if (!s || s.freshness === 'unknown') return el('span', { class: 'state-chip unknown' }, '未知');
  const chip = el('span', { class: `state-chip${s.level ? '' : ' no-level'}${s.freshness === 'stale' ? ' stale' : ''}` }, `${levelLabel(s)} ${arrowOf(s.direction)}`);
  if (s.level) chip.style.background = LEVEL_COLORS[s.level];
  return chip;
}

function freshnessText(s: NodeState): string {
  if (s.freshness === 'unknown') return '尚無資料';
  if (s.kind === 'qualitative') {
    if (s.carriedWeeks === 0) return `${shortDate(s.asOf)} 週報`;
    if (s.freshness === 'stale') return `已 ${s.carriedWeeks} 週未更新（${shortDate(s.asOf)} 週報）`;
    return `沿用 ${s.carriedWeeks} 週前（${shortDate(s.asOf)} 週報）`;
  }
  return `資料日期 ${shortDate(s.asOf)}${s.freshness === 'stale' ? '（已超過正常更新週期）' : ''}`;
}

function sparkPoints(nodeId: string, s: NodeState, index: ArchiveIndex): number[] {
  const src = sourceOf(nodeId);
  if (src.kind === 'fred') return (index.state.series[nodeId] ?? []).filter(([d]) => !s.asOf || d <= s.asOf).slice(-52).map(([, v]) => v);
  if (src.kind === 'report-numeric') {
    return index.weeks.filter((w) => !s.asOf || w.weekId <= s.asOf)
      .map((w) => index.indicators[w.weekId]?.[src.indicator])
      .filter((r) => r?.status === 'fresh' && r.value !== null).map((r) => r!.value!);
  }
  return [];
}

function spark(values: number[]): SVGSVGElement | null {
  if (values.length < 2) return null;
  const W = 240, H = 40, P = 3;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => `${P + (i * (W - 2 * P)) / (values.length - 1)},${H - P - ((v - lo) / span) * (H - 2 * P)}`);
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'state-spark', role: 'img', 'aria-label': '走勢' });
  s.append(svg('polyline', { points: pts.join(' '), fill: 'none', class: 'spark-line' }));
  return s;
}

/** 5 年區間條：標出目前百分位。 */
function rangeBar(percentile: number): HTMLElement {
  const marker = el('span', { class: 'state-range-marker' });
  marker.style.left = `${percentile}%`;
  return el('div', { class: 'state-range' },
    el('span', { class: 'state-range-end' }, '5 年低'),
    el('span', { class: 'state-range-track' }, marker),
    el('span', { class: 'state-range-end' }, '5 年高'));
}

function sourceLine(nodeId: string, s: NodeState, weekId: string | undefined): HTMLElement {
  const src = sourceOf(nodeId);
  const line = el('p', { class: 'state-source-line' });
  if (src.kind === 'fred') {
    const a = el('a', { class: 'state-source', href: `https://fred.stlouisfed.org/series/${src.series}`, target: '_blank', rel: 'noopener noreferrer' }, `FRED ${src.series}`);
    line.append('資料：', a, `・${src.label}`);
  } else if (src.kind === 'report-numeric') {
    line.append(`資料：週報指標「${INDICATOR_LABELS[src.indicator]}」`);
  } else if (s.source?.kind === 'report') {
    const ws = s.source.weekId;
    line.append(`依 ${shortDate(ws)} 週報`);
    if (weekId && ws === weekId) {
      for (const eid of s.source.evidence) line.append(' ', button(eid, { 'data-event-id': eid, class: 'state-evidence' }, 'select-event', { eventId: eid }));
    } else {
      line.append(' ', button(`前往 ${shortDate(ws)} 週報`, { 'data-week-id': ws, class: 'state-evidence' }, 'select-week', { weekId: ws }));
    }
  }
  return line;
}

export function renderStateCard(nodeId: string, s: NodeState, index: ArchiveIndex, opts: { weekId?: string } = {}): HTMLElement {
  const node = getChannelNode(nodeId);
  const src = sourceOf(nodeId);
  const card = el('section', { class: 'state-card', 'data-node': nodeId },
    el('div', { class: 'state-card-head' }, el('strong', {}, node.name), stateChip(s)));
  if (s.freshness === 'unknown') {
    card.append(el('p', { class: 'muted' }, '尚無資料'));
    if (src.kind !== 'report-qualitative') card.append(sourceLine(nodeId, s, opts.weekId));
    else card.append(el('p', { class: 'muted' }, '週報明確提到這個節點時，排程才會填寫狀態。'));
    return card;
  }
  if (s.kind === 'numeric' && s.value !== null) {
    card.append(el('p', { class: 'state-value' }, formatStateValue(s.value, s.unit),
      src.kind === 'fred' && src.invertNote ? el('span', { class: 'muted' }, `（${src.invertNote}）`) : null));
  }
  if (s.percentile !== null) {
    card.append(el('p', { class: 'state-level' }, `${s.level ? LEVEL_TEXT[s.level] : ''}：5 年第 ${s.percentile} 百分位`), rangeBar(s.percentile));
  } else if (s.kind === 'numeric') {
    card.append(el('p', { class: 'muted' }, '無歷史基準（歷史資料不足）'));
  }
  if (s.direction !== null) {
    const dir = s.lookback && s.value !== null
      ? `${arrowOf(s.direction)} ${shortDate(s.lookback[0])} ${formatStateValue(s.lookback[1], s.unit)} → ${formatStateValue(s.value, s.unit)}`
      : `方向 ${arrowOf(s.direction)}`;
    card.append(el('p', { class: 'state-direction' }, dir));
  }
  const sp = spark(sparkPoints(nodeId, s, index));
  if (sp) card.append(sp);
  if (s.basis) card.append(el('p', { class: 'state-basis' }, s.basis));
  card.append(el('p', { class: 'muted state-freshness' }, freshnessText(s)), sourceLine(nodeId, s, opts.weekId));
  card.append(el('p', { class: 'channel-note' }, STATE_NOTE));
  return card;
}

function stateRow(nodeId: string, s: NodeState | undefined): HTMLElement {
  const node = getChannelNode(nodeId);
  const b = button('', { 'data-node': nodeId, 'data-path': node.path, class: 'state-row' }, 'select-node', { path: node.path });
  const value = s && s.kind === 'numeric' && s.value !== null ? formatStateValue(s.value, s.unit) : '';
  b.append(el('span', { class: 'state-row-name' }, node.name), stateChip(s), el('span', { class: 'state-row-value' }, value), el('span', { class: 'muted state-row-date' }, s?.asOf ? shortDate(s.asOf) : ''));
  return el('li', {}, b);
}

/** 節點面板的「節點狀態」區塊：地區用精簡列，部門與實體用完整卡片。 */
export function renderNodeStates(path: string, states: Record<string, NodeState>, index: ArchiveIndex, weekId: string): HTMLElement | null {
  const nodes = CHANNEL_NODES.filter((n) => isWithin(n.path, path));
  if (nodes.length === 0) return null;
  const sec = el('section', { class: 'node-states' }, el('h4', {}, '節點狀態'));
  if (!path.includes('/')) {
    sec.append(el('ul', { class: 'state-rows' }, ...nodes.map((n) => stateRow(n.id, states[n.id]))), el('p', { class: 'channel-note' }, STATE_NOTE));
  } else {
    for (const n of nodes) {
      const s = states[n.id];
      if (s) sec.append(renderStateCard(n.id, s, index, { weekId }));
    }
  }
  return sec;
}

function regionName(id: string): string {
  return isRegionId(id) ? getRegion(id).name : id;
}

export function renderWorldState(states: Record<string, NodeState>, _index: ArchiveIndex): HTMLElement {
  const count = { high: 0, mid: 0, low: 0, none: 0 };
  for (const n of CHANNEL_NODES) {
    const s = states[n.id];
    if (s?.level && s.freshness !== 'unknown') count[s.level]++;
    else count.none++;
  }
  const root = el('section', { class: 'world-state' },
    el('div', { class: 'card-meta' }, '世界狀態'),
    el('h3', {}, '36 個節點的目前狀態'),
    el('p', { class: 'state-summary' }, `高 ${count.high}・中 ${count.mid}・低 ${count.low}・未知 ${count.none}`));
  const regionOf = (path: string) => path.split('/')[0]!;
  const order = [...REGION_IDS] as string[];
  const groups = [...new Set(CHANNEL_NODES.map((n) => regionOf(n.path)))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  for (const g of groups) {
    root.append(el('h4', {}, regionName(g)), el('ul', { class: 'state-rows' }, ...CHANNEL_NODES.filter((n) => regionOf(n.path) === g).map((n) => stateRow(n.id, states[n.id]))));
  }
  root.append(el('p', { class: 'channel-note' }, STATE_NOTE), el('p', { class: 'channel-note' }, FRED_NOTE));
  return root;
}

export function renderTransitions(list: { node: string; kind: 'level' | 'direction'; from: string; to: string }[], _index: ArchiveIndex): HTMLElement | null {
  if (list.length === 0) return null;
  const text = (t: (typeof list)[number]) => {
    const name = getChannelNode(t.node).name;
    if (t.kind === 'level') return `${name} ${LEVEL_TEXT[t.from as keyof typeof LEVEL_TEXT]} → ${LEVEL_TEXT[t.to as keyof typeof LEVEL_TEXT]}`;
    return `${name} 方向轉 ${arrowOf(Number(t.to) as -1 | 0 | 1)}`;
  };
  return el('section', { class: 'state-transitions' }, el('h4', {}, '本週狀態轉變'),
    el('ul', { class: 'related' }, ...list.map((t) => el('li', {}, button(text(t), { 'data-node': t.node }, 'select-node', { path: getChannelNode(t.node).path })))));
}

/** 文字模式的「世界狀態」段落。 */
export function renderTextWorldState(states: Record<string, NodeState>): HTMLElement {
  return el('ul', { class: 'links text-world-state' }, ...CHANNEL_NODES.map((n) => {
    const s = states[n.id];
    const parts = [s && s.freshness !== 'unknown' ? `${levelLabel(s)} ${arrowOf(s.direction)}` : '未知'];
    if (s?.kind === 'numeric' && s.value !== null) parts.push(formatStateValue(s.value, s.unit));
    if (s?.asOf) parts.push(shortDate(s.asOf));
    return el('li', {}, el('strong', {}, n.name), `：${parts.join('・')}`);
  }));
}
