import { describe, expect, test } from 'vitest';
import { laneIndexes, routeControls, sameRegion, LANE_GAP } from '../../src/render/channelRoute';
import { CHANNELS, type Channel } from '../../src/world/channels';

const ch = (id: string, from: string, to: string): Channel => ({ id, from, to, sign: 1, strength: 1, lag: 'days', family: 'markets', mechanism: 'm' });

describe('sameRegion', () => {
  test('arch within one region', () => {
    expect(sameRegion('us/central-bank', 'us/bonds')).toBe(true);
    expect(routeControls([0, 0], [3, 0], 0, true).mid[1]).toBe(2.5);
  });
  test('sea route across regions', () => {
    expect(sameRegion('us/equity', 'tw/equity')).toBe(false);
    expect(routeControls([0, 0], [30, 0], 0, false).mid[1]).toBe(0.15);
  });
  test('lanes between the same pair are at least LANE_GAP apart', () => {
    const a = routeControls([0, 0], [30, 10], 0, false).mid;
    const b = routeControls([0, 0], [30, 10], 1, false).mid;
    expect(LANE_GAP).toBe(1.2);
    expect(Math.hypot(a[0] - b[0], a[2] - b[2])).toBeGreaterThanOrEqual(1.2 - 1e-9);
  });
  test('reversed direction bows to the same side', () => {
    const a = routeControls([0, 0], [30, 10], 1, false).mid;
    const b = routeControls([30, 10], [0, 0], 1, false).mid;
    expect(a[0]).toBeCloseTo(b[0]);
    expect(a[2]).toBeCloseTo(b[2]);
  });
  test('coincident endpoints become a visible loop', () => {
    const r = routeControls([5, 5], [5, 5], 0, true);
    expect(Math.hypot(r.start[0] - r.end[0], r.start[1] - r.end[1])).toBeGreaterThan(0.5);
    expect(r.mid[1]).toBe(2.5);
  });
});

describe('laneIndexes', () => {
  test('pairs are undirected and ordered by id', () => {
    const lanes = laneIndexes([
      ch('b-tw-us', 'tw.equity', 'us.equity'),
      ch('a-us-tw', 'us.equity', 'tw.equity'),
      ch('c-us-kr', 'us.equity', 'kr.equity'),
    ]);
    expect(lanes.get('a-us-tw')).toBe(0);
    expect(lanes.get('b-tw-us')).toBe(1);
    expect(lanes.get('c-us-kr')).toBe(0);
  });
  test('every curated channel gets a lane', () => {
    expect(laneIndexes(CHANNELS).size).toBe(CHANNELS.length);
  });
});
