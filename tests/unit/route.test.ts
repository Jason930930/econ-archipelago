import { expect, test } from 'vitest';
import { parseHash, toHash } from '../../src/ui/route';

const weeks = ['2026-10-16', '2026-10-23', '2026-10-30'];
const events = () => ['e1', 'e2', 'e3', 'e4', 'e5'];

test('parses week and event', () => {
  expect(parseHash('#/2026-10-23/e2', weeks, events)).toEqual({ weekId: '2026-10-23', eventId: 'e2', invalid: false, scenario: null });
});
test('parses week only', () => {
  expect(parseHash('#/2026-10-16', weeks, events)).toEqual({ weekId: '2026-10-16', eventId: null, invalid: false, scenario: null });
});
test('parseHash invalid event', () => {
  expect(parseHash('#/2026-10-23/e9', weeks, events)).toEqual({ weekId: '2026-10-23', eventId: null, invalid: true, scenario: null });
});
test('unknown week goes to latest and is invalid', () => {
  expect(parseHash('#/2099-01-01/e1', weeks, events)).toEqual({ weekId: '2026-10-30', eventId: null, invalid: true, scenario: null });
});
test('empty hash goes to latest and is valid', () => {
  expect(parseHash('', weeks, events)).toEqual({ weekId: '2026-10-30', eventId: null, invalid: false, scenario: null });
  expect(parseHash('#/', weeks, events)).toEqual({ weekId: '2026-10-30', eventId: null, invalid: false, scenario: null });
});
test('garbage hash is invalid', () => {
  expect(parseHash('#<script>', weeks, events)).toMatchObject({ weekId: '2026-10-30', invalid: true, scenario: null });
});
test('toHash and parseHash round-trip', () => {
  for (const r of [{ weekId: '2026-10-23', eventId: 'e3' }, { weekId: '2026-10-16', eventId: null }]) {
    expect(parseHash(toHash(r), weeks, events)).toEqual({ ...r, invalid: false, scenario: null });
  }
});

test('parses a what-if link', () => {
  expect(parseHash('#/2026-10-23/what-if/gulf.oil-price/up', weeks, events)).toEqual({ weekId: '2026-10-23', eventId: null, invalid: false, scenario: { node: 'gulf.oil-price', direction: 1 } });
  expect(parseHash('#/2026-10-23/what-if/us.policy-rate/down', weeks, events).scenario).toEqual({ node: 'us.policy-rate', direction: -1 });
});
test('invalid what-if hash', () => {
  expect(parseHash('#/2026-10-23/what-if/nope/up', weeks, events)).toEqual({ weekId: '2026-10-23', eventId: null, invalid: true, scenario: null });
  expect(parseHash('#/2026-10-23/what-if/gulf.oil-price/sideways', weeks, events)).toEqual({ weekId: '2026-10-23', eventId: null, invalid: true, scenario: null });
});
test('what-if link round-trips', () => {
  const r = { weekId: '2026-10-30', eventId: null, scenario: { node: 'tw.twd', direction: -1 as const } };
  expect(toHash(r)).toBe('#/2026-10-30/what-if/tw.twd/down');
  expect(parseHash(toHash(r), weeks, events)).toEqual({ ...r, invalid: false });
  expect(toHash({ weekId: '2026-10-30', eventId: 'e1' })).toBe('#/2026-10-30/e1');
});
