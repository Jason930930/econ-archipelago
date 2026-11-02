import type { ArchiveIndex } from '../data/buildIndex';
import type { ResolvedIndicator } from '../data/indicators';
import type { WeekData } from '../data/types';
import { bindingFor } from '../world/indicators';
import { layoutIslands } from '../world/layout';
import { ancestorsOf, isWithin, parsePath } from '../world/paths';
import { getRegion, isRegionId } from '../world/regions';
import { labelOf } from '../world/registry';
import { getSector, isSectorId } from '../world/sectors';
import { channelsTouching } from '../world/channels';
import { renderNodeChannels } from './channelPanel';
import { renderNodeStates, statesFor } from './stateCard';
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

/** 節點面板：麵包屑、說明、指標走勢、此節點與子孫在本週的事件、部門內所有實體。 */
export function renderNodePanel(path: string, week: WeekData, index: ArchiveIndex): HTMLElement {
  const names = labelOf(path, index.entities);
  const chain = [...ancestorsOf(path).reverse(), path];
  const crumbs = el('nav', { class: 'breadcrumb', 'aria-label': '位置' });
  chain.forEach((p, i) => {
    const b = el('button', { type: 'button', 'data-path': p, 'aria-current': String(p === path) }, names[i] ?? p);
    b.addEventListener('click', () => b.dispatchEvent(new CustomEvent('select-node', { detail: { path: p }, bubbles: true })));
    if (i > 0) crumbs.append(el('span', { class: 'crumb-sep', 'aria-hidden': 'true' }, '›'));
    crumbs.append(b);
  });

  const p = parsePath(path);
  const panel = el('section', { class: 'node-panel', 'data-path': path }, crumbs, el('h3', {}, names.at(-1) ?? path));
  if (p && !p.sector && isRegionId(p.region)) {
    const r = getRegion(p.region);
    if (r.gdp !== null) panel.append(el('p', { class: 'muted' }, `約略 GDP ${r.gdp.toFixed(1)} 兆美元${layoutIslands().get(p.region)?.enlarged ? '（島嶼為可讀性放大）' : ''}`));
  } else if (p?.sector && !p.entity && isSectorId(p.sector)) {
    panel.append(el('p', { class: 'muted' }, `${names[0]}的${getSector(p.sector).name}`));
  }

  const b = bindingFor(path);
  if (b) {
    const weeks = index.weeks.filter((w) => w.weekId <= week.weekId).slice(-12);
    const key = b.keys.find((k) => index.indicators[week.weekId]?.[k].value !== null) ?? b.keys[0]!;
    const series = weeks.map((w) => ({ weekId: w.weekId, r: index.indicators[w.weekId]![key] }));
    const now = index.indicators[week.weekId]?.[key];
    const cls = now?.range && now.status === 'fresh' ? 'indicator has-range' : 'indicator';
    panel.append(el('div', { class: cls },
      el('div', { class: 'indicator-head' }, el('span', {}, INDICATOR_LABELS[key]), el('strong', {}, now ? formatIndicator(key, now) : '無資料')),
      now?.note ? el('p', { class: 'indicator-note' }, now.note) : null,
      sparkline(series),
    ));
  }

  const related = week.events.filter((e) => e.places.some((pl) => isWithin(pl, path))).sort((a, b2) => a.rank - b2.rank);
  panel.append(el('h4', {}, '本週相關事件'));
  if (related.length === 0) panel.append(el('p', { class: 'muted' }, '本週沒有直接相關的事件。'));
  else {
    const list = el('ul', { class: 'related' });
    for (const ev of related) {
      const btn = el('button', { type: 'button', 'data-event-id': ev.id }, ev.title);
      btn.addEventListener('click', () => btn.dispatchEvent(new CustomEvent('select-event', { detail: { eventId: ev.id }, bubbles: true })));
      list.append(el('li', {}, btn));
    }
    panel.append(list);
  }

  const nodeStates = renderNodeStates(path, statesFor(week.weekId, index), index, week.weekId);
  if (nodeStates) panel.append(nodeStates);

  const channels = renderNodeChannels(channelsTouching(path), week.weekId, index);
  if (channels) panel.append(channels);

  if (p?.sector && !p.entity) {
    const ents = index.entities.filter((e) => e.region === p.region && e.sector === p.sector);
    if (ents.length > 0) {
      panel.append(el('h4', {}, '此部門的實體'));
      const list = el('ul', { class: 'entity-list' });
      for (const e of ents) {
        const btn = el('button', { type: 'button', 'data-path': `${path}/${e.id}` }, e.name);
        btn.addEventListener('click', () => btn.dispatchEvent(new CustomEvent('select-node', { detail: { path: `${path}/${e.id}` }, bubbles: true })));
        list.append(el('li', {}, btn));
      }
      panel.append(list);
    }
  }
  return panel;
}
