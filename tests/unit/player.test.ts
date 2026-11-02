import { expect, test } from 'vitest';
import type { Step } from '../../src/story/order';
import { initialPlayer, playerReducer, stepDuration } from '../../src/story/player';

const steps: Step[] = [
  { kind: 'event', eventId: 'e1' }, { kind: 'event', eventId: 'e2' }, { kind: 'event', eventId: 'e4' }, { kind: 'finale' },
];
const s0 = initialPlayer(steps);

test('initial state is not started', () => {
  expect(s0).toEqual({ steps, index: -1, playing: false, speed: 1 });
});
test('play from not-started jumps to first step', () => {
  expect(playerReducer(s0, { type: 'play' })).toMatchObject({ index: 0, playing: true });
});
test('next past the end stops at finale', () => {
  let s = playerReducer(s0, { type: 'play' });
  for (let i = 0; i < 10; i++) s = playerReducer(s, { type: 'next' });
  expect(s).toMatchObject({ index: 3, playing: false });
});
test('prev does not go below zero', () => {
  const s = playerReducer(playerReducer(s0, { type: 'play' }), { type: 'prev' });
  expect(s.index).toBe(0);
});
test('goto jumps to event index', () => {
  expect(playerReducer(s0, { type: 'goto', eventId: 'e4' }).index).toBe(2);
});
test('goto unknown id leaves state unchanged', () => {
  expect(playerReducer(s0, { type: 'goto', eventId: 'e9' })).toBe(s0);
});
test('pause, setSpeed and reset', () => {
  let s = playerReducer(s0, { type: 'play' });
  s = playerReducer(s, { type: 'setSpeed', speed: 2 });
  s = playerReducer(s, { type: 'pause' });
  expect(s).toMatchObject({ playing: false, speed: 2, index: 0 });
  expect(playerReducer(s, { type: 'reset' })).toMatchObject({ index: -1, playing: false, speed: 2 });
});
test('play at finale restarts from the first step', () => {
  let s = playerReducer(s0, { type: 'goto', eventId: 'e4' });
  s = playerReducer(s, { type: 'next' });
  expect(playerReducer(s, { type: 'play' })).toMatchObject({ index: 0, playing: true });
});
test('stepDuration', () => {
  expect(stepDuration(1, false)).toBe(6000);
  expect(stepDuration(2, false)).toBe(3000);
  expect(stepDuration(2, true)).toBe(300);
});
