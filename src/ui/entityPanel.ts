import type { ArchiveIndex } from '../data/buildIndex';
import type { ResolvedIndicator } from '../data/indicators';
import type { IndicatorKey, WeekData } from '../data/types';
import { getEntity, type EntityId } from '../world/entities';
import { ENTITY_INDICATORS } from '../world/entityIndicators';
import { el, svg } from './dom';
import { formatIndicator, INDICATOR_LABELS, shortDate } from './format';

const W = 260;
const H = 64;
const PAD = 6;

function sparkline(series: { weekId: string; r: ResolvedIndicator }[]): SVGSVGElement {
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'sparkline', role: 'img' });
  const vals = series.map((p) => p.r.value).filter((v): v is number => v !== null);
  if (vals.length === 0) return s;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => (series.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (series.length - 1));
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
  let run: string[] = [];
  const flush = () => {
    if (run.length > 1) s.append(svg('polyline', { points: run.join(' '), fill: 'none', class: 'spark-line' }));
    run = [];
  };
  series.forEach((p, i) => {
    if (p.r.value === null) return flush();
    run.push(`${x(i)},${y(p.r.value)}`);
  });
  flush();
  series.forEach((p, i) => {
    if (p.r.value === null) return;
    const c = svg('circle', { cx: x(i), cy: y(p.r.value), r: 3.2, class: p.r.status === 'stale' ? 'spark-dot stale' : 'spark-dot' });
    c.append(svg('title'));
    c.lastChild!.textContent = `${shortDate(p.weekId)}：${p.r.value}`;
    s.append(c);
  });
  return s;
}

export function renderEntityPanel(id: EntityId, week: WeekData, index: ArchiveIndex): HTMLElement {
  const def = getEntity(id);
  const panel = el('section', { class: 'entity-panel', 'data-entity': id },
    el('div', { class: 'card-meta' }, '地標'),
    el('h3', {}, def.name),
    el('p', { class: 'muted' }, def.covers),
  );

  const keys: IndicatorKey[] = ENTITY_INDICATORS[id] ?? [];
  const weeks = index.weeks.filter((w) => w.weekId <= week.weekId).slice(-12);
  for (const key of keys) {
    const series = weeks.map((w) => ({ weekId: w.weekId, r: index.indicators[w.weekId]![key] }));
    const now = index.indicators[week.weekId]?.[key];
    const cls = now?.range && now.status === 'fresh' ? 'indicator has-range' : 'indicator';
    panel.append(el('div', { class: cls },
      el('div', { class: 'indicator-head' }, el('span', {}, INDICATOR_LABELS[key]), el('strong', {}, now ? formatIndicator(key, now) : '無資料')),
      now?.note ? el('p', { class: 'indicator-note' }, now.note) : null,
      sparkline(series),
    ));
  }

  const related = week.events.filter((e) => e.entities.includes(id)).sort((a, b) => a.rank - b.rank);
  panel.append(el('h4', {}, '本週相關事件'));
  if (related.length === 0) panel.append(el('p', { class: 'muted' }, '本週沒有直接相關的事件。'));
  else {
    const list = el('ul', { class: 'related' });
    for (const ev of related) {
      const btn = el('button', { type: 'button', 'data-event-id': ev.id }, ev.title);
      btn.addEventListener('click', () => panel.dispatchEvent(new CustomEvent('select-event', { detail: { eventId: ev.id }, bubbles: true })));
      list.append(el('li', {}, btn));
    }
    panel.append(list);
  }
  return panel;
}
