// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildIndex } from '../../src/data/buildIndex';
import type { WeekData } from '../../src/data/types';
import { renderEntityPanel } from '../../src/ui/entityPanel';
import { renderEventCard } from '../../src/ui/eventCard';
import { renderTextMode } from '../../src/ui/textMode';
import { makeEvent, makeWeek } from './helpers';

const load = (id: string) => JSON.parse(readFileSync(`data/weeks/${id}.json`, 'utf8')) as WeekData;

describe('renderEventCard', () => {
  test('renders data as text not HTML', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const card = renderEventCard(makeEvent({ title: evil, what: `${evil} & more` }), { index: 0, total: 5 });
    expect(card.querySelector('img')).toBeNull();
    expect(card.textContent).toContain(evil);
  });
  test('shows position in the story', () => {
    expect(renderEventCard(makeEvent(), { index: 1, total: 5 }).textContent).toContain('2 / 5');
  });
  test('hides taiwan impact block when null', () => {
    expect(renderEventCard(makeEvent({ taiwanImpact: null }), { index: 0, total: 1 }).textContent).not.toContain('對台灣的影響');
  });
  test('shows taiwan impact when present', () => {
    const card = renderEventCard(makeEvent({ taiwanImpact: { summary: '供應鏈承壓', direction: -1, channels: ['半導體'] } }), { index: 0, total: 1 });
    expect(card.querySelector('.taiwan-impact')?.textContent).toContain('供應鏈承壓');
  });
  test('discrepancy gets its own element', () => {
    expect(renderEventCard(makeEvent({ discrepancy: '來源不一' }), { index: 0, total: 1 }).querySelector('.discrepancy')).not.toBeNull();
    expect(renderEventCard(makeEvent(), { index: 0, total: 1 }).querySelector('.discrepancy')).toBeNull();
  });
  test('source links open safely in a new tab', () => {
    const a = renderEventCard(makeEvent(), { index: 0, total: 1 }).querySelector('a')!;
    expect(a.getAttribute('rel')).toContain('noopener');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('href')).toBe('https://x.com');
  });
  test('non-https source is not rendered as a link', () => {
    const card = renderEventCard(makeEvent({ sources: [{ title: 'bad', url: 'javascript:alert(1)' }] }), { index: 0, total: 1 });
    expect(card.querySelector('a')).toBeNull();
  });
});

describe('renderEntityPanel', () => {
  const weeks = ['2026-10-16', '2026-10-23', '2026-10-30'].map(load);
  const index = buildIndex(weeks);
  const latest = weeks[2]!;
  test('lists only events touching the entity', () => {
    const panel = renderEntityPanel('tw-twse', latest, index);
    const items = [...panel.querySelectorAll('[data-event-id]')].map((b) => b.getAttribute('data-event-id'));
    expect(items).toEqual(['e4']);
  });
  test('clicking a related event dispatches select-event', () => {
    const panel = renderEntityPanel('tw-twse', latest, index);
    let got: string | null = null;
    panel.addEventListener('select-event', (e) => (got = (e as CustomEvent<{ eventId: string }>).detail.eventId));
    (panel.querySelector('[data-event-id]') as HTMLElement).click();
    expect(got).toBe('e4');
  });
  test('draws a sparkline for mapped indicators', () => {
    const panel = renderEntityPanel('me-oil', latest, index);
    expect(panel.querySelector('svg polyline')).not.toBeNull();
    expect(panel.textContent).toContain('Brent');
  });
  test('missing indicator says 無資料', () => {
    const panel = renderEntityPanel('crypto', weeks[0]!, buildIndex([weeks[0]!]));
    expect(panel.textContent).toContain('無資料');
  });
  test('shows the indicator note so differing periods are visible', () => {
    const panel = renderEntityPanel('tw-twse', latest, index);
    expect(panel.querySelector('.indicator-note')?.textContent).toBe('10/30 單日漲跌');
  });
  test('marks indicators with a source range as discrepant', () => {
    expect(renderEntityPanel('me-oil', latest, index).querySelector('.indicator.has-range')).not.toBeNull();
    expect(renderEntityPanel('tw-twse', latest, index).querySelector('.indicator.has-range')).toBeNull();
  });
  test('entity without indicator has no chart', () => {
    expect(renderEntityPanel('kr-memory', latest, index).querySelector('svg')).toBeNull();
  });
});

describe('renderTextMode', () => {
  test('renders cards in the given order with watchlist', () => {
    const w = makeWeek('2026-10-30', {
      events: [makeEvent({ id: 'e1', rank: 1, title: 'A' }), makeEvent({ id: 'e2', rank: 2, title: 'B' })],
      links: [{ from: 'e2', to: 'e1', label: '因為' }],
      watchlist: [{ date: '2026-11-06', text: '就業報告', entities: ['us-fed'], confirmed: false }],
    });
    const el = renderTextMode(w, ['e2', 'e1']);
    expect([...el.querySelectorAll('.event-card h3')].map((h) => h.textContent)).toEqual(['B', 'A']);
    expect(el.textContent).toContain('B → A');
    expect(el.textContent).toContain('就業報告（未確認）');
  });
});
