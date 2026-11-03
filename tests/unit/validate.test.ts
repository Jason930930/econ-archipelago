import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { validateArchive, validateWeek } from '../../src/data/validate';
import { INDICATOR_KEYS } from '../../src/data/types';
import { PATH_PATTERN } from '../../src/world/paths';
import type { EntityRecord } from '../../src/world/registry';

const base = () => JSON.parse(readFileSync('tests/fixtures/valid-week.json', 'utf8'));
const FILE = '2026-10-30.json';
const none = new Set<string>();
const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];
const ctx = { knownStorylines: none, entities: seed, proposals: new Map() };

function expectError(mutate: (w: any) => void, pathPart: string, file = FILE) {
  const w = base();
  mutate(w);
  const errs = validateWeek(w, file, ctx);
  expect(errs.length, JSON.stringify(errs)).toBeGreaterThan(0);
  expect(errs.some((e) => e.path.includes(pathPart)), JSON.stringify(errs)).toBe(true);
}

describe('validateWeek', () => {
  test('valid fixture has no errors', () => {
    expect(validateWeek(base(), FILE, ctx)).toEqual([]);
  });
  test('v1 file rejected with guide hint', () => {
    const w = base(); w.schemaVersion = 1;
    const errs = validateWeek(w, FILE, ctx);
    expect(errs).toHaveLength(1);
    expect(errs[0]!.message).toContain('schemaVersion 2');
  });
  test('malformed path', () => expectError((w) => { w.events[0].places.push('TW/Semi'); }, '/events/0/places'));
  test('unknown region', () => expectError((w) => { w.events[0].places.push('xx/equity'); }, '/events/0/places/4'));
  test('sector not allowed in region', () => expectError((w) => { w.events[0].places.push('tw/shipping-lane'); }, '/events/0/places/4'));
  test('entity must match path', () => expectError((w) => { w.events[0].places.push('jp/semiconductor/tsmc'); }, '/events/0/places/4'));
  test('primary must be in places', () => expectError((w) => { w.events[0].primary = 'us/bonds'; }, '/events/0/primary'));
  test('entity introduced this week can be referenced', () => expect(validateWeek(base(), FILE, ctx)).toEqual([]));
  test('newEntities collision reported at its index', () => expectError((w) => { w.newEntities.push({ id: 'tsmc-x', name: 'tsmc', region: 'tw', sector: 'semiconductor', aliases: [] }); }, '/newEntities/1/name'));
  test('watchlist places validated', () => expectError((w) => { w.watchlist[0].places = ['zz']; }, '/watchlist/0/places/0'));
  test('unknown channel id on a link', () => expectError((w) => { w.links[0].channel = 'nope'; }, '/links/0/channel'));
  test('unknown channel id on an event', () => expectError((w) => { w.events[0].channels = ['nope']; }, '/events/0/channels/0'));
  test('link channel must touch both ends', () => {
    const w = base(); w.links[0].channel = 'us-equity-to-tw-equity';
    const errs = validateWeek(w, FILE, ctx);
    expect(errs.some((e) => e.path === '/links/0/channel' && e.message.includes('起點')), JSON.stringify(errs)).toBe(true);
  });
  test('link channel that touches both ends is fine', () => {
    const w = base(); w.links[0] = { from: 'e2', to: 'e1', label: 'x', channel: 'oil-to-us-inflation' };
    expect(validateWeek(w, FILE, ctx)).toEqual([]);
  });
  test('event channel must touch an end', () => expectError((w) => { w.events[1].channels = ['tsmc-to-tw-equity']; }, '/events/1/channels/0'));
  test('duplicate event channel', () => expectError((w) => { w.events[0].channels = ['ai-capex-to-tw-semis', 'ai-capex-to-tw-semis']; }, '/events/0/channels'));
  test('proposal id clashes with core channel', () => expectError((w) => { w.proposedChannels[0].id = 'oil-to-us-inflation'; }, '/proposedChannels/0/id'));
  test('promoted proposal (same id and paths as a core channel) still validates', () => {
    const w = base(); Object.assign(w.proposedChannels[0], { id: 'fed-to-us-yield', fromPath: 'us/central-bank', toPath: 'us/bonds' });
    w.events[0].places.push('us/central-bank');
    expect(validateWeek(w, FILE, ctx)).toEqual([]);
  });
  test('proposal reusing a core id with different paths is still rejected', () => {
    const w = base(); Object.assign(w.proposedChannels[0], { id: 'fed-to-us-yield' });
    const errs = validateWeek(w, FILE, ctx);
    expect(errs.some((e) => e.path === '/proposedChannels/0/id'), JSON.stringify(errs)).toBe(true);
  });
  test('proposal duplicates a core pair', () => {
    const w = base(); Object.assign(w.proposedChannels[0], { fromPath: 'us/central-bank', toPath: 'us/bonds' });
    w.events[0].places.push('us/central-bank');
    const errs = validateWeek(w, FILE, ctx);
    expect(errs.some((e) => e.path === '/proposedChannels/0' && e.message.includes('fed-to-us-yield')), JSON.stringify(errs)).toBe(true);
  });
  test('proposal evidence must exist', () => expectError((w) => { w.proposedChannels[0].evidence = ['e9']; }, '/proposedChannels/0/evidence/0'));
  test('proposal evidence must touch an end', () => expectError((w) => { w.proposedChannels[0].evidence = ['e2']; }, '/proposedChannels/0/evidence/0'));
  test('proposal unresolvable path', () => expectError((w) => { w.proposedChannels[0].toPath = 'zz/tech'; }, '/proposedChannels/0/toPath'));
  test('proposal same from/to', () => expectError((w) => { w.proposedChannels[0].toPath = 'jp/tech'; }, '/proposedChannels/0/toPath'));
  test('proposal empty mechanism', () => expectError((w) => { w.proposedChannels[0].mechanism = ' '; }, '/proposedChannels/0/mechanism'));
  test('proposal repeated id within a week', () => expectError((w) => { w.proposedChannels.push({ ...w.proposedChannels[0] }); }, '/proposedChannels/1/id'));
  test('unknown node in nodeStates', () => expectError((w) => { w.nodeStates[0].node = 'nope'; }, '/nodeStates/0/node'));
  test('fred node in nodeStates is rejected with its source', () => {
    const w = base(); w.nodeStates[0].node = 'us.long-yield'; w.events[0].places.push('us/bonds');
    const errs = validateWeek(w, FILE, ctx);
    expect(errs.some((e) => e.path === '/nodeStates/0/node' && e.message.includes('DGS10')), JSON.stringify(errs)).toBe(true);
  });
  test('report indicator node in nodeStates is rejected', () => {
    const w = base(); w.nodeStates[0].node = 'intl.gold';
    const errs = validateWeek(w, FILE, ctx);
    expect(errs.some((e) => e.path === '/nodeStates/0/node' && e.message.includes('gold')), JSON.stringify(errs)).toBe(true);
  });
  test('duplicate node in nodeStates', () => expectError((w) => { w.nodeStates.push({ ...w.nodeStates[0] }); }, '/nodeStates/1/node'));
  test('empty basis in nodeStates', () => expectError((w) => { w.nodeStates[0].basis = '  '; }, '/nodeStates/0/basis'));
  test('nodeStates evidence must exist', () => expectError((w) => { w.nodeStates[0].evidence = ['e9']; }, '/nodeStates/0/evidence/0'));
  test('nodeStates evidence must touch the node', () => expectError((w) => { w.nodeStates[0].evidence = ['e2']; }, '/nodeStates/0/evidence/0'));
  test('nodeStates level is an enum', () => expectError((w) => { w.nodeStates[0].level = 'huge'; }, '/nodeStates/0/level'));
  test('region-only primary is fine', () => {
    const w = base(); w.events[0].primary = 'us'; w.events[0].places.push('us');
    expect(validateWeek(w, FILE, ctx)).toEqual([]);
  });
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
    const errs = validateWeek(w, '2026-10-29.json', ctx);
    expect(errs.some((e) => e.path === '/weekId' && e.message.includes('週五'))).toBe(true);
  });
  test('impossible calendar date rejected', () => expectError((w) => { w.events[0].date = '2026-02-30'; }, '/events/0/date'));
  test('watchlist impossible date rejected', () => expectError((w) => { w.watchlist[0].date = '2026-13-01'; }, '/watchlist/0/date'));
  test('missing indicator keys allowed', () => {
    const w = base();
    w.indicators = {};
    expect(validateWeek(w, FILE, ctx)).toEqual([]);
  });
  test('unknown indicator key rejected', () => expectError((w) => { w.indicators.eth = { value: 1 }; }, '/indicators'));
  test('non-object input reports error', () => {
    expect(validateWeek(null, FILE, ctx).length).toBeGreaterThan(0);
  });
});

describe('validateArchive', () => {
  const earlier = () => {
    const w = base();
    w.weekId = '2026-10-23'; w.period = { start: '2026-10-17', end: '2026-10-23' };
    return w;
  };
  const later = () => {
    const w = base();
    delete w.newEntities; // example-co 已在較早週新增
    return w;
  };
  test('storyline defined in an earlier week is accepted', () => {
    const w1 = earlier();
    w1.storylines.push({ id: 'hormuz-tension', name: '荷莫茲緊張' });
    const w2 = later();
    w2.events[1].storylines = ['hormuz-tension'];
    expect(validateArchive([{ fileName: FILE, raw: w2 }, { fileName: '2026-10-23.json', raw: w1 }], seed)).toEqual([]);
  });
  test('storyline defined only in a later week is rejected', () => {
    const w1 = earlier();
    w1.events[1].storylines = ['hormuz-tension'];
    const w2 = later();
    w2.storylines.push({ id: 'hormuz-tension', name: '荷莫茲緊張' });
    const errs = validateArchive([{ fileName: '2026-10-23.json', raw: w1 }, { fileName: FILE, raw: w2 }], seed);
    expect(errs.some((e) => e.file === '2026-10-23.json')).toBe(true);
  });
  test('entity introduced in a later week cannot be referenced earlier', () => {
    const w1 = earlier();
    delete w1.newEntities;
    const w2 = base();
    const errs = validateArchive([{ fileName: '2026-10-23.json', raw: w1 }, { fileName: FILE, raw: w2 }], seed);
    expect(errs.some((e) => e.file === '2026-10-23.json' && e.path === '/events/0/places/3')).toBe(true);
  });
  test('same entity added in two weeks rejected', () => {
    const errs = validateArchive([{ fileName: '2026-10-23.json', raw: earlier() }, { fileName: FILE, raw: base() }], seed);
    expect(errs.some((e) => e.file === FILE && e.path === '/newEntities/0/id')).toBe(true);
  });
  test('proposal repeated across weeks must match', () => {
    const w2 = later(); w2.proposedChannels[0].sign = -1;
    const errs = validateArchive([{ fileName: '2026-10-23.json', raw: earlier() }, { fileName: FILE, raw: w2 }], seed);
    expect(errs.some((e) => e.file === FILE && e.path === '/proposedChannels/0'), JSON.stringify(errs)).toBe(true);
  });
  test('proposal repeated across weeks consistently is fine', () => {
    expect(validateArchive([{ fileName: '2026-10-23.json', raw: earlier() }, { fileName: FILE, raw: later() }], seed)).toEqual([]);
  });
  test('duplicate weekId across files rejected', () => {
    const errs = validateArchive([{ fileName: FILE, raw: base() }, { fileName: FILE, raw: base() }], seed);
    expect(errs.length).toBeGreaterThan(0);
  });
});

describe('schema stays in sync with code', () => {
  const schema = JSON.parse(readFileSync('schema/week.schema.json', 'utf8'));
  test('schema path pattern equals PATH_PATTERN', () => {
    expect(schema.$defs.path.pattern).toBe(PATH_PATTERN);
  });
  test('schema indicator keys equal INDICATOR_KEYS', () => {
    expect(Object.keys(schema.properties.indicators.properties).sort()).toEqual([...INDICATOR_KEYS].sort());
  });
});
