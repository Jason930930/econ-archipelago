import type { ArchiveIndex } from '../data/buildIndex';
import { el } from './dom';
import { shortDate } from './format';

export interface TimelineProps {
  index: ArchiveIndex;
  weekId: string;
  storyline: string | null;
  onWeek(weekId: string): void;
  onEvent(weekId: string, eventId: string): void;
  onStoryline(id: string): void;
}

export function renderTimeline(p: TimelineProps): HTMLElement {
  const weeks = p.index.weeks;
  const grid = el('div', { class: 'timeline-inner', role: 'group', 'aria-label': '週次與主線' });
  grid.style.setProperty('--weeks', String(weeks.length));

  grid.append(el('span', { class: 'row-label' }, '週次'));
  for (const w of weeks) {
    const b = el('button', { type: 'button', class: 'week-tick', 'data-week': w.weekId, title: w.title, 'aria-current': String(w.weekId === p.weekId) },
      `${shortDate(w.period.start)}–${shortDate(w.period.end)}`);
    b.addEventListener('click', () => p.onWeek(w.weekId));
    grid.append(b);
  }

  for (const s of p.index.storylines) {
    const active = p.storyline === s.id;
    const lbl = el('button', { type: 'button', class: 'row-label', 'aria-pressed': String(active), 'data-storyline': s.id, title: `${s.name}（點擊高亮）` }, s.name);
    lbl.addEventListener('click', () => p.onStoryline(s.id));
    grid.append(lbl);
    for (const w of weeks) {
      const evs = s.events.filter((e) => e.weekId === w.weekId);
      const cell = el('div', { class: 'lane-cell' });
      if (evs.length > 0) {
        const cls = ['lane-dot', w.weekId === p.weekId ? 'current' : '', active ? 'highlight' : ''].filter(Boolean).join(' ');
        const dot = el('button', { type: 'button', class: cls, title: evs.map((e) => e.title).join('\n'), 'aria-label': `${s.name}：${evs[0]!.title}` });
        dot.addEventListener('click', () => p.onEvent(w.weekId, evs[0]!.eventId));
        cell.append(dot);
      }
      grid.append(cell);
    }
  }
  return el('div', { class: 'timeline' }, grid);
}
