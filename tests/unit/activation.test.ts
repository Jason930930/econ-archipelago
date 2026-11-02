import { describe, expect, test } from 'vitest';
import { computeActivation, weekIntensity } from '../../src/world/activation';
import type { ProposedChannel, WeekData } from '../../src/data/types';
import { makeEvent, makeWeek } from './helpers';

const ev = (id: string, channels: string[] = [], rank = Number(id.slice(1))) => makeEvent({ id, rank, channels });

/** 一週內用 events[].channels 讓 c 的強度為 n。 */
function weekWith(weekId: string, n: number, c = 'fed-to-us-yield', over: Partial<WeekData> = {}): WeekData {
  const events = n === 0 ? [ev('e1')] : Array.from({ length: n }, (_, i) => ev(`e${i + 1}`, [c]));
  return makeWeek(weekId, { events, ...over });
}

const proposal = (over: Partial<ProposedChannel> = {}): ProposedChannel => ({
  id: 'jp-tech-proposal', fromPath: 'jp/tech', toPath: 'us/tech', fromVar: '日本科技', toVar: '美國科技',
  sign: 1, mechanism: '第一次', evidence: ['e1'], ...over,
});

describe('weekIntensity', () => {
  test('intensity is capped at 3', () => {
    expect(weekIntensity(weekWith('2026-10-30', 4))['fed-to-us-yield']).toEqual({ intensity: 3, eventIds: ['e1', 'e2', 'e3', 'e4'] });
  });
  test('a link counts both of its events, each event once', () => {
    const w = makeWeek('2026-10-30', {
      events: [ev('e1', ['fed-to-us-yield']), ev('e2'), ev('e3')],
      links: [
        { from: 'e1', to: 'e2', label: 'x', channel: 'fed-to-us-yield' },
        { from: 'e2', to: 'e1', label: 'y', channel: 'fed-to-us-yield' },
      ],
    });
    expect(weekIntensity(w)['fed-to-us-yield']).toEqual({ intensity: 2, eventIds: ['e1', 'e2'] });
  });
  test('untagged week has no entries', () => expect(weekIntensity(weekWith('2026-10-30', 0))).toEqual({}));
});

describe('computeActivation', () => {
  const weeks = [weekWith('2026-10-16', 1), weekWith('2026-10-23', 0), weekWith('2026-10-30', 2)];
  test('heat recursion 1, 0, 2 → 1, 0.5, 2.25', () => {
    const { byWeek } = computeActivation(weeks);
    expect(byWeek['2026-10-16']!['fed-to-us-yield']!.heat).toBe(1);
    expect(byWeek['2026-10-23']!['fed-to-us-yield']).toEqual({ intensity: 0, heat: 0.5, streak: 0 });
    expect(byWeek['2026-10-30']!['fed-to-us-yield']!.heat).toBe(2.25);
  });
  test('heat ignores calendar gaps', () => {
    const { byWeek } = computeActivation([weekWith('2026-10-16', 2), weekWith('2026-10-30', 1)]);
    expect(byWeek['2026-10-30']!['fed-to-us-yield']!.heat).toBe(2);
  });
  test('byWeek omits channels whose heat has faded below 0.01', () => {
    const ws = Array.from({ length: 8 }, (_, i) => weekWith(`w0${i}`, i === 0 ? 1 : 0));
    const { byWeek } = computeActivation(ws);
    expect(byWeek['w06']!['fed-to-us-yield']!.heat).toBeCloseTo(0.015625); // 0.5^6
    expect(byWeek['w07']!['fed-to-us-yield']).toBeUndefined(); // 0.5^7 ≈ 0.0078 → 已淡出
  });
  test('streak 1, 0, 1, 2', () => {
    const { byWeek } = computeActivation([weekWith('a1', 1), weekWith('a2', 0), weekWith('a3', 1), weekWith('a4', 1)]);
    expect(['a1', 'a3', 'a4'].map((w) => byWeek[w]!['fed-to-us-yield']!.streak)).toEqual([1, 1, 2]);
    expect(byWeek['a2']!['fed-to-us-yield']!.streak).toBe(0);
  });
  test('weeks are sorted by weekId first', () => {
    const { byWeek } = computeActivation([...weeks].reverse());
    expect(byWeek['2026-10-30']!['fed-to-us-yield']!.heat).toBe(2.25);
  });
  test('history lists weeks and events', () => {
    expect(computeActivation(weeks).history['fed-to-us-yield']).toEqual([
      { weekId: '2026-10-16', eventIds: ['e1'] },
      { weekId: '2026-10-30', eventIds: ['e1', 'e2'] },
    ]);
  });
  test('proposals aggregate across weeks, latest mechanism wins', () => {
    const { proposals } = computeActivation([
      weekWith('2026-10-23', 0, undefined, { proposedChannels: [proposal()] }),
      weekWith('2026-10-30', 0, undefined, { proposedChannels: [proposal({ mechanism: '最近一次', evidence: ['e1'] })] }),
    ]);
    expect(proposals).toEqual([{
      id: 'jp-tech-proposal', fromPath: 'jp/tech', toPath: 'us/tech', fromVar: '日本科技', toVar: '美國科技', sign: 1,
      mechanism: '最近一次', promoted: false,
      weeks: [{ weekId: '2026-10-23', evidence: ['e1'] }, { weekId: '2026-10-30', evidence: ['e1'] }],
    }]);
  });
  test('proposal whose id became a core channel is marked promoted', () => {
    const { proposals } = computeActivation([weekWith('2026-10-23', 0, undefined, { proposedChannels: [proposal({ id: 'fed-to-us-yield' })] })]);
    expect(proposals[0]!.promoted).toBe(true);
  });
});
