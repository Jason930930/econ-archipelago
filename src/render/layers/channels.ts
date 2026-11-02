import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { ChannelActivity, ProposalSummary } from '../../world/activation';
import { CHANNELS, FAMILY_INFO, getChannelNode, type Channel } from '../../world/channels';
import { laneIndexesByPath, routeControls, sameRegion } from '../channelRoute';
import type { WorldGraph } from '../graph';
import { ISLAND_TOP_Y } from './islandTerrain';
import { makeLabel } from './labels';

/** 管線端點高度：略高於島面，讓管線從區塊冒出來。 */
const END_Y = ISLAND_TOP_Y + 0.2;
const DARK_OPACITY = 0.12;
const DARK_RADIUS = 0.06;
const DOTS = 6;

export const isBright = (a: ChannelActivity | undefined) => !!a && (a.intensity > 0 || a.heat >= 0.5);
export const brightOpacity = (heat: number) => 0.35 + 0.5 * Math.min(1, heat / 3);
export const brightRadius = (heat: number) => 0.08 + 0.06 * Math.min(heat, 3);

export interface ChannelLayer {
  readonly group: THREE.Group;
  /** 依目前的節點位置重建所有管線（區塊或實體重建後呼叫）。 */
  rebuild(): void;
  setActivity(a: Record<string, ChannelActivity>, proposals: ProposalSummary[]): void;
  setNetwork(on: boolean): void;
  /** 播放時讓某條管道短暫加亮（ms 後恢復）。 */
  flash(id: string, ms: number): void;
  curve(id: string): THREE.Curve<THREE.Vector3> | null;
  update(dt: number, t: number): void;
  dispose(): void;
}

interface Pipe {
  channel: Channel;
  curve: THREE.QuadraticBezierCurve3;
  tube: THREE.Mesh;
  dots: THREE.Points;
  neg: CSS2DObject | null;
  label: CSS2DObject;
  phase: number;
}

function endpoint(graph: WorldGraph, path: string): [number, number] | null {
  const n = graph.nearest(path);
  if (!n) return null;
  // 地區節點的 group 位於原點，所以一律用 anchor 的水平位置。
  const p = n.kind === 'region' ? n.anchor() : n.object.getWorldPosition(new THREE.Vector3());
  return [p.x, p.z];
}

function curveBetween(graph: WorldGraph, from: string, to: string, lane: number): THREE.QuadraticBezierCurve3 | null {
  const a = endpoint(graph, from), b = endpoint(graph, to);
  if (!a || !b) return null;
  const r = routeControls(a, b, lane, sameRegion(from, to));
  return new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(r.start[0], END_Y, r.start[1]),
    new THREE.Vector3(...r.mid),
    new THREE.Vector3(r.end[0], END_Y, r.end[1]),
  );
}

function darkColor(hex: string): THREE.Color {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(hsl.h, hsl.s * 0.35, hsl.l);
}

function dispose(o: THREE.Object3D) {
  o.traverse((c) => {
    if (c instanceof CSS2DObject) c.element.remove();
    const m = c as THREE.Mesh;
    m.geometry?.dispose();
    (m.material as THREE.Material | undefined)?.dispose();
  });
  o.removeFromParent();
}

/** 網絡模式的管道名稱只在拉近（與部門名同級）時顯示，全圖時避免文字堆疊。 */
export const CHANNEL_LABEL_ZOOM = 1.8;

export function createChannelLayer(graph: WorldGraph, opts: { lowPower(): boolean; zoom(): number }): ChannelLayer {
  const group = new THREE.Group();
  group.name = 'channels';
  let pipes = new Map<string, Pipe>();
  let proposalLines: THREE.Line[] = [];
  let activity: Record<string, ChannelActivity> = {};
  let proposals: ProposalSummary[] = [];
  let network = false;
  const flashing = new Map<string, number>();

  function lanes() {
    return laneIndexesByPath([
      ...CHANNELS.map((c) => ({ key: `c:${c.id}`, from: getChannelNode(c.from).path, to: getChannelNode(c.to).path })),
      ...proposals.filter((p) => !p.promoted).map((p) => ({ key: `p:${p.id}`, from: p.fromPath, to: p.toPath })),
    ]);
  }

  function buildPipe(c: Channel, lane: number): Pipe | null {
    const from = getChannelNode(c.from), to = getChannelNode(c.to);
    const curve = curveBetween(graph, from.path, to.path, lane);
    if (!curve) return null;
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 48, DARK_RADIUS, 6, false),
      new THREE.MeshBasicMaterial({ color: darkColor(FAMILY_INFO[c.family].color), transparent: true, opacity: DARK_OPACITY, depthWrite: false }),
    );
    tube.userData.channel = c.id;
    tube.renderOrder = 2;
    const dots = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(DOTS * 3), 3)),
      new THREE.PointsMaterial({ color: '#fff6d6', size: 5, sizeAttenuation: false, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    dots.visible = false;
    dots.frustumCulled = false;
    dots.raycast = () => {};
    let neg: CSS2DObject | null = null;
    if (c.sign < 0) {
      neg = new CSS2DObject(makeLabel('−', 'channel-neg'));
      neg.position.copy(curve.getPoint(0.5));
      neg.visible = false;
    }
    const label = new CSS2DObject(makeLabel(`${from.name} → ${to.name}`, 'channel-label'));
    label.position.copy(curve.getPoint(0.5)).add(new THREE.Vector3(0, 0.35, 0));
    label.visible = false;
    group.add(tube, dots);
    if (neg) group.add(neg);
    group.add(label);
    return { channel: c, curve, tube, dots, neg, label, phase: (c.id.length * 0.137) % 1 };
  }

  function restyle() {
    for (const p of pipes.values()) {
      const a = activity[p.channel.id];
      const lit = network || isBright(a) || flashing.has(p.channel.id);
      // 網絡模式下沒有熱度的管道，以熱度 1 的亮管樣式呈現；播放加亮時以最高熱度呈現。
      const heat = flashing.has(p.channel.id) ? 3 : Math.max(a?.heat ?? 0, network ? 1 : 0);
      const mat = p.tube.material as THREE.MeshBasicMaterial;
      const family = FAMILY_INFO[p.channel.family].color;
      mat.color.copy(lit ? new THREE.Color(family) : darkColor(family));
      mat.opacity = lit ? brightOpacity(heat) : DARK_OPACITY;
      const radius = lit ? brightRadius(heat) : DARK_RADIUS;
      if (p.tube.userData.radius !== radius) {
        p.tube.geometry.dispose();
        p.tube.geometry = new THREE.TubeGeometry(p.curve, 48, radius, 6, false);
        p.tube.userData.radius = radius;
      }
      // 一般模式只有亮管可以點，避免暗管搶走區塊的點擊。
      p.tube.userData.pickable = lit;
      p.dots.visible = lit && (isBright(a) || flashing.has(p.channel.id));
      if (p.neg) p.neg.visible = lit;
      p.label.visible = network && opts.zoom() >= CHANNEL_LABEL_ZOOM;
    }
  }

  function buildProposals(laneOf: Map<string, number>) {
    for (const l of proposalLines) dispose(l);
    proposalLines = [];
    for (const p of proposals) {
      if (p.promoted) continue;
      const curve = curveBetween(graph, p.fromPath, p.toPath, laneOf.get(`p:${p.id}`) ?? 0);
      if (!curve) continue;
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(64)),
        new THREE.LineDashedMaterial({ color: '#9aa4ad', dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0.8, depthWrite: false }),
      );
      line.computeLineDistances();
      line.userData.proposal = p.id;
      line.userData.pickable = true;
      group.add(line);
      proposalLines.push(line);
    }
  }

  function rebuild() {
    for (const p of pipes.values()) for (const o of [p.tube, p.dots, p.neg, p.label]) if (o) dispose(o);
    pipes = new Map();
    const laneOf = lanes();
    for (const c of CHANNELS) {
      const p = buildPipe(c, laneOf.get(`c:${c.id}`) ?? 0);
      if (p) pipes.set(c.id, p);
    }
    buildProposals(laneOf);
    restyle();
  }

  const v = new THREE.Vector3();
  return {
    group,
    rebuild,
    setActivity(a, ps) {
      activity = a;
      const changed = JSON.stringify(ps.map((p) => [p.id, p.fromPath, p.toPath, p.promoted])) !== JSON.stringify(proposals.map((p) => [p.id, p.fromPath, p.toPath, p.promoted]));
      proposals = ps;
      if (changed) rebuild();
      else restyle();
    },
    setNetwork(on) {
      network = on;
      restyle();
    },
    flash(id, ms) {
      if (!pipes.has(id)) return;
      flashing.set(id, performance.now() + ms);
      restyle();
    },
    curve: (id) => pipes.get(id)?.curve ?? null,
    update(_dt, t) {
      const showLabels = network && opts.zoom() >= CHANNEL_LABEL_ZOOM;
      for (const p of pipes.values()) p.label.visible = showLabels;
      if (flashing.size) {
        const now = performance.now();
        let expired = false;
        for (const [id, until] of flashing) if (until <= now) { flashing.delete(id); expired = true; }
        if (expired) restyle();
      }
      const n = opts.lowPower() ? 3 : DOTS;
      for (const p of pipes.values()) {
        if (!p.dots.visible) continue;
        const speed = (activity[p.channel.id]?.streak ?? 0) >= 2 ? 0.5 : 0.25;
        const arr = (p.dots.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
        p.dots.geometry.setDrawRange(0, n);
        for (let i = 0; i < n; i++) {
          const u = (t * speed + p.phase + i / n) % 1;
          p.curve.getPoint(u, v);
          arr.set([v.x, v.y + 0.02, v.z], i * 3);
        }
        p.dots.geometry.attributes.position!.needsUpdate = true;
      }
    },
    dispose() {
      dispose(group);
      pipes.clear();
      proposalLines = [];
    },
  };
}
