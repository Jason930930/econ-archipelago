import type { WatchItem, WeekData } from '../data/types';
import { el } from './dom';
import { renderEventCard } from './eventCard';
import { shortDate } from './format';

export function renderWatchlist(items: WatchItem[]): HTMLElement {
  return el('ul', { class: 'watchlist' }, ...items.map((w) =>
    el('li', { class: w.confirmed ? '' : 'unconfirmed' },
      w.date ? el('span', { class: 'watch-date' }, shortDate(w.date)) : null,
      `${w.text}${w.confirmed ? '' : '（未確認）'}`),
  ));
}

export function renderTextMode(week: WeekData, order: string[]): HTMLElement {
  const byId = new Map(week.events.map((e) => [e.id, e]));
  const ordered = order.map((id) => byId.get(id)).filter((e) => e !== undefined);
  const root = el('section', { class: 'text-mode' }, el('h2', {}, week.title));
  ordered.forEach((ev, i) => root.append(renderEventCard(ev, { index: i, total: ordered.length })));
  if (week.links.length > 0) {
    root.append(el('h3', { class: 'section-title' }, '因果連線'), el('ul', { class: 'links' }, ...week.links.map((l) =>
      el('li', {}, `${byId.get(l.from)?.title ?? l.from} → ${byId.get(l.to)?.title ?? l.to}（${l.label}）`),
    )));
  }
  if (week.watchlist.length > 0) root.append(el('h3', { class: 'section-title' }, '下週值得關注'), renderWatchlist(week.watchlist));
  return root;
}
