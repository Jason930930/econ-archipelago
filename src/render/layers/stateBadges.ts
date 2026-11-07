import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { CHANNEL_NODES } from '../../world/channels';
import type { NodeState } from '../../world/state';
import type { WorldGraph } from '../graph';
import { badgeLabel, badgeText, badgeTooltip, badgeVisible, LEVEL_COLORS } from '../stateBadge';

export interface StateBadgeLayer {
  readonly group: THREE.Group;
  /** 依目前的節點位置重建徽章（區塊或實體重建後呼叫）。 */
  rebuild(): void;
  setStates(states: Record<string, NodeState>): void;
  update(): void;
  /** 情境推演時隱藏全部徽章。 */
  setHidden(on: boolean): void;
  dispose(): void;
}

/** 同一路徑的節點放在同一群組裡並排。 */
const BY_PATH = (() => {
  const m = new Map<string, typeof CHANNEL_NODES[number][]>();
  for (const n of CHANNEL_NODES) m.set(n.path, [...(m.get(n.path) ?? []), n]);
  return m;
})();

export function createStateBadges(graph: WorldGraph, opts: { zoom(): number; network(): boolean; onClick(path: string): void }): StateBadgeLayer {
  const group = new THREE.Group();
  group.name = 'state-badges';
  let states: Record<string, NodeState> = {};
  let holders: { path: string; obj: CSS2DObject; buttons: Map<string, HTMLButtonElement> }[] = [];

  function paint(id: string, b: HTMLButtonElement) {
    const node = CHANNEL_NODES.find((n) => n.id === id)!;
    const s = states[id];
    b.className = 'state-badge';
    if (!s || s.freshness === 'unknown') {
      b.classList.add('unknown');
      b.textContent = '?';
      b.style.background = '';
      b.setAttribute('aria-label', `${node.name}：未知`);
      b.title = `${node.name}・尚無資料`;
      return;
    }
    b.textContent = badgeText(s);
    b.style.background = s.level ? LEVEL_COLORS[s.level] : '';
    if (!s.level) b.classList.add('no-level');
    if (s.freshness === 'stale') b.classList.add('stale');
    b.setAttribute('aria-label', badgeLabel(node.name, s));
    b.title = badgeTooltip(node.name, s);
  }

  function clear() {
    for (const h of holders) {
      h.obj.element.remove();
      h.obj.removeFromParent();
    }
    holders = [];
  }

  function rebuild() {
    clear();
    for (const [path, nodes] of BY_PATH) {
      const n = graph.nearest(path);
      if (!n) continue;
      const wrap = document.createElement('div');
      wrap.className = 'state-badges';
      const buttons = new Map<string, HTMLButtonElement>();
      for (const node of nodes) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.node = node.id;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          opts.onClick(node.path);
        });
        paint(node.id, b);
        buttons.set(node.id, b);
        wrap.append(b);
      }
      const obj = new CSS2DObject(wrap);
      if (n.kind === 'region') {
        // 地區層節點放在島名下方。
        const a = n.anchor();
        const r = (n.object.userData.radius as number | undefined) ?? 2;
        obj.position.set(a.x, 0.6, a.z + r + 1.5);
      } else {
        obj.position.copy(n.anchor()).add(new THREE.Vector3(0, 0.5, 0));
      }
      group.add(obj);
      holders.push({ path, obj, buttons });
    }
    update(true);
  }

  let lastZoom = -1;
  let lastNetwork: boolean | null = null;
  let hidden = false;
  function update(force = false) {
    const zoom = opts.zoom(), network = opts.network();
    if (!force && Math.abs(zoom - lastZoom) < 1e-3 && network === lastNetwork) return;
    lastZoom = zoom;
    lastNetwork = network;
    for (const h of holders) h.obj.visible = !hidden && badgeVisible(h.path, zoom, network);
  }

  return {
    group,
    rebuild,
    setStates(next) {
      states = next;
      for (const h of holders) for (const [id, b] of h.buttons) paint(id, b);
    },
    update: () => update(),
    setHidden(on) {
      hidden = on;
      update(true);
    },
    dispose() {
      clear();
      group.removeFromParent();
    },
  };
}
