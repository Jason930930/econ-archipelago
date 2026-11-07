import type { ArchiveIndex } from '../data/buildIndex';
import { el } from './dom';
import { shortDate } from './format';

export interface TimelineProps {
  index: ArchiveIndex;
  weekId: string;
  storyline: string | null;
  /** 視窗起點；null = 跟隨目前這週（目前週為視窗最後一欄）。 */
  windowStart: number | null;
  /** 一次顯示幾週（桌機 12、窄螢幕 6）。 */
  windowSize: number;
  onWeek(weekId: string): void;
  onEvent(weekId: string, eventId: string): void;
  onStoryline(id: string): void;
  onWindow(start: number): void;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * 時間軸視窗：start 為 null 時，視窗結尾對齊目前這週；有值時沿用（翻頁），但夾在合法範圍內。
 * 切到別週時，app 會把 start 重設為 null，讓視窗跟著目前這週走。
 */
export function timelineWindow(weekIds: string[], current: string, start: number | null, size: number): { start: number; end: number } {
  const n = weekIds.length;
  const maxStart = Math.max(0, n - size);
  const ci = weekIds.indexOf(current);
  const at = ci < 0 ? n - 1 : ci;
  const s = start === null ? clamp(at - size + 1, 0, maxStart) : clamp(start, 0, maxStart);
  return { start: s, end: Math.min(n, s + size) };
}

const monthOf = (weekId: string) => `${weekId.slice(0, 4)}/${weekId.slice(5, 7)}`;

export function renderTimeline(p: TimelineProps): HTMLElement {
  const all = p.index.weeks;
  const ids = all.map((w) => w.weekId);
  const win = timelineWindow(ids, p.weekId, p.windowStart, p.windowSize);
  const weeks = all.slice(win.start, win.end);
  const inWindow = new Set(weeks.map((w) => w.weekId));
  const step = Math.max(1, Math.floor(p.windowSize / 2));

  const older = el('button', { type: 'button', class: 'timeline-page', 'data-action': 'timeline-older', 'aria-label': '顯示更早的週' }, '‹ 更早');
  older.disabled = win.start === 0;
  older.addEventListener('click', () => p.onWindow(win.start - step));
  const newer = el('button', { type: 'button', class: 'timeline-page', 'data-action': 'timeline-newer', 'aria-label': '顯示較新的週' }, '較新 ›');
  newer.disabled = win.end >= all.length;
  newer.addEventListener('click', () => p.onWindow(win.start + step));
  const nav = el('div', { class: 'timeline-nav' }, older,
    el('span', { class: 'timeline-range muted' }, `第 ${win.start + 1}–${win.end} 週，共 ${all.length} 週`), newer);

  const grid = el('div', { class: 'timeline-inner', role: 'group', 'aria-label': '週次與主線' });
  grid.style.setProperty('--weeks', String(weeks.length));

  // 年月標籤：視窗內連續同年月的週合併成一格。
  grid.append(el('span', { class: 'row-label month-row-label' }, ''));
  for (let i = 0; i < weeks.length;) {
    const m = monthOf(weeks[i]!.weekId);
    let k = 1;
    while (i + k < weeks.length && monthOf(weeks[i + k]!.weekId) === m) k++;
    const cell = el('span', { class: 'month-label' }, m);
    cell.style.gridColumn = `span ${k}`;
    grid.append(cell);
    i += k;
  }

  grid.append(el('span', { class: 'row-label' }, '週次'));
  for (const w of weeks) {
    const b = el('button', { type: 'button', class: 'week-tick', 'data-week': w.weekId, title: w.title, 'aria-current': String(w.weekId === p.weekId) },
      `${shortDate(w.period.start)}–${shortDate(w.period.end)}`);
    b.addEventListener('click', () => p.onWeek(w.weekId));
    grid.append(b);
  }

  // 只列出視窗內有事件的主線；目前高亮的主線即使不在視窗內也保留，方便取消高亮。
  const lines = p.index.storylines.filter((s) => s.id === p.storyline || s.events.some((e) => inWindow.has(e.weekId)));
  for (const s of lines) {
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
  return el('div', { class: 'timeline' }, nav, grid);
}
