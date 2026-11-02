import type { Step } from './order';

export interface PlayerState {
  steps: Step[];
  /** -1 = 未開始 */
  index: number;
  playing: boolean;
  speed: 1 | 2;
}

export type PlayerAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'goto'; eventId: string }
  | { type: 'setSpeed'; speed: 1 | 2 }
  | { type: 'reset' };

export const STEP_DURATION_MS = 6000;

export function stepDuration(speed: 1 | 2, fast: boolean): number {
  return fast ? 300 : STEP_DURATION_MS / speed;
}

export function initialPlayer(steps: Step[], speed: 1 | 2 = 1): PlayerState {
  return { steps, index: -1, playing: false, speed };
}

export function playerReducer(s: PlayerState, a: PlayerAction): PlayerState {
  const last = s.steps.length - 1;
  switch (a.type) {
    case 'play':
      return { ...s, playing: true, index: s.index < 0 || s.index >= last ? 0 : s.index };
    case 'pause':
      return { ...s, playing: false };
    case 'next':
      if (s.index >= last) return { ...s, index: last, playing: false };
      return { ...s, index: s.index + 1, playing: s.index + 1 >= last ? false : s.playing };
    case 'prev':
      return { ...s, index: Math.max(0, s.index - 1) };
    case 'goto': {
      const i = s.steps.findIndex((st) => st.kind === 'event' && st.eventId === a.eventId);
      return i < 0 ? s : { ...s, index: i };
    }
    case 'setSpeed':
      return { ...s, speed: a.speed };
    case 'reset':
      return { ...s, index: -1, playing: false };
  }
}
