import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { validateArchive, validateWeek } from '../../src/data/validate';
import { ENTITY_IDS } from '../../src/world/entities';
import { INDICATOR_KEYS } from '../../src/data/types';

const base = () => JSON.parse(readFileSync('tests/fixtures/valid-week.json', 'utf8'));
const FILE = '2026-10-30.json';
const none = new Set<string>();

function expectError(mutate: (w: any) => void, pathPart: string, file = FILE) {
  const w = base();
  mutate(w);
  const errs = validateWeek(w, file, none);
  expect(errs.length, JSON.stringify(errs)).toBeGreaterThan(0);
  expect(errs.some((e) => e.path.includes(pathPart)), JSON.stringify(errs)).toBe(true);
}

describe('validateWeek', () => {
  test('valid fixture has no errors', () => {
    expect(validateWeek(base(), FILE, none)).toEqual([]);
  });
  test('unknown entity', () => expectError((w) => { w.events[0].entities.push('tw-memory'); }, '/events/0/entities'));
  test('primaryEntity not in entities', () => expectError((w) => { w.events[0].primaryEntity = 'us-fed'; }, '/events/0/primaryEntity'));
  test('weekId differs from file name', () => expectError(() => {}, '/weekId', '2026-10-23.json'));
  test('period.end differs from weekId', () => expectError((w) => { w.period.end = '2026-10-29'; }, '/period/end'));
  test('start after end', () => expectError((w) => { w.period.start = '2026-10-31'; }, '/period/start'));
  test('duplicate rank', () => expectError((w) => { w.events[1].rank = 1; }, '/events/1/rank'));
  test('rank not contiguous from 1', () => expectError((w) => { w.events[1].rank = 3; }, '/events/1/rank'));
  test('duplicate event id', () => expectError((w) => { w.events[1].id = 'e1'; }, '/events/1/id'));
  test('link to unknown event', () => expectError((w) => { w.links[0].to = 'e9'; }, '/links/0/to'));
  test('self link', () => expectError((w) => { w.links[0].to = 'e2'; }, '/links/0'));
  test('sentiment out of range', () => expectError((w) => { w.events[0].sentiment = 4; }, '/events/0/sentiment'));
  test('sentiment not integer', () => expectError((w) => { w.events[0].sentiment = 1.5; }, '/events/0/sentiment'));
  test('taiwanImpact direction invalid', () => expectError((w) => { w.events[0].taiwanImpact.direction = 2; }, '/events/0/taiwanImpact/direction'));
  test('http url rejected', () => expectError((w) => { w.events[0].sources[0].url = 'http://x.com'; }, '/events/0/sources/0/url'));
  test('google redirect url rejected', () => expectError((w) => { w.events[0].sources[0].url = 'https://www.google.com/url?q=https://x.com'; }, '/events/0/sources/0/url'));
  test('undefined storyline rejected', () => expectError((w) => { w.events[1].storylines = ['hormuz-tension']; }, '/events/1/storylines/0'));
  test('weekId must be a Friday', () => {
    const w = base();
    w.weekId = '2026-10-29'; w.period = { start: '2026-10-23', end: '2026-10-29' };
    const errs = validateWeek(w, '2026-10-29.json', none);
    expect(errs.some((e) => e.path === '/weekId' && e.message.includes('週五'))).toBe(true);
  });
  test('impossible calendar date rejected', () => expectError((w) => { w.events[0].date = '2026-02-30'; }, '/events/0/date'));
  test('watchlist impossible date rejected', () => expectError((w) => { w.watchlist[0].date = '2026-13-01'; }, '/watchlist/0/date'));
  test('missing indicator keys allowed', () => {
    const w = base();
    w.indicators = {};
    expect(validateWeek(w, FILE, none)).toEqual([]);
  });
  test('unknown indicator key rejected', () => expectError((w) => { w.indicators.eth = { value: 1 }; }, '/indicators'));
  test('non-object input reports error', () => {
    expect(validateWeek(null, FILE, none).length).toBeGreaterThan(0);
  });
});

describe('validateArchive', () => {
  test('storyline defined in an earlier week is accepted', () => {
    const w1 = base();
    w1.weekId = '2026-10-23'; w1.period = { start: '2026-10-17', end: '2026-10-23' };
    w1.storylines.push({ id: 'hormuz-tension', name: '荷莫茲緊張' });
    const w2 = base();
    w2.events[1].storylines = ['hormuz-tension'];
    expect(validateArchive([{ fileName: FILE, raw: w2 }, { fileName: '2026-10-23.json', raw: w1 }])).toEqual([]);
  });
  test('storyline defined only in a later week is rejected', () => {
    const w1 = base();
    w1.weekId = '2026-10-23'; w1.period = { start: '2026-10-17', end: '2026-10-23' };
    w1.events[1].storylines = ['hormuz-tension'];
    const w2 = base();
    w2.storylines.push({ id: 'hormuz-tension', name: '荷莫茲緊張' });
    const errs = validateArchive([{ fileName: '2026-10-23.json', raw: w1 }, { fileName: FILE, raw: w2 }]);
    expect(errs.some((e) => e.file === '2026-10-23.json')).toBe(true);
  });
  test('duplicate weekId across files rejected', () => {
    const errs = validateArchive([{ fileName: FILE, raw: base() }, { fileName: FILE, raw: base() }]);
    expect(errs.length).toBeGreaterThan(0);
  });
});

describe('schema stays in sync with code', () => {
  const schema = JSON.parse(readFileSync('schema/week.schema.json', 'utf8'));
  test('schema entity enum equals ENTITY_IDS', () => {
    expect([...schema.$defs.entityId.enum].sort()).toEqual([...ENTITY_IDS].sort());
  });
  test('schema indicator keys equal INDICATOR_KEYS', () => {
    expect(Object.keys(schema.properties.indicators.properties).sort()).toEqual([...INDICATOR_KEYS].sort());
  });
});
