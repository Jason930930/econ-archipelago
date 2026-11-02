import type { WatchItem, WeekData } from '../data/types';
import type { EntityRecord } from '../world/registry';
import { weekIntensity } from '../world/activation';
import { getChannel } from '../world/channels';
import { channelName } from './channelPanel';
import type { NodeState } from '../world/state';
import { el } from './dom';
import { renderTextWorldState } from './stateCard';
import { renderEventCard } from './eventCard';
import { shortDate } from './format';

export function renderWatchlist(items: WatchItem[]): HTMLElement {
  return el('ul', { class: 'watchlist' }, ...items.map((w) =>
    el('li', { class: w.confirmed ? '' : 'unconfirmed' },
      w.date ? el('span', { class: 'watch-date' }, shortDate(w.date)) : null,
      `${w.text}${w.confirmed ? '' : '（未確認）'}`),
  ));
}

export function renderTextMode(week: WeekData, order: string[], entities: EntityRecord[], states?: Record<string, NodeState>): HTMLElement {
  const byId = new Map(week.events.map((e) => [e.id, e]));
  const ordered = order.map((id) => byId.get(id)).filter((e) => e !== undefined);
  const root = el('section', { class: 'text-mode' }, el('h2', {}, week.title));
  ordered.forEach((ev, i) => root.append(renderEventCard(ev, { index: i, total: ordered.length }, entities)));
  if (week.links.length > 0) {
    root.append(el('h3', { class: 'section-title' }, '因果連線'), el('ul', { class: 'links' }, ...week.links.map((l) =>
      el('li', {}, `${byId.get(l.from)?.title ?? l.from} → ${byId.get(l.to)?.title ?? l.to}（${l.label}）`),
    )));
  }
  const lit = Object.keys(weekIntensity(week)).filter((id) => getChannel(id)).sort();
  if (lit.length > 0) {
    root.append(el('h3', { class: 'section-title' }, '本週點亮的管道'), el('ul', { class: 'links text-channels' }, ...lit.map((id) =>
      el('li', {}, el('strong', {}, channelName(id)), `：${getChannel(id)!.mechanism}`),
    )));
  }
  if (states) root.append(el('h3', { class: 'section-title' }, '世界狀態'), renderTextWorldState(states));
  if (week.watchlist.length > 0) root.append(el('h3', { class: 'section-title' }, '下週值得關注'), renderWatchlist(week.watchlist));
  return root;
}
