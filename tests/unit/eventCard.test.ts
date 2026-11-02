// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildIndex } from '../../src/data/buildIndex';
import type { WeekData } from '../../src/data/types';
import { renderEventCard } from '../../src/ui/eventCard';
import { renderNodePanel } from '../../src/ui/nodePanel';
import { renderTextMode } from '../../src/ui/textMode';
import type { EntityRecord } from '../../src/world/registry';
import { makeEvent, makeWeek } from './helpers';

const load = (id: string) => JSON.parse(readFileSync(`data/weeks/${id}.json`, 'utf8')) as WeekData;
const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];
const card = (ev = makeEvent(), index = 0, total = 5) => renderEventCard(ev, { index, total }, seed);

describe('renderEventCard', () => {
  test('renders data as text not HTML', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const c = card(makeEvent({ title: evil, what: `${evil} & more` }));
    expect(c.querySelector('img')).toBeNull();
    expect(c.textContent).toContain(evil);
  });
  test('shows position in the story', () => expect(card(makeEvent(), 1).textContent).toContain('2 / 5'));
  test('hides taiwan impact block when null', () => expect(card(makeEvent({ taiwanImpact: null })).textContent).not.toContain('對台灣的影響'));
  test('shows taiwan impact when present', () => {
    const c = card(makeEvent({ taiwanImpact: { summary: '供應鏈承壓', direction: -1, channels: ['半導體'] } }));
    expect(c.querySelector('.taiwan-impact')?.textContent).toContain('供應鏈承壓');
  });
  test('discrepancy gets its own element', () => {
    expect(card(makeEvent({ discrepancy: '來源不一' })).querySelector('.discrepancy')).not.toBeNull();
    expect(card().querySelector('.discrepancy')).toBeNull();
  });
  test('source links open safely in a new tab', () => {
    const a = card().querySelector('a')!;
    expect(a.getAttribute('rel')).toContain('noopener');
    expect(a.getAttribute('target')).toBe('_blank');
  });
  test('non-https source is not rendered as a link', () => {
    expect(card(makeEvent({ sources: [{ title: 'bad', url: 'javascript:alert(1)' }] })).querySelector('a')).toBeNull();
  });
  test('event card shows place labels', () => {
    const c = card(makeEvent({ primary: 'tw/semiconductor/tsmc', places: ['tw/semiconductor/tsmc', 'us/equity'] }));
    expect(c.querySelector('.card-meta')!.textContent).toContain('台灣 › 半導體 › 台積電、美國 › 股市');
  });
});

describe('renderNodePanel', () => {
  const weeks = ['2026-10-16', '2026-10-23', '2026-10-30'].map(load);
  const index = buildIndex(weeks, seed);
  const latest = weeks[2]!;
  const panel = (path: string, week = latest, idx = index) => renderNodePanel(path, week, idx);

  test('breadcrumb levels', () => {
    expect([...panel('tw/semiconductor/tsmc').querySelectorAll('.breadcrumb button')].map((b) => b.textContent)).toEqual(['台灣', '半導體', '台積電']);
  });
  test('clicking a breadcrumb dispatches select-node', () => {
    const p = panel('tw/semiconductor/tsmc');
    let got: string | null = null;
    p.addEventListener('select-node', (e) => (got = (e as CustomEvent<{ path: string }>).detail.path));
    (p.querySelector('.breadcrumb button') as HTMLElement).click();
    expect(got).toBe('tw');
  });
  test('breadcrumb renders names as text', () => {
    const idx = { ...index, entities: [...index.entities, { id: 'evil', name: '<b>x</b>', region: 'tw', sector: 'semiconductor', aliases: [], addedIn: 'x' } as EntityRecord] };
    const p = renderNodePanel('tw/semiconductor/evil', latest, idx);
    expect(p.querySelector('b')).toBeNull();
    expect(p.textContent).toContain('<b>x</b>');
  });
  test('region panel lists descendant events', () => {
    const titles = [...panel('tw', weeks[0]!).querySelectorAll('[data-event-id]')].map((b) => b.textContent);
    expect(titles.some((t) => t!.includes('台積電法說'))).toBe(true);
  });
  test('clicking a related event dispatches select-event', () => {
    const p = panel('tw/equity');
    let got: string | null = null;
    p.addEventListener('select-event', (e) => (got = (e as CustomEvent<{ eventId: string }>).detail.eventId));
    (p.querySelector('[data-event-id]') as HTMLElement).click();
    expect(got).toBe('e4');
  });
  test('district panel lists all entities incl. hidden', () => {
    const names = [...panel('us/tech').querySelectorAll('.entity-list li')].map((li) => li.textContent);
    expect(names.length).toBeGreaterThanOrEqual(6);
    expect(names).toContain('CoreWeave');
  });
  test('region panel shows approximate GDP', () => expect(panel('us').textContent).toContain('約略'));
  test('draws a sparkline with note for a bound indicator', () => {
    const p = panel('tw/equity');
    expect(p.querySelector('svg polyline')).not.toBeNull();
    expect(p.querySelector('.indicator-note')?.textContent).toBe('10/30 單日漲跌');
  });
  test('marks indicators with a source range as discrepant', () => {
    expect(panel('gulf/energy').querySelector('.indicator.has-range')).not.toBeNull();
    expect(panel('tw/equity').querySelector('.indicator.has-range')).toBeNull();
  });
  test('missing indicator says 無資料', () => {
    expect(renderNodePanel('intl/crypto/bitcoin', weeks[0]!, buildIndex([weeks[0]!], seed)).textContent).toContain('無資料');
  });
  test('node without indicator has no chart', () => expect(panel('kr/memory').querySelector('svg')).toBeNull());
});

describe('renderTextMode', () => {
  test('renders cards in the given order with watchlist', () => {
    const w = makeWeek('2026-10-30', {
      events: [makeEvent({ id: 'e1', rank: 1, title: 'A' }), makeEvent({ id: 'e2', rank: 2, title: 'B' })],
      links: [{ from: 'e2', to: 'e1', label: '因為' }],
      watchlist: [{ date: '2026-11-06', text: '就業報告', places: ['us/central-bank'], confirmed: false }],
    });
    const el = renderTextMode(w, ['e2', 'e1'], seed);
    expect([...el.querySelectorAll('.event-card h3')].map((h) => h.textContent)).toEqual(['B', 'A']);
    expect(el.textContent).toContain('B → A');
    expect(el.textContent).toContain('就業報告（未確認）');
  });
});
