import { expect, test } from 'vitest';
import { parseHash, toHash } from '../../src/ui/route';

const weeks = ['2026-10-16', '2026-10-23', '2026-10-30'];
const events = () => ['e1', 'e2', 'e3', 'e4', 'e5'];

test('parses week and event', () => {
  expect(parseHash('#/2026-10-23/e2', weeks, events)).toEqual({ weekId: '2026-10-23', eventId: 'e2', invalid: false });
});
test('parses week only', () => {
  expect(parseHash('#/2026-10-16', weeks, events)).toEqual({ weekId: '2026-10-16', eventId: null, invalid: false });
});
test('parseHash invalid event', () => {
  expect(parseHash('#/2026-10-23/e9', weeks, events)).toEqual({ weekId: '2026-10-23', eventId: null, invalid: true });
});
test('unknown week goes to latest and is invalid', () => {
  expect(parseHash('#/2099-01-01/e1', weeks, events)).toEqual({ weekId: '2026-10-30', eventId: null, invalid: true });
});
test('empty hash goes to latest and is valid', () => {
  expect(parseHash('', weeks, events)).toEqual({ weekId: '2026-10-30', eventId: null, invalid: false });
  expect(parseHash('#/', weeks, events)).toEqual({ weekId: '2026-10-30', eventId: null, invalid: false });
});
test('garbage hash is invalid', () => {
  expect(parseHash('#<script>', weeks, events)).toMatchObject({ weekId: '2026-10-30', invalid: true });
});
test('toHash and parseHash round-trip', () => {
  for (const r of [{ weekId: '2026-10-23', eventId: 'e3' }, { weekId: '2026-10-16', eventId: null }]) {
    expect(parseHash(toHash(r), weeks, events)).toEqual({ ...r, invalid: false });
  }
});
