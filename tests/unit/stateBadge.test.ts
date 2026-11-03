import { describe, expect, test } from 'vitest';
import { badgeLabel, badgeText, badgeTooltip, badgeVisible, formatStateValue, LEVEL_COLORS } from '../../src/render/stateBadge';
import type { NodeState } from '../../src/world/state';

const st = (over: Partial<NodeState> = {}): NodeState => ({
  node: 'us.long-yield', kind: 'numeric', level: 'high', percentile: 98, direction: 1, value: 4.98, unit: '%', asOf: '2026-10-29',
  lookback: ['2026-10-01', 4.6], source: { kind: 'fred', series: 'DGS10', url: 'u', label: 'l' }, freshness: 'fresh', basis: null, carriedWeeks: 0, ...over,
});

describe('state badge', () => {
  test('colors', () => expect(LEVEL_COLORS).toEqual({ low: '#4a90d9', mid: '#8a96a3', high: '#e0a030' }));
  test('arrow text', () => {
    expect(badgeText(st())).toBe('↑');
    expect(badgeText(st({ direction: 0 }))).toBe('→');
    expect(badgeText(st({ direction: -1 }))).toBe('↓');
    expect(badgeText(st({ direction: null }))).toBe('·');
    expect(badgeText(st({ freshness: 'unknown' }))).toBe('?');
  });
  test('aria label', () => {
    expect(badgeLabel('美債長天期殖利率', st())).toBe('美債長天期殖利率：高，上升');
    expect(badgeLabel('台海緊張', st({ freshness: 'unknown', level: null, direction: null }))).toBe('台海緊張：未知');
    expect(badgeLabel('金價', st({ level: null, direction: -1 }))).toBe('金價：無歷史基準，下降');
  });
  test('tooltip for numeric and qualitative nodes', () => {
    expect(badgeTooltip('美債長天期殖利率', st())).toBe('美債長天期殖利率 4.98%・高（5 年第 98 百分位）・↑・10/29');
    expect(badgeTooltip('外資買賣超', st({ kind: 'qualitative', value: null, unit: null, percentile: null, level: 'low', direction: -1, asOf: '2026-10-23', freshness: 'aging', carriedWeeks: 1 })))
      .toBe('外資買賣超・低・↓・10/23 週報（沿用 1 週）');
    expect(badgeTooltip('台海緊張', st({ freshness: 'unknown', level: null, direction: null, value: null }))).toBe('台海緊張・尚無資料');
  });
  test('value formatting', () => {
    expect(formatStateValue(4.98, '%')).toBe('4.98%');
    expect(formatStateValue(7743.98, '點')).toBe('7,744 點');
    expect(formatStateValue(123.1, '美元／桶')).toBe('123.1 美元／桶');
    expect(formatStateValue(100.4409090909, '美元／噸')).toBe('100.4 美元／噸');
  });
  test('visibility', () => {
    expect(badgeVisible('us', 1, false)).toBe(true);
    expect(badgeVisible('us/bonds', 1.79, false)).toBe(false);
    expect(badgeVisible('us/bonds', 1.8, false)).toBe(true);
    expect(badgeVisible('us/bonds', 1, true)).toBe(true);
  });
});
