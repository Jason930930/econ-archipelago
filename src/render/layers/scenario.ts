import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { getChannelNode } from '../../world/channels';
import type { Effect, Shock } from '../../world/scenario';
import type { WorldGraph } from '../graph';
import { markerText } from '../scenarioWaves';

/** 情境推演的標記：衝擊節點的光環與箭頭、各節點的「預估」標記、畫面上方的波次橫幅。 */
export interface ScenarioLayer {
  readonly group: THREE.Group;
  setShock(shock: Shock | null): void;
  addMarkers(effects: Effect[]): void;
  banner(text: string | null): void;
  clear(): void;
  update(t: number): void;
  dispose(): void;
}

function anchorOf(graph: WorldGraph, nodeId: string): THREE.Vector3 | null {
  const n = graph.nearest(getChannelNode(nodeId).path);
  return n ? n.anchor() : null;
}

function div(cls: string, text: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = text;
  return d;
}

export function createScenarioLayer(graph: WorldGraph, overlay: HTMLElement): ScenarioLayer {
  const group = new THREE.Group();
  group.name = 'scenario';
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.15, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  ring.visible = false;
  ring.raycast = () => {};
  group.add(ring);
  let shockLabel: CSS2DObject | null = null;
  const markers: CSS2DObject[] = [];
  const bannerEl = div('scenario-banner', '');
  bannerEl.hidden = true;
  overlay.append(bannerEl);

  const drop = (o: CSS2DObject) => {
    o.element.remove();
    o.removeFromParent();
  };

  return {
    group,
    setShock(shock) {
      if (shockLabel) drop(shockLabel);
      shockLabel = null;
      ring.visible = false;
      if (!shock) return;
      const at = anchorOf(graph, shock.node);
      if (!at) return;
      ring.position.set(at.x, 0.7, at.z);
      ring.visible = true;
      const name = getChannelNode(shock.node).name;
      shockLabel = new CSS2DObject(div('scenario-shock', `${name} ${shock.direction > 0 ? '↑' : '↓'}`));
      shockLabel.position.copy(at).add(new THREE.Vector3(0, 1.4, 0));
      group.add(shockLabel);
    },
    addMarkers(effects) {
      for (const e of effects) {
        const at = anchorOf(graph, e.node);
        if (!at) continue;
        const el = div(`forecast-marker${e.direction === null ? ' divergent' : ''} strength-${e.strength}`, markerText(e));
        el.dataset.node = e.node;
        el.title = `預估：${getChannelNode(e.node).name} ${markerText(e)}`;
        const o = new CSS2DObject(el);
        // 同一個落點的多個標記往上疊，避免重疊。
        const stacked = markers.filter((m) => m.userData.key === `${at.x.toFixed(2)},${at.z.toFixed(2)}`).length;
        o.userData.key = `${at.x.toFixed(2)},${at.z.toFixed(2)}`;
        o.position.copy(at).add(new THREE.Vector3(0, 1.1 + stacked * 0.55, 0));
        group.add(o);
        markers.push(o);
      }
    },
    banner(text) {
      bannerEl.hidden = text === null;
      bannerEl.textContent = text ?? '';
    },
    clear() {
      for (const m of markers.splice(0)) drop(m);
      if (shockLabel) drop(shockLabel);
      shockLabel = null;
      ring.visible = false;
      bannerEl.hidden = true;
    },
    update(t) {
      if (!ring.visible) return;
      ring.scale.setScalar(1 + 0.25 * Math.sin(t * 3));
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.35 * Math.sin(t * 3);
    },
    dispose() {
      this.clear();
      bannerEl.remove();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      group.removeFromParent();
    },
  };
}
