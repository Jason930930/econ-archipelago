import { el } from './dom';

export interface ControlHandlers {
  onPlayPause(): void;
  onPrev(): void;
  onNext(): void;
  onSpeed(): void;
  onResetCamera(): void;
}

export interface ControlsView {
  root: HTMLElement;
  update(s: { playing: boolean; speed: 1 | 2; label: string; canPrev: boolean; canNext: boolean }): void;
}

export function createControls(h: ControlHandlers): ControlsView {
  const play = el('button', { type: 'button', class: 'btn', 'data-action': 'play' }, '▶ 播放');
  const prev = el('button', { type: 'button', class: 'btn', 'data-action': 'prev', 'aria-label': '上一則' }, '⏮');
  const next = el('button', { type: 'button', class: 'btn', 'data-action': 'next', 'aria-label': '下一則' }, '⏭');
  const speed = el('button', { type: 'button', class: 'btn', 'data-action': 'speed', 'aria-label': '播放速度' }, '1×');
  const reset = el('button', { type: 'button', class: 'btn', 'data-action': 'reset-camera' }, '⟲ 鏡頭');
  const label = el('span', { class: 'step-label', 'aria-live': 'polite' });
  play.addEventListener('click', h.onPlayPause);
  prev.addEventListener('click', h.onPrev);
  next.addEventListener('click', h.onNext);
  speed.addEventListener('click', h.onSpeed);
  reset.addEventListener('click', h.onResetCamera);
  const root = el('div', { class: 'controls' }, play, prev, next, speed, reset, label);
  return {
    root,
    update(s) {
      play.textContent = s.playing ? '⏸ 暫停' : '▶ 播放';
      play.setAttribute('aria-pressed', String(s.playing));
      speed.textContent = `${s.speed}×`;
      prev.disabled = !s.canPrev;
      next.disabled = !s.canNext;
      label.textContent = s.label;
      label.title = s.label;
    },
  };
}
