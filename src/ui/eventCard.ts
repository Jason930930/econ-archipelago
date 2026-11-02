import type { WeekEvent } from '../data/types';
import { labelOf, type EntityRecord } from '../world/registry';
import { el } from './dom';
import { shortDate } from './format';

function section(title: string, body: string, cls = ''): HTMLElement {
  return el('section', cls ? { class: cls } : {}, el('h4', {}, title), el('p', {}, body));
}

export function sourceList(sources: WeekEvent['sources']): HTMLElement {
  return el('ul', { class: 'sources' }, ...sources.map((s) =>
    el('li', {}, /^https:\/\//.test(s.url)
      ? el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.title)
      : el('span', {}, s.title)),
  ));
}

export function renderEventCard(ev: WeekEvent, opts: { index: number; total: number }, entities: EntityRecord[]): HTMLElement {
  const places = ev.places.map((p) => labelOf(p, entities).join(' › ')).join('、');
  const meta = [`第 ${opts.index + 1} / ${opts.total} 則`, shortDate(ev.date), places].filter(Boolean).join(' · ');

  const card = el('article', { class: 'event-card', 'data-event-id': ev.id, 'data-sentiment': String(ev.sentiment) },
    el('div', { class: 'card-meta' }, meta),
    el('h3', {}, ev.title),
    section('發生了什麼', ev.what),
    section('為什麼重要', ev.why),
  );

  if (ev.metrics.length > 0) {
    card.append(el('table', { class: 'metrics' }, el('tbody', {}, ...ev.metrics.map((m) =>
      el('tr', {}, el('th', {}, m.label), el('td', {}, m.value), el('td', { class: 'metric-change' }, m.change ?? '')),
    ))));
  }

  if (ev.taiwanImpact) {
    const ti = ev.taiwanImpact;
    card.append(el('section', { class: 'taiwan-impact', 'data-direction': String(ti.direction) },
      el('h4', {}, '對台灣的影響'),
      el('p', {}, ti.summary),
      ti.channels.length > 0 ? el('div', { class: 'chips' }, ...ti.channels.map((c) => el('span', { class: 'chip' }, c))) : null,
    ));
  }

  if (ev.discrepancy) card.append(section('數據出入', ev.discrepancy, 'discrepancy'));

  card.append(el('footer', {}, el('h4', {}, '來源'), sourceList(ev.sources)));
  return card;
}
