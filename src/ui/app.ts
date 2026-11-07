import type { ArchiveIndex } from '../data/buildIndex';
import type { WeekData, WeekEvent } from '../data/types';
import { createWorld, supportsWebGL, type ColorMode, type WorldView } from '../render/world';
import { buildSteps, orderEvents, outgoingLinks, type Step } from '../story/order';
import { initialPlayer, playerReducer, stepDuration, type PlayerAction, type PlayerState } from '../story/player';
import { project } from '../world/geo';
import { computeWorldParams } from '../world/indicators';
import { createControls, type ControlsView } from './controls';
import { el } from './dom';
import { renderActiveChannels, renderChannelPanel, renderProposalList, renderProposalPanel } from './channelPanel';
import { renderEventCard } from './eventCard';
import { renderTransitions, renderWorldState, statesFor } from './stateCard';
import { stateTransitions } from '../world/state';
import { runScenario, type ScenarioResult, type Shock } from '../world/scenario';
import { renderScenarioPicker, renderScenarioResult, renderScenarioText } from './scenarioPanel';
import { FAMILY_INFO, getChannel, getChannelNode } from '../world/channels';
import { hoverInfo } from './hover';
import { renderNodePanel } from './nodePanel';
import { parseHash, toHash } from './route';
import { renderTextMode, renderWatchlist } from './textMode';
import { renderTimeline } from './timeline';

const DISCLAIMER = '僅為資訊整理，不構成任何買賣或個人化投資建議。';
const COLOR_KEY = 'econ-archipelago:colorMode';
const TEXT_KEY = 'econ-archipelago:textMode';
const NETWORK_KEY = 'econ-archipelago:network';

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
  let networkMode = readPref(NETWORK_KEY) === '1';
  let week!: WeekData;
  let steps: Step[] = [];
  let player: PlayerState = initialPlayer([]);
  let storyline: string | null = null;
  let runToken = 0;
  let navSeq = 0;
  let world: WorldView | null = null;
  let webglOk = webgl;
  /** 進行中的情境推演（子專案 4）。 */
  let scenario: Shock | null = null;
  let scenarioResult: ScenarioResult | null = null;

  // ---------- 版面 ----------
  const weekTitle = el('p', { class: 'week-title' });
  const textBtn = el('button', { type: 'button', class: 'btn', 'data-action': 'text-mode' }, '文字模式');
  const colorBtn = el('button', { type: 'button', class: 'btn', 'data-action': 'color-mode' });
  const networkBtn = el('button', { type: 'button', class: 'btn', 'data-action': 'network', title: '顯示所有常駐傳導管道' }, '傳導網絡');
  const stateBtn = el('button', { type: 'button', class: 'btn', 'data-action': 'state', title: '36 個節點的目前狀態' }, '世界狀態');
  const whatIfBtn = el('button', { type: 'button', class: 'btn', 'data-action': 'what-if', title: '給一個節點衝擊，推演它沿傳導管道擴散到哪裡' }, '情境推演');
  if (!webgl) {
    textBtn.disabled = true;
    textBtn.title = '此瀏覽器不支援 WebGL，只能使用文字模式';
  }
  const topbar = el('header', { class: 'topbar' },
    el('div', { class: 'brand' }, el('h1', {}, '經濟群島'), weekTitle, el('p', { class: 'disclaimer' }, DISCLAIMER)),
    el('div', { class: 'tools' }, whatIfBtn, stateBtn, networkBtn, textBtn, colorBtn),
  );
  const stage = el('div', { class: 'stage' });
  const canvas = el('canvas', { 'aria-label': '經濟群島 3D 世界' });
  const proposalBtn = el('button', { type: 'button', class: 'proposal-count' });
  const channelLegend = el('div', { class: 'channel-legend', hidden: '' },
    el('div', { class: 'legend-title' }, '傳導網絡'),
    el('ul', {}, ...Object.values(FAMILY_INFO).map((f) => el('li', {}, el('span', { class: 'family-dot', style: `background:${f.color}`, 'aria-hidden': 'true' }), f.name))),
    el('p', { class: 'legend-note' }, '亮：本週點亮或仍有餘溫；「−」：反向；灰色虛線：待審提議'),
    proposalBtn,
  );
  stage.append(canvas, channelLegend);
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
  panel.addEventListener('select-node', (e) => {
    const path = (e as CustomEvent<{ path: string }>).detail.path;
    // 推演結果裡點一列：只飛過去，保留結果面板與推演。
    if (scenario && (e.target as HTMLElement).closest('.scenario-result')) {
      world?.highlight([path]);
      void world?.flyTo(path, 900);
      return;
    }
    selectNode(path);
  });
  panel.addEventListener('select-event', (e) => {
    void selectEvent((e as CustomEvent<{ eventId: string }>).detail.eventId);
  });
  panel.addEventListener('select-channel', (e) => {
    selectChannel((e as CustomEvent<{ id: string }>).detail.id);
  });
  panel.addEventListener('select-proposal', (e) => {
    selectProposal((e as CustomEvent<{ id: string }>).detail.id);
  });
  panel.addEventListener('select-week', (e) => {
    void goWeek((e as CustomEvent<{ weekId: string }>).detail.weekId, null);
  });
  proposalBtn.addEventListener('click', () => {
    pause();
    showPanel(renderProposalList(index));
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
      transitionsPanel(),
      renderActiveChannels(week.weekId, index),
    );
  }

  /** 與上一週相比，水準或方向改變的節點。第一週不顯示。 */
  function transitionsPanel(): HTMLElement | null {
    const i = weekIds.indexOf(week.weekId);
    if (i <= 0) return null;
    return renderTransitions(stateTransitions(index.state.byWeek[weekIds[i - 1]!] ?? {}, statesFor(week.weekId, index)), index);
  }

  function finalePanel(): HTMLElement {
    return el('section', { class: 'finale' }, el('div', { class: 'card-meta' }, '終幕'), el('h3', {}, '下週值得關注'), renderWatchlist(week.watchlist));
  }

  function eventPanel(ev: WeekEvent): HTMLElement {
    const order = eventOrder();
    return renderEventCard(ev, { index: Math.max(0, order.indexOf(ev.id)), total: order.length }, index.entities);
  }

  // ---------- 同步 UI ----------
  function syncControls() {
    const cur = player.steps[player.index];
    let label = '尚未開始';
    if (cur?.kind === 'event') label = `第 ${player.index + 1} / ${steps.length - 1} 則：${eventById(cur.eventId)?.title ?? ''}`;
    if (cur?.kind === 'finale') label = '終幕：下週值得關注';
    controls.update({ playing: player.playing, speed: player.speed, label, canPlay: steps.length > 0, canPrev: player.index > 0, canNext: player.index < steps.length - 1 });
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
    networkBtn.setAttribute('aria-pressed', String(networkMode));
    networkBtn.hidden = textMode;
    whatIfBtn.setAttribute('aria-pressed', String(scenario !== null));
    stateBtn.hidden = textMode;
    channelLegend.hidden = textMode || !networkMode;
    colorBtn.title = '切換漲跌配色';
    document.documentElement.dataset.colorMode = colorMode;
    document.body.classList.toggle('text-only', textMode);
    stage.hidden = textMode;
    controls.root.hidden = textMode;
    if (textMode) panel.hidden = true;
  }

  function setHash(eventId: string | null) {
    const h = toHash({ weekId: week.weekId, eventId, scenario: eventId ? null : scenario });
    if (location.hash !== h) history.replaceState(null, '', h);
  }

  function renderText(focusEvent: string | null) {
    textRoot.replaceChildren(textMode ? renderTextMode(week, orderEvents(week), index.entities, statesFor(week.weekId, index), scenarioResult ? renderScenarioText(scenarioResult, index) : null) : '');
    if (textMode && focusEvent) textRoot.querySelector(`[data-event-id="${CSS.escape(focusEvent)}"]`)?.scrollIntoView({ block: 'start' });
  }

  function dispatch(a: PlayerAction) {
    player = playerReducer(player, a);
    syncControls();
  }

  // ---------- 世界 ----------
  function ensureWorld(): WorldView | null {
    if (textMode || !webglOk) return null;
    if (world) return world;
    try {
      const seaPoints = index.entities.filter((e) => e.geo).map((e) => project(e.geo!.lat, e.geo!.lon));
      world = createWorld(canvas, seaPoints);
      world.build({ entities: index.entities, districts: index.districts, mentions: index.mentions });
    } catch {
      // 偵測通過但實際建立失敗（驅動、記憶體等）：改用文字模式，內容不受影響。
      webglOk = false;
      textMode = true;
      textBtn.disabled = true;
      textBtn.title = '無法啟動 3D 畫面，只能使用文字模式';
      syncChrome();
      renderText(null);
      return null;
    }
    world.setColorMode(colorMode);
    world.setLowPower(window.matchMedia('(pointer: coarse)').matches || isNarrow());
    world.setTimeScale(fast ? 0.05 : 1 / player.speed);
    queueMicrotask(syncInsets);
    world.onPick((hit) => {
      if (hit?.kind === 'node') selectNode(hit.path);
      else if (hit?.kind === 'channel') selectChannel(hit.id);
      else if (hit?.kind === 'proposal') selectProposal(hit.id);
    });
    world.setNetworkMode(networkMode);
    world.onHover((path, pos) => {
      if (!path) {
        tooltip.hidden = true;
        return;
      }
      const info = hoverInfo(path, week.weekId, index);
      tooltip.replaceChildren(el('strong', {}, info.title), ...info.lines.map((l) => el('div', {}, l)));
      tooltip.style.left = `${Math.min(pos.x + 14, window.innerWidth - 270)}px`;
      tooltip.style.top = `${pos.y + 14}px`;
      tooltip.hidden = false;
    });
    return world;
  }

  /** 截至本週出現過、尚未收錄的提議。 */
  function proposalsFor(weekId: string) {
    return index.channels.proposals.filter((p) => !p.promoted && p.weeks.some((x) => x.weekId <= weekId));
  }

  function syncChannels() {
    const pending = proposalsFor(week.weekId);
    proposalBtn.textContent = `待審提議 ${pending.length} 項`;
    world?.setChannelActivity(index.channels.byWeek[week.weekId] ?? {}, pending);
    world?.setNodeStates(statesFor(week.weekId, index));
  }

  function paramsFor(w: WeekData) {
    return computeWorldParams(index.indicators[w.weekId]!, w.events);
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
        await w.flyTo(ev.primary, 1100);
        if (token !== runToken) return;
        await w.effects.pulse(ev.primary, ev.sentiment);
        if (token !== runToken) return;
        if (ev.taiwanImpact) {
          await w.effects.ripple(ev.taiwanImpact.direction, ev.taiwanImpact.summary);
          if (token !== runToken) return;
        }
        const flows = outgoingLinks(week, ev.id).map((l) => (l.channel && getChannel(l.channel)
          ? w.effects.flowAlong(l.channel, l.label)
          : w.effects.flow(ev.primary, eventById(l.to)!.primary, l.label)));
        await Promise.all(flows);
        if (token !== runToken) return;
      }
    } else {
      showPanel(finalePanel());
      setHash(null);
      if (w) {
        w.effects.clear();
        await w.resetCamera(1100);
        if (token !== runToken) return;
        w.effects.showFlags(week.watchlist.flatMap((it) => (it.places[0] ? [{ path: it.places[0], text: it.date ? `${it.date.slice(5).replace('-', '/')} ${it.text}` : it.text, confirmed: it.confirmed }] : [])));
      }
    }

    if (!autoAdvance) return;
    const remaining = stepDuration(player.speed, fast) - (performance.now() - started);
    if (remaining > 0) await sleep(remaining);
    if (token !== runToken || !player.playing) return;
    dispatch({ type: 'next' });
    if (player.steps[player.index]) void runStep(token, player.playing);
  }

  // ---------- 情境推演 ----------
  /** 以目前這週的狀態推演；3D 世界播放三波，面板顯示結果（文字模式則寫進文字頁面）。 */
  function startScenario(shock: Shock) {
    pause();
    scenario = shock;
    scenarioResult = runScenario(shock, statesFor(week.weekId, index));
    setHash(null);
    syncChrome();
    if (textMode) {
      renderText(null);
      window.scrollTo(0, 0);
      return;
    }
    const w = ensureWorld();
    showPanel(renderScenarioResult(scenarioResult, index));
    if (w) {
      w.effects.clear();
      w.highlight([]);
      void (isNarrow() ? w.focusAsiaPacific(800) : w.resetCamera(800));
      void w.showScenario(scenarioResult);
    }
  }

  /** 結束推演；restore = 回到本週故事面板（播放或點事件時由它們自己決定面板）。 */
  function endScenario(restore = true) {
    if (!scenario) return;
    scenario = null;
    scenarioResult = null;
    void world?.showScenario(null);
    syncChrome();
    setHash(null);
    if (textMode) renderText(null);
    else if (restore) {
      if (!isNarrow()) showPanel(introPanel());
      else panel.hidden = true;
    }
  }

  function play() {
    endScenario(false);
    if (steps.length === 0) return;
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
    endScenario(false);
    if (steps.length === 0) return;
    const wasPlaying = player.playing;
    dispatch(a);
    const token = ++runToken;
    world?.effects.clear();
    void runStep(token, wasPlaying && player.playing);
  }

  async function selectEvent(eventId: string) {
    if (!eventById(eventId)) return;
    endScenario(false);
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

  /** 點擊世界或麵包屑：暫停、高亮、飛過去並顯示節點面板。 */
  function selectNode(path: string) {
    if (textMode) return;
    pause();
    world?.highlight([path]);
    void world?.flyTo(path, 900);
    showPanel(renderNodePanel(path, week, index));
  }

  /** 點擊管線或面板裡的管道：暫停、高亮兩端並顯示管道面板。 */
  function selectChannel(id: string) {
    const c = getChannel(id);
    if (textMode || !c) return;
    pause();
    world?.highlight([getChannelNode(c.from).path, getChannelNode(c.to).path]);
    showPanel(renderChannelPanel(id, week, index));
  }

  function selectProposal(id: string) {
    const p = index.channels.proposals.find((x) => x.id === id);
    if (textMode || !p) return;
    pause();
    world?.highlight([p.fromPath, p.toPath]);
    showPanel(renderProposalPanel(id, index));
  }

  function toggleStoryline(id: string) {
    storyline = storyline === id ? null : id;
    const ids = new Set<string>();
    if (storyline) for (const ev of week.events) if (ev.storylines.includes(storyline)) ev.places.forEach((p) => ids.add(p));
    world?.highlight([...ids]);
    syncTimeline();
  }

  // ---------- 切週 ----------
  async function goWeek(weekId: string, eventId: string | null, invalid = false, withScenario?: Shock | null) {
    const nav = ++navSeq;
    runToken++;
    if (player.playing) dispatch({ type: 'pause' });
    let next: WeekData;
    try {
      next = await loadWeek(weekId);
    } catch {
      if (nav === navSeq) toast('這一週的資料載入失敗');
      return;
    }
    // 只採用最後一次導覽的結果，較慢回來的舊請求直接丟棄。
    if (nav !== navSeq) return;
    // 載入完成後才決定是否保留情境：載入期間使用者可能已經結束或換了情境。
    const keep = withScenario !== undefined ? withScenario : eventId ? null : scenario;
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
    // 底部列內容剛被我們改變，立刻同步尺寸，不等 ResizeObserver 下一幀才通知。
    syncInsets();
    if (invalid) toast('找不到該連結，已回到最新一週');

    const w = ensureWorld();
    if (w && changed) {
      w.effects.clear();
      w.highlight([]);
      w.setWeekFocus(week.events.flatMap((e) => e.places));
      syncChannels();
      if (first) w.setParams(paramsFor(week));
      else void w.tweenTo(paramsFor(week), 2000);
      if (!eventId) void (first && isNarrow() ? w.focusAsiaPacific(0) : w.resetCamera(first ? 0 : 1100));
    }

    if (!keep && scenario) endScenario(false);
    if (keep) {
      startScenario(keep);
      return;
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
    if (!webglOk) return;
    textMode = !textMode;
    writePref(TEXT_KEY, textMode ? '1' : '0');
    pause();
    syncChrome();
    const cur = player.steps[player.index];
    const focusId = cur?.kind === 'event' ? cur.eventId : null;
    renderText(focusId);
    if (!textMode) {
      const w = ensureWorld();
      if (w) {
        w.effects.clear();
        w.highlight([]);
        w.setWeekFocus(week.events.flatMap((e) => e.places));
        syncChannels();
        w.setParams(paramsFor(week));
        void w.resetCamera(0);
      }
      player = initialPlayer(steps, player.speed);
      syncControls();
      setHash(null);
      if (scenario) startScenario(scenario);
      else if (!isNarrow()) showPanel(introPanel());
    }
  });

  whatIfBtn.addEventListener('click', () => {
    // 推演進行中：重新顯示結果（含「結束推演」），結果面板被關掉或換掉後也能用滑鼠或觸控結束。
    if (scenario && scenarioResult) {
      if (textMode) {
        renderText(null);
        window.scrollTo(0, 0);
      } else showPanel(renderScenarioResult(scenarioResult, index));
      return;
    }
    const picker = renderScenarioPicker(statesFor(week.weekId, index), index);
    if (textMode) {
      textRoot.prepend(picker);
      window.scrollTo(0, 0);
      return;
    }
    pause();
    showPanel(picker);
  });
  root.addEventListener('start-scenario', (e) => startScenario((e as CustomEvent<Shock>).detail));
  root.addEventListener('end-scenario', () => endScenario());
  root.addEventListener('replay-scenario', () => {
    if (!scenarioResult || !world) return;
    world.effects.clear();
    void world.showScenario(scenarioResult);
  });

  stateBtn.addEventListener('click', () => {
    if (textMode) return;
    pause();
    showPanel(renderWorldState(statesFor(week.weekId, index), index));
  });

  networkBtn.addEventListener('click', () => {
    networkMode = !networkMode;
    writePref(NETWORK_KEY, networkMode ? '1' : '0');
    world?.setNetworkMode(networkMode);
    syncChrome();
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
    await goWeek(r.weekId, r.eventId, r.invalid, r.scenario);
    return true;
  }

  window.addEventListener('hashchange', () => void routeFromHash());

  // E2E 測試鉤子：只在 ?test=1 時暴露。
  if (new URLSearchParams(location.search).has('test')) {
    Object.assign(window, { __econ: { ready: false, pick: (path: string) => selectNode(path), pickChannel: (id: string) => selectChannel(id), nodeState: (id: string) => statesFor(week.weekId, index)[id] ?? null, scenario: () => scenarioResult, cameraTarget: () => world?.cameraTarget() ?? null, world: () => world } });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && scenario) {
      endScenario();
      return;
    }
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
  const hook = (window as unknown as { __econ?: { ready: boolean } }).__econ;
  if (hook) hook.ready = true;
}
