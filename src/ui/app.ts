import type { ArchiveIndex } from '../data/buildIndex';
import type { WeekData, WeekEvent } from '../data/types';
import { createWorld, supportsWebGL, type ColorMode, type WorldView } from '../render/world';
import { buildSteps, orderEvents, type Step } from '../story/order';
import { initialPlayer, playerReducer, stepDuration, type PlayerAction, type PlayerState } from '../story/player';
import { getEntity, type EntityId } from '../world/entities';
import { primaryIndicator } from '../world/entityIndicators';
import { computeVisualParams } from '../world/visualParams';
import { createControls, type ControlsView } from './controls';
import { el } from './dom';
import { renderEntityPanel } from './entityPanel';
import { renderEventCard } from './eventCard';
import { formatIndicator } from './format';
import { parseHash, toHash } from './route';
import { renderTextMode, renderWatchlist } from './textMode';
import { renderTimeline } from './timeline';

const DISCLAIMER = '僅為資訊整理，不構成任何買賣或個人化投資建議。';
const COLOR_KEY = 'econ-archipelago:colorMode';
const TEXT_KEY = 'econ-archipelago:textMode';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 無法儲存偏好時忽略 */
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

export async function startApp(root: HTMLElement): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const fast = new URLSearchParams(location.search).has('fast');

  root.replaceChildren(el('div', { class: 'loading' }, '經濟群島載入中…'));
  let index: ArchiveIndex;
  try {
    index = await fetchJson<ArchiveIndex>(`${base}data/index.json`);
    if (index.weeks.length === 0) throw new Error('沒有週資料');
  } catch {
    const retry = el('button', { type: 'button', class: 'btn' }, '重試');
    retry.addEventListener('click', () => void startApp(root));
    root.replaceChildren(el('div', { class: 'load-error' }, el('div', {}, el('p', {}, '資料載入失敗。'), retry)));
    return;
  }

  const weekCache = new Map<string, WeekData>();
  const loadWeek = async (id: string) => {
    const hit = weekCache.get(id);
    if (hit) return hit;
    const w = await fetchJson<WeekData>(`${base}data/weeks/${id}.json`);
    weekCache.set(id, w);
    return w;
  };
  const weekIds = index.weeks.map((w) => w.weekId);

  // ---------- 狀態 ----------
  const webgl = supportsWebGL();
  let textMode = !webgl || readPref(TEXT_KEY) === '1';
  let colorMode: ColorMode = readPref(COLOR_KEY) === 'intl' ? 'intl' : 'tw';
  let week!: WeekData;
  let steps: Step[] = [];
  let player: PlayerState = initialPlayer([]);
  let storyline: string | null = null;
  let runToken = 0;
  let world: WorldView | null = null;

  // ---------- 版面 ----------
  const weekTitle = el('p', { class: 'week-title' });
  const textBtn = el('button', { type: 'button', class: 'btn', 'data-action': 'text-mode' }, '文字模式');
  const colorBtn = el('button', { type: 'button', class: 'btn', 'data-action': 'color-mode' });
  if (!webgl) {
    textBtn.disabled = true;
    textBtn.title = '此瀏覽器不支援 WebGL，只能使用文字模式';
  }
  const topbar = el('header', { class: 'topbar' },
    el('div', { class: 'brand' }, el('h1', {}, '經濟群島'), weekTitle, el('p', { class: 'disclaimer' }, DISCLAIMER)),
    el('div', { class: 'tools' }, textBtn, colorBtn),
  );
  const stage = el('div', { class: 'stage' });
  const canvas = el('canvas', { 'aria-label': '經濟群島 3D 世界' });
  stage.append(canvas);
  const panelBody = el('div', { class: 'panel-body' });
  const handle = el('button', { type: 'button', class: 'sheet-handle', 'aria-label': '展開或收合面板' });
  const closeBtn = el('button', { type: 'button', class: 'panel-close', 'aria-label': '關閉面板' }, '×');
  const panel = el('aside', { class: 'panel', 'aria-live': 'polite' }, handle, closeBtn, panelBody);
  const textRoot = el('main', { class: 'text-root' });
  const timelineSlot = el('div');
  const controls: ControlsView = createControls({
    onPlayPause: () => (player.playing ? pause() : play()),
    onPrev: () => step({ type: 'prev' }),
    onNext: () => step({ type: 'next' }),
    onSpeed: () => {
      dispatch({ type: 'setSpeed', speed: player.speed === 1 ? 2 : 1 });
      world?.setTimeScale(fast ? 0.05 : 1 / player.speed);
    },
    onResetCamera: () => void world?.resetCamera(),
  });
  const bottombar = el('footer', { class: 'bottombar' }, controls.root, timelineSlot);
  const tooltip = el('div', { class: 'tooltip', hidden: '' });
  root.replaceChildren(stage, topbar, panel, textRoot, bottombar, tooltip);

  const isNarrow = () => window.matchMedia('(max-width: 767px)').matches;

  function toast(msg: string) {
    const t = el('div', { class: 'toast', role: 'status' }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 3000);
  }

  /** 讓 3D 相機避開右側面板與底部控制列，並把控制列高度交給 CSS。 */
  function syncInsets() {
    const bb = bottombar.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--bottombar-h', `${Math.round(bb)}px`);
    const right = !panel.hidden && !isNarrow() ? panel.getBoundingClientRect().width + 32 : 0;
    world?.setInsets(right, bb + 20);
  }
  new ResizeObserver(syncInsets).observe(bottombar);
  window.addEventListener('resize', syncInsets);

  function showPanel(content: HTMLElement) {
    panelBody.replaceChildren(content);
    panel.hidden = false;
    panel.scrollTop = 0;
    syncInsets();
  }
  closeBtn.addEventListener('click', () => {
    panel.hidden = true;
    syncInsets();
  });
  handle.addEventListener('click', () => {
    panel.dataset.size = panel.dataset.size === 'full' ? '' : 'full';
  });
  panel.addEventListener('select-event', (e) => {
    void selectEvent((e as CustomEvent<{ eventId: string }>).detail.eventId);
  });

  // ---------- 面板內容 ----------
  const eventById = (id: string) => week.events.find((e) => e.id === id);
  const eventOrder = () => steps.filter((s): s is { kind: 'event'; eventId: string } => s.kind === 'event').map((s) => s.eventId);

  function introPanel(): HTMLElement {
    const list = el('ol', { class: 'related' });
    for (const id of eventOrder()) {
      const ev = eventById(id)!;
      const b = el('button', { type: 'button', 'data-event-id': id }, ev.title);
      b.addEventListener('click', () => void selectEvent(id));
      list.append(el('li', {}, b));
    }
    return el('section', { class: 'intro' },
      el('div', { class: 'card-meta' }, '本週故事'),
      el('h3', {}, `${week.events.length} 件大事（依因果順序）`),
      el('p', { class: 'muted' }, '按 ▶ 播放，世界會依因果順序演出每則事件；也可以點擊地標或下方的主線探索。'),
      list,
    );
  }

  function finalePanel(): HTMLElement {
    return el('section', { class: 'finale' }, el('div', { class: 'card-meta' }, '終幕'), el('h3', {}, '下週值得關注'), renderWatchlist(week.watchlist));
  }

  function eventPanel(ev: WeekEvent): HTMLElement {
    const order = eventOrder();
    return renderEventCard(ev, { index: Math.max(0, order.indexOf(ev.id)), total: order.length });
  }

  // ---------- 同步 UI ----------
  function syncControls() {
    const cur = player.steps[player.index];
    let label = '尚未開始';
    if (cur?.kind === 'event') label = `第 ${player.index + 1} / ${steps.length - 1} 則：${eventById(cur.eventId)?.title ?? ''}`;
    if (cur?.kind === 'finale') label = '終幕：下週值得關注';
    controls.update({ playing: player.playing, speed: player.speed, label, canPrev: player.index > 0, canNext: player.index < steps.length - 1 });
  }

  function syncTimeline() {
    timelineSlot.replaceChildren(renderTimeline({
      index, weekId: week.weekId, storyline,
      onWeek: (id) => void goWeek(id, null),
      onEvent: (wid, eid) => void goWeek(wid, eid),
      onStoryline: (id) => toggleStoryline(id),
    }));
  }

  function syncChrome() {
    weekTitle.textContent = week.title;
    document.title = `經濟群島｜${week.title}`;
    textBtn.setAttribute('aria-pressed', String(textMode));
    colorBtn.textContent = colorMode === 'tw' ? '紅漲綠跌' : '綠漲紅跌';
    colorBtn.title = '切換漲跌配色';
    document.documentElement.dataset.colorMode = colorMode;
    document.body.classList.toggle('text-only', textMode);
    stage.hidden = textMode;
    controls.root.hidden = textMode;
    if (textMode) panel.hidden = true;
  }

  function setHash(eventId: string | null) {
    const h = toHash({ weekId: week.weekId, eventId });
    if (location.hash !== h) history.replaceState(null, '', h);
  }

  function renderText(focusEvent: string | null) {
    textRoot.replaceChildren(textMode ? renderTextMode(week, orderEvents(week)) : '');
    if (textMode && focusEvent) textRoot.querySelector(`[data-event-id="${CSS.escape(focusEvent)}"]`)?.scrollIntoView({ block: 'start' });
  }

  function dispatch(a: PlayerAction) {
    player = playerReducer(player, a);
    syncControls();
  }

  // ---------- 世界 ----------
  function ensureWorld(): WorldView | null {
    if (textMode || !webgl) return null;
    if (world) return world;
    world = createWorld(canvas);
    world.setColorMode(colorMode);
    world.setLowPower(window.matchMedia('(pointer: coarse)').matches || isNarrow());
    world.setTimeScale(fast ? 0.05 : 1 / player.speed);
    queueMicrotask(syncInsets);
    world.onPick((id) => {
      if (!id) return;
      pause();
      world!.highlight([id]);
      showPanel(renderEntityPanel(id, week, index));
    });
    world.onHover((id, pos) => {
      if (!id) {
        tooltip.hidden = true;
        return;
      }
      const key = primaryIndicator(id);
      const r = key ? index.indicators[week.weekId]?.[key] : undefined;
      tooltip.replaceChildren(el('strong', {}, getEntity(id).name), key && r ? formatIndicator(key, r) : getEntity(id).covers);
      tooltip.style.left = `${Math.min(pos.x + 14, window.innerWidth - 270)}px`;
      tooltip.style.top = `${pos.y + 14}px`;
      tooltip.hidden = false;
    });
    return world;
  }

  function paramsFor(w: WeekData) {
    return computeVisualParams(index.indicators[w.weekId]!, w.events);
  }

  // ---------- 播放 ----------
  async function runStep(token: number, autoAdvance: boolean) {
    const w = ensureWorld();
    const cur = player.steps[player.index];
    if (!cur) return;
    const started = performance.now();

    if (cur.kind === 'event') {
      const ev = eventById(cur.eventId)!;
      showPanel(eventPanel(ev));
      setHash(ev.id);
      if (w) {
        w.highlight([]);
        await w.flyTo(ev.primaryEntity, 1100);
        if (token !== runToken) return;
        await w.effects.pulse(ev.primaryEntity, ev.sentiment);
        if (token !== runToken) return;
        if (ev.taiwanImpact) {
          await w.effects.ripple(ev.taiwanImpact.direction, ev.taiwanImpact.summary);
          if (token !== runToken) return;
        }
        const nxt = player.steps[player.index + 1];
        if (nxt?.kind === 'event') {
          const link = week.links.find((l) => l.from === ev.id && l.to === nxt.eventId);
          const target = eventById(nxt.eventId)!;
          if (link) await w.effects.flow(ev.primaryEntity, target.primaryEntity, link.label);
          if (token !== runToken) return;
        }
      }
    } else {
      showPanel(finalePanel());
      setHash(null);
      if (w) {
        w.effects.clear();
        await w.resetCamera(1100);
        if (token !== runToken) return;
        w.effects.showFlags(week.watchlist.flatMap((it) => (it.entities[0] ? [{ entity: it.entities[0], text: it.date ? `${it.date.slice(5).replace('-', '/')} ${it.text}` : it.text, confirmed: it.confirmed }] : [])));
      }
    }

    if (!autoAdvance) return;
    const remaining = stepDuration(player.speed, fast) - (performance.now() - started);
    if (remaining > 0) await sleep(remaining);
    if (token !== runToken || !player.playing) return;
    dispatch({ type: 'next' });
    if (player.steps[player.index]) void runStep(token, player.playing);
  }

  function play() {
    const restart = player.index < 0 || player.index >= steps.length - 1;
    dispatch({ type: 'play' });
    const token = ++runToken;
    if (restart) world?.effects.clear();
    void runStep(token, true);
  }

  function pause() {
    runToken++;
    dispatch({ type: 'pause' });
  }

  function step(a: PlayerAction) {
    const wasPlaying = player.playing;
    dispatch(a);
    const token = ++runToken;
    world?.effects.clear();
    void runStep(token, wasPlaying && player.playing);
  }

  async function selectEvent(eventId: string) {
    if (!eventById(eventId)) return;
    if (textMode) {
      setHash(eventId);
      renderText(eventId);
      return;
    }
    pause();
    dispatch({ type: 'goto', eventId });
    const token = ++runToken;
    world?.effects.clear();
    await runStep(token, false);
  }

  function toggleStoryline(id: string) {
    storyline = storyline === id ? null : id;
    const ids = new Set<EntityId>();
    if (storyline) for (const ev of week.events) if (ev.storylines.includes(storyline)) ev.entities.forEach((e) => ids.add(e));
    world?.highlight([...ids]);
    syncTimeline();
  }

  // ---------- 切週 ----------
  async function goWeek(weekId: string, eventId: string | null, invalid = false) {
    let next: WeekData;
    try {
      next = await loadWeek(weekId);
    } catch {
      toast('這一週的資料載入失敗');
      return;
    }
    const first = !week;
    const changed = first || next.weekId !== week.weekId;
    runToken++;
    week = next;
    if (changed) {
      steps = buildSteps(week);
      player = initialPlayer(steps, player.speed);
      storyline = null;
    }
    syncChrome();
    syncControls();
    syncTimeline();
    if (invalid) toast('找不到該連結，已回到最新一週');

    const w = ensureWorld();
    if (w && changed) {
      w.effects.clear();
      w.highlight([]);
      if (first) w.setParams(paramsFor(week));
      else void w.tweenTo(paramsFor(week), 2000);
      if (!eventId) void w.resetCamera(first ? 0 : 1100);
    }

    if (textMode) {
      renderText(eventId);
      setHash(eventId);
      return;
    }
    renderText(null);
    if (eventId) await selectEvent(eventId);
    else {
      setHash(null);
      if (!isNarrow()) showPanel(introPanel());
      else panel.hidden = true;
    }
  }

  // ---------- 事件繫結 ----------
  textBtn.addEventListener('click', () => {
    if (!webgl) return;
    textMode = !textMode;
    writePref(TEXT_KEY, textMode ? '1' : '0');
    pause();
    syncChrome();
    const cur = player.steps[player.index];
    const focusId = cur?.kind === 'event' ? cur.eventId : null;
    renderText(focusId);
    if (!textMode) {
      const w = ensureWorld();
      w?.setParams(paramsFor(week));
      if (!isNarrow()) showPanel(introPanel());
    }
  });

  colorBtn.addEventListener('click', () => {
    colorMode = colorMode === 'tw' ? 'intl' : 'tw';
    writePref(COLOR_KEY, colorMode);
    world?.setColorMode(colorMode);
    syncChrome();
  });

  /** 先依網址載入該週，再用該週的事件清單完整解析網址。 */
  async function routeFromHash(): Promise<boolean> {
    const pre = parseHash(location.hash, weekIds, () => []);
    const w = await loadWeek(pre.weekId).catch(() => null);
    if (!w) return false;
    const r = parseHash(location.hash, weekIds, (id) => (id === w.weekId ? w.events.map((e) => e.id) : []));
    await goWeek(r.weekId, r.eventId, r.invalid);
    return true;
  }

  window.addEventListener('hashchange', () => void routeFromHash());

  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (textMode || t.closest('button, input, textarea, select, a')) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (player.playing) pause();
      else play();
    } else if (e.key === 'ArrowRight') step({ type: 'next' });
    else if (e.key === 'ArrowLeft') step({ type: 'prev' });
  });

  // ---------- 首次載入：依網址決定週與事件 ----------
  if (!(await routeFromHash())) root.replaceChildren(el('div', { class: 'load-error' }, '資料載入失敗。'));
}
