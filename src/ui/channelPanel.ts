import type { ArchiveIndex } from '../data/buildIndex';
import type { WeekData } from '../data/types';
import { isLit, weekIntensity, type ChannelActivity } from '../world/activation';
import { CHANNELS, FAMILY_INFO, getChannel, getChannelNode, LAG_LABEL, type Channel } from '../world/channels';
import { labelOf } from '../world/registry';
import { el } from './dom';
import { stateChip, statesFor } from './stateCard';
import { shortDate } from './format';

export const QUALITATIVE_NOTE = '方向與強度為教科書層級的定性判斷，不是量化模型或預測。';
export const PROPOSAL_NOTE = '待審提議：不參與推演';

export function channelName(id: string): string {
  const c = getChannel(id);
  if (!c) return id;
  return `${getChannelNode(c.from).name} → ${getChannelNode(c.to).name}`;
}

const signText = (s: 1 | -1) => (s > 0 ? '同向' : '反向');
const strengthText = (n: number) => '●'.repeat(n) + '○'.repeat(3 - n);

function emit(node: HTMLElement, type: string, detail: unknown) {
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
}

function button(label: string, attrs: Record<string, string>, type: string, detail: unknown): HTMLButtonElement {
  const b = el('button', { type: 'button', ...attrs }, label);
  b.addEventListener('click', () => emit(b, type, detail));
  return b;
}

/** 管道清單（亮的在前、依熱度排序），每列是開管道面板的按鈕。 */
function channelList(channels: Channel[], act: Record<string, ChannelActivity>, cls: string): HTMLElement {
  const heat = (c: Channel) => act[c.id]?.heat ?? 0;
  const sorted = [...channels].sort((a, b) => Number(isLit(act[b.id])) - Number(isLit(act[a.id])) || heat(b) - heat(a) || a.id.localeCompare(b.id));
  return el('ul', { class: `related channel-list ${cls}` }, ...sorted.map((c) => {
    const b = button(channelName(c.id), { 'data-channel': c.id, class: isLit(act[c.id]) ? 'lit' : '' }, 'select-channel', { id: c.id });
    b.prepend(el('span', { class: 'family-dot', style: `background:${FAMILY_INFO[c.family].color}`, 'aria-hidden': 'true' }));
    if (c.sign < 0) b.append(el('span', { class: 'sign-tag' }, '反向'));
    return el('li', {}, b);
  }));
}

export function renderChannelPanel(id: string, week: WeekData, index: ArchiveIndex): HTMLElement {
  const c = getChannel(id);
  if (!c) return el('section', { class: 'channel-panel' }, el('p', { class: 'muted' }, `找不到管道「${id}」`));
  const from = getChannelNode(c.from), to = getChannelNode(c.to);
  const act = index.channels.byWeek[week.weekId]?.[id];
  const nodeStates = statesFor(week.weekId, index);
  const panel = el('section', { class: 'channel-panel', 'data-channel': id },
    el('div', { class: 'card-meta' }, '傳導管道'),
    el('h3', { class: 'channel-ends' },
      button(from.name, { 'data-path': from.path }, 'select-node', { path: from.path }),
      stateChip(nodeStates[c.from]),
      el('span', { 'aria-hidden': 'true' }, ' → '),
      button(to.name, { 'data-path': to.path }, 'select-node', { path: to.path }),
      stateChip(nodeStates[c.to])),
    el('dl', { class: 'channel-facts' },
      el('dt', {}, '方向'), el('dd', {}, `${signText(c.sign)}（${from.name}上升 → ${to.name}${c.sign > 0 ? '上升' : '下降'}）`),
      el('dt', {}, '強度'), el('dd', { 'aria-label': `強度 ${c.strength} / 3` }, strengthText(c.strength)),
      el('dt', {}, '時間落差'), el('dd', {}, LAG_LABEL[c.lag]),
      el('dt', {}, '類別'), el('dd', {}, el('span', { class: 'family-dot', style: `background:${FAMILY_INFO[c.family].color}`, 'aria-hidden': 'true' }), FAMILY_INFO[c.family].name)),
    el('p', { class: 'channel-mechanism' }, c.mechanism),
  );

  const evIds = weekIntensity(week)[id]?.eventIds ?? [];
  panel.append(el('h4', {}, '本週'));
  if (evIds.length === 0) {
    panel.append(el('p', { class: 'muted' }, act && act.heat > 0 ? `本週未點亮（餘溫 ${act.heat.toFixed(2)}）` : '本週未點亮'));
  } else {
    const list = el('ul', { class: 'related' });
    for (const eid of evIds) {
      const ev = week.events.find((e) => e.id === eid);
      list.append(el('li', {}, button(ev?.title ?? eid, { 'data-event-id': eid }, 'select-event', { eventId: eid })));
    }
    panel.append(list);
  }
  if (act && act.heat > 0 && evIds.length > 0) {
    panel.append(el('p', { class: 'muted channel-heat' }, `熱度 ${act.heat.toFixed(2)}${act.streak >= 2 ? `・持續活躍 ${act.streak} 週` : ''}`));
  }

  const hist = index.channels.history[id] ?? [];
  if (hist.length > 0) {
    panel.append(el('h4', {}, '歷史'), el('ul', { class: 'week-chips' }, ...hist.map((h) =>
      el('li', {}, button(`${shortDate(h.weekId)}（${h.eventIds.length} 則）`, { 'data-week-id': h.weekId }, 'select-week', { weekId: h.weekId })))));
  }
  panel.append(el('p', { class: 'channel-note' }, QUALITATIVE_NOTE));
  return panel;
}

function pathName(path: string, index: ArchiveIndex): string {
  return labelOf(path, index.entities).join('／');
}

export function renderProposalPanel(id: string, index: ArchiveIndex): HTMLElement {
  const p = index.channels.proposals.find((x) => x.id === id);
  if (!p) return el('section', { class: 'proposal-panel' }, el('p', { class: 'muted' }, `找不到提議「${id}」`));
  return el('section', { class: 'proposal-panel', 'data-proposal': id },
    el('div', { class: 'card-meta' }, PROPOSAL_NOTE),
    el('h3', {}, `${p.fromVar} → ${p.toVar}`),
    el('dl', { class: 'channel-facts' },
      el('dt', {}, '起點'), el('dd', {}, button(pathName(p.fromPath, index), { 'data-path': p.fromPath }, 'select-node', { path: p.fromPath })),
      el('dt', {}, '終點'), el('dd', {}, button(pathName(p.toPath, index), { 'data-path': p.toPath }, 'select-node', { path: p.toPath })),
      el('dt', {}, '方向'), el('dd', {}, signText(p.sign))),
    el('p', { class: 'channel-mechanism' }, p.mechanism),
    el('h4', {}, '被提議的週次'),
    el('ul', { class: 'week-chips' }, ...p.weeks.map((w) =>
      el('li', {}, button(`${w.weekId}（依據 ${w.evidence.join('、')}）`, { 'data-week-id': w.weekId }, 'select-week', { weekId: w.weekId })))),
    el('p', { class: 'channel-note' }, `${PROPOSAL_NOTE}。${QUALITATIVE_NOTE}`),
  );
}

export function renderProposalList(index: ArchiveIndex): HTMLElement {
  const pending = index.channels.proposals.filter((p) => !p.promoted);
  const root = el('section', { class: 'proposal-list' }, el('div', { class: 'card-meta' }, '傳導網絡'), el('h3', {}, `待審提議 ${pending.length} 項`));
  if (pending.length === 0) root.append(el('p', { class: 'muted' }, '目前沒有待審的提議。'));
  else root.append(el('ul', { class: 'related' }, ...pending.map((p) =>
    el('li', {}, button(`${p.fromVar} → ${p.toVar}`, { 'data-proposal': p.id }, 'select-proposal', { id: p.id })))));
  root.append(el('p', { class: 'channel-note' }, PROPOSAL_NOTE));
  return root;
}

/** 本週點亮的管道（亮管），依熱度由高到低。 */
export function renderActiveChannels(weekId: string, index: ArchiveIndex): HTMLElement {
  const act = index.channels.byWeek[weekId] ?? {};
  const lit = CHANNELS.filter((c) => isLit(act[c.id]));
  const root = el('section', { class: 'active-channels' }, el('h4', {}, '本週點亮的管道'));
  if (lit.length === 0) root.append(el('p', { class: 'muted' }, '本週沒有點亮的傳導管道。'));
  else root.append(channelList(lit, act, ''));
  return root;
}

/** 節點面板的「傳導管道」區塊：端點位於此路徑（含下層）的管道。 */
export function renderNodeChannels(channels: Channel[], weekId: string, index: ArchiveIndex): HTMLElement | null {
  if (channels.length === 0) return null;
  return el('section', { class: 'node-channels' }, el('h4', {}, '傳導管道'), channelList(channels, index.channels.byWeek[weekId] ?? {}, ''));
}
