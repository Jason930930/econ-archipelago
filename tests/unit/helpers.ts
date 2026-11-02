import type { WeekData, WeekEvent } from '../../src/data/types';

export function makeEvent(over: Partial<WeekEvent> = {}): WeekEvent {
  return {
    id: 'e1', rank: 1, date: null, title: 't', what: 'w', why: 'y', discrepancy: null, taiwanImpact: null,
    primaryEntity: 'us-fed', entities: ['us-fed'], sentiment: 0, storylines: [], metrics: [],
    sources: [{ title: 's', url: 'https://x.com' }], ...over,
  };
}

export function makeWeek(weekId: string, over: Partial<WeekData> = {}): WeekData {
  return {
    schemaVersion: 1, weekId, period: { start: weekId, end: weekId }, title: `週報 ${weekId}`,
    indicators: {}, events: [makeEvent()], links: [], storylines: [], watchlist: [], ...over,
  };
}
