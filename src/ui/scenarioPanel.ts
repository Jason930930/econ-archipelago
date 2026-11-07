import type { ArchiveIndex } from '../data/buildIndex';
import { CHANNEL_NODES, getChannel, getChannelNode } from '../world/channels';
import { getRegion, isRegionId, REGION_IDS } from '../world/regions';
import { SCENARIO_NOTE, stepDirections, STRENGTH_TEXT, WAVE_TEXT, type Effect, type ScenarioResult, type Shock, type Wave } from '../world/scenario';
import type { NodeState } from '../world/state';
import { el } from './dom';
import { stateChip } from './stateCard';

const arrow = (d: 1 | -1) => (d > 0 ? '↑' : '↓');

function emit(node: HTMLElement, type: string, detail: unknown) {
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
}
function button(label: string, attrs: Record<string, string>, type: string, detail: unknown): HTMLButtonElement {
  const b = el('button', { type: 'button', ...attrs }, label);
  b.addEventListener('click', () => emit(b, type, detail));
  return b;
}

/** 「油價 ↑ → 美國通膨 ↑ → Fed 政策利率 ↑」；每一步滑過顯示該管道的機制。 */
function pathElement(prefix: string, shock: Shock, path: string[]): HTMLElement {
  const dirs = stepDirections(shock, path);
  const p = el('p', { class: 'scenario-why' }, prefix, `${getChannelNode(shock.node).name} ${arrow(shock.direction)}`);
  path.forEach((id, i) => {
    const c = getChannel(id);
    p.append(' → ', el('span', { class: 'scenario-step', title: c ? c.mechanism : id }, `${c ? getChannelNode(c.to).name : id} ${arrow(dirs[i]!)}`));
  });
  return p;
}

/** 「油價 ↑ → 美國通膨 ↑ → Fed 政策利率 ↑」 */
export function pathText(shock: Shock, path: string[]): string {
  const dirs = stepDirections(shock, path);
  const parts = [`${getChannelNode(shock.node).name} ${arrow(shock.direction)}`];
  path.forEach((id, i) => {
    const c = getChannel(id);
    parts.push(`${c ? getChannelNode(c.to).name : id} ${arrow(dirs[i]!)}`);
  });
  return parts.join(' → ');
}

const regionOf = (path: string) => path.split('/')[0]!;
function groupedNodes(): { region: string; nodes: typeof CHANNEL_NODES[number][] }[] {
  const order = [...REGION_IDS] as string[];
  const regions = [...new Set(CHANNEL_NODES.map((n) => regionOf(n.path)))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return regions.map((region) => ({ region, nodes: CHANNEL_NODES.filter((n) => regionOf(n.path) === region) }));
}
const regionName = (id: string) => (isRegionId(id) ? getRegion(id).name : id);

/** 挑選面板：依地區列出 36 個節點；選一個之後出現「若上升／若下降」。 */
export function renderScenarioPicker(states: Record<string, NodeState>, _index: ArchiveIndex): HTMLElement {
  // 方向按鈕直接出現在所選的那一列下方，長清單捲到下面時也看得到。
  const actions = el('div', { class: 'scenario-actions' });
  const root = el('section', { class: 'scenario-picker' },
    el('div', { class: 'card-meta' }, '情境推演'),
    el('h3', {}, '選一個節點，給它一個衝擊'),
    el('p', { class: 'muted' }, '網站會沿著傳導管道推演衝擊擴散到哪些地方、方向與大約多久，並和目前狀態對照。'));
  const rows: HTMLButtonElement[] = [];
  for (const g of groupedNodes()) {
    const list = el('ul', { class: 'state-rows' });
    for (const n of g.nodes) {
      const b = el('button', { type: 'button', class: 'state-row scenario-node', 'data-node': n.id, 'aria-pressed': 'false' },
        el('span', { class: 'state-row-name' }, n.name), stateChip(states[n.id]));
      b.addEventListener('click', () => {
        for (const r of rows) r.setAttribute('aria-pressed', String(r === b));
        actions.replaceChildren(
          button('推演：若上升 ↑', { class: 'btn', 'data-direction': 'up' }, 'start-scenario', { node: n.id, direction: 1 }),
          button('推演：若下降 ↓', { class: 'btn', 'data-direction': 'down' }, 'start-scenario', { node: n.id, direction: -1 }));
        b.closest('li')?.append(actions);
        actions.querySelector<HTMLButtonElement>('button')?.focus();
      });
      rows.push(b);
      list.append(el('li', {}, b));
    }
    root.append(el('h4', {}, regionName(g.region)), list);
  }
  root.append(el('p', { class: 'channel-note' }, SCENARIO_NOTE));
  return root;
}

const VS_TEXT = { same: '與目前趨勢一致（加劇）', opposite: '與目前趨勢相反（可能反轉）', none: '' } as const;

function effectRow(shock: Shock, e: Effect): HTMLElement {
  const node = getChannelNode(e.node);
  const head = el('button', { type: 'button', class: 'scenario-effect-head' },
    el('strong', {}, node.name),
    el('span', { class: 'scenario-dir' }, e.direction === null ? '方向分歧 ⇅' : arrow(e.direction)),
    el('span', { class: `scenario-strength strength-${e.strength}` }, STRENGTH_TEXT[e.strength]));
  head.addEventListener('click', () => emit(head, 'select-node', { path: node.path }));
  const li = el('li', { class: 'scenario-effect', 'data-node': e.node }, head);
  const notes = [VS_TEXT[e.vsCurrent], e.extreme === 'high' ? '已在 5 年高檔' : e.extreme === 'low' ? '已在 5 年低檔' : ''].filter(Boolean);
  if (notes.length) li.append(el('p', { class: 'muted scenario-vs' }, notes.join('・')));
  if (e.counterPath) {
    li.append(pathElement('一條路徑：', shock, e.path), pathElement('另一條路徑：', shock, e.counterPath));
  } else {
    li.append(pathElement('為什麼：', shock, e.path));
  }
  return li;
}

export function renderScenarioResult(r: ScenarioResult, _index: ArchiveIndex): HTMLElement {
  const name = getChannelNode(r.shock.node).name;
  const root = el('section', { class: 'scenario-result', 'data-node': r.shock.node },
    el('div', { class: 'card-meta' }, '情境推演'),
    el('h3', {}, `情境：${name} ${arrow(r.shock.direction)}`),
    el('div', { class: 'scenario-buttons' },
      button('重播', { class: 'btn', 'data-action': 'replay-scenario' }, 'replay-scenario', null),
      button('結束推演', { class: 'btn', 'data-action': 'end-scenario' }, 'end-scenario', null)));
  if (r.effects.length === 0) {
    root.append(el('p', { class: 'muted' }, '這個節點目前沒有可往外傳導的管道。'), el('p', { class: 'channel-note' }, SCENARIO_NOTE));
    return root;
  }
  const tw = el('section', { class: 'scenario-taiwan' }, el('h4', {}, '對台灣'));
  if (r.taiwan.length === 0) tw.append(el('p', { class: 'muted' }, '這個衝擊沒有傳到台灣的節點。'));
  else tw.append(el('ul', { class: 'scenario-list' }, ...r.taiwan.map((e) => effectRow(r.shock, e))));
  root.append(tw);
  for (const wave of [1, 2, 3] as Wave[]) {
    const list = r.effects.filter((e) => e.wave === wave);
    if (list.length === 0) continue;
    root.append(el('section', { class: 'scenario-wave', 'data-wave': String(wave) }, el('h4', {}, WAVE_TEXT[wave]),
      el('ul', { class: 'scenario-list' }, ...list.map((e) => effectRow(r.shock, e)))));
  }
  root.append(el('p', { class: 'channel-note' }, SCENARIO_NOTE));
  return root;
}

/** 文字模式版本：沒有按鈕與動畫。 */
export function renderScenarioText(r: ScenarioResult, _index: ArchiveIndex): HTMLElement {
  const name = getChannelNode(r.shock.node).name;
  const root = el('section', { class: 'text-scenario' }, el('h3', { class: 'section-title' }, `情境：${name} ${arrow(r.shock.direction)}`),
    button('結束推演', { class: 'btn', 'data-action': 'end-scenario' }, 'end-scenario', null));
  const line = (e: Effect) => {
    const n = getChannelNode(e.node).name;
    const dir = e.direction === null ? '方向分歧 ⇅' : arrow(e.direction);
    const extra = [VS_TEXT[e.vsCurrent], e.extreme === 'high' ? '已在 5 年高檔' : e.extreme === 'low' ? '已在 5 年低檔' : ''].filter(Boolean).join('・');
    return el('li', {}, el('strong', {}, `${n} ${dir}（${STRENGTH_TEXT[e.strength]}）`), `：${pathText(r.shock, e.path)}${extra ? `；${extra}` : ''}`);
  };
  if (r.effects.length === 0) root.append(el('p', {}, '這個節點目前沒有可往外傳導的管道。'));
  else {
    root.append(el('h4', {}, '對台灣'), r.taiwan.length ? el('ul', { class: 'links' }, ...r.taiwan.map(line)) : el('p', {}, '這個衝擊沒有傳到台灣的節點。'));
    for (const wave of [1, 2, 3] as Wave[]) {
      const list = r.effects.filter((e) => e.wave === wave);
      if (list.length) root.append(el('h4', {}, WAVE_TEXT[wave]), el('ul', { class: 'links' }, ...list.map(line)));
    }
  }
  root.append(el('p', { class: 'channel-note' }, SCENARIO_NOTE));
  return root;
}
