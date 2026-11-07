import type { ChannelActivity } from '../world/activation';
import type { NodeState, Transition } from '../world/state';
import type { ArchiveIndex } from './buildIndex';

/**
 * 索引分拆：每週的衍生資料（節點狀態、管道活躍度、狀態轉變）不放在開頁就載入的 index.json，
 * 改成每週一個檔案，切到那週時才載入並填回（hydrateWeek），讓讀 byWeek 的程式不必改。
 */
export interface WeekDerived {
  weekId: string;
  state: Record<string, NodeState>;
  channels: Record<string, ChannelActivity>;
  transitions: Transition[];
}

export function splitIndex(full: ArchiveIndex): { catalog: ArchiveIndex; derived: WeekDerived[] } {
  const derived = full.weeks.map((w) => ({
    weekId: w.weekId,
    state: full.state.byWeek[w.weekId] ?? {},
    channels: full.channels.byWeek[w.weekId] ?? {},
    transitions: full.state.transitions[w.weekId] ?? [],
  }));
  const catalog: ArchiveIndex = {
    ...full,
    state: { ...full.state, byWeek: {}, transitions: {} },
    channels: { ...full.channels, byWeek: {} },
  };
  return { catalog, derived };
}

export function hydrateWeek(catalog: ArchiveIndex, d: WeekDerived): void {
  catalog.state.byWeek[d.weekId] = d.state;
  catalog.channels.byWeek[d.weekId] = d.channels;
  catalog.state.transitions[d.weekId] = d.transitions;
}
