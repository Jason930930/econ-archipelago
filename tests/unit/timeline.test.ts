// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import type { ArchiveIndex } from '../../src/data/buildIndex';
import { renderTimeline, timelineWindow } from '../../src/ui/timeline';

const addDays = (s: string, n: number) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** 20 個週五：2026-08-28 起。 */
const ids = Array.from({ length: 20 }, (_, i) => addDays('2026-08-28', 7 * i));
const fakeIndex = (storylines: ArchiveIndex['storylines']) => ({
  weeks: ids.map((weekId) => ({ weekId, title: `週報 ${weekId}`, period: { start: addDays(weekId, -6), end: weekId } })),
  storylines,
}) as unknown as ArchiveIndex;
const index = fakeIndex([
  { id: 'old', name: '舊主線', events: [{ weekId: ids[1]!, eventId: 'e1', title: 'a' }] },
  { id: 'new', name: '新主線', events: [{ weekId: ids[18]!, eventId: 'e2', title: 'b' }] },
]);
const props = (over: Partial<Parameters<typeof renderTimeline>[0]> = {}) => ({
  index, weekId: ids[19]!, storyline: null, windowStart: null, windowSize: 12,
  onWeek: vi.fn(), onEvent: vi.fn(), onStoryline: vi.fn(), onWindow: vi.fn(), ...over,
});

describe('timelineWindow', () => {
  test('default window ends at the current week', () => {
    expect(timelineWindow(ids, ids[19]!, null, 12)).toEqual({ start: 8, end: 20 });
    expect(timelineWindow(ids, ids[15]!, null, 12)).toEqual({ start: 4, end: 16 });
  });
  test('current outside the window moves the window (when following the current week)', () => {
    expect(timelineWindow(ids, ids[3]!, null, 12)).toEqual({ start: 0, end: 12 });
  });
  test('fewer weeks than the window', () => {
    expect(timelineWindow(ids.slice(0, 3), ids[2]!, null, 12)).toEqual({ start: 0, end: 3 });
  });
  test('explicit start is kept (paging) but clamped', () => {
    expect(timelineWindow(ids, ids[19]!, 2, 12)).toEqual({ start: 2, end: 14 });
    expect(timelineWindow(ids, ids[19]!, 50, 12)).toEqual({ start: 8, end: 20 });
    expect(timelineWindow(ids, ids[19]!, -3, 12)).toEqual({ start: 0, end: 12 });
  });
  test('unknown current week behaves like the latest', () => {
    expect(timelineWindow(ids, 'nope', null, 12)).toEqual({ start: 8, end: 20 });
  });
});

describe('renderTimeline', () => {
  test('only draws weeks inside the window', () => {
    const t = renderTimeline(props());
    const ticks = [...t.querySelectorAll<HTMLElement>('.week-tick')].map((b) => b.dataset.week);
    expect(ticks).toEqual(ids.slice(8, 20));
  });
  test('month labels merge consecutive weeks', () => {
    const t = renderTimeline(props());
    const months = [...t.querySelectorAll<HTMLElement>('.month-label')].map((m) => [m.textContent, m.style.gridColumn]);
    // 窗內 ids[8..19] = 2026-10-23 … 2027-01-08
    expect(months).toEqual([['2026/10', 'span 2'], ['2026/11', 'span 4'], ['2026/12', 'span 4'], ['2027/01', 'span 2']]);
  });
  test('paging buttons step half a window and disable at the ends', () => {
    const p = props();
    const t = renderTimeline(p);
    const older = t.querySelector<HTMLButtonElement>('[data-action="timeline-older"]')!;
    const newer = t.querySelector<HTMLButtonElement>('[data-action="timeline-newer"]')!;
    expect(newer.disabled).toBe(true);
    expect(older.disabled).toBe(false);
    older.click();
    expect(p.onWindow).toHaveBeenCalledWith(2);
    const first = renderTimeline(props({ windowStart: 0 }));
    expect(first.querySelector<HTMLButtonElement>('[data-action="timeline-older"]')!.disabled).toBe(true);
    const narrow = props({ windowSize: 6 });
    renderTimeline(narrow).querySelector<HTMLButtonElement>('[data-action="timeline-older"]')!.click();
    expect(narrow.onWindow).toHaveBeenCalledWith(11);
  });
  test('only storylines with events in the window are listed', () => {
    const t = renderTimeline(props());
    expect([...t.querySelectorAll<HTMLElement>('[data-storyline]')].map((b) => b.dataset.storyline)).toEqual(['new']);
  });
  test('highlighted storyline stays visible', () => {
    const t = renderTimeline(props({ storyline: 'old' }));
    expect([...t.querySelectorAll<HTMLElement>('[data-storyline]')].map((b) => b.dataset.storyline)).toEqual(['old', 'new']);
  });
  test('range caption shows the window', () => {
    expect(renderTimeline(props()).querySelector('.timeline-range')!.textContent).toBe('第 9–20 週，共 20 週');
  });
});
