import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { getChannel, getChannelNode } from '../world/channels';
import { UP_DOWN } from './colors';
import type { WorldGraph } from './graph';
import type { ColorMode, Stage } from './scene';

export interface Effects {
  /** 依地標類型播放事件動畫（約 1.5s）；負面偏紅暗、正面偏亮。 */
  pulse(path: string, sentiment: number): Promise<void>;
  /** 粒子沿弧線從 from 流到 to（約 2s），弧頂顯示 label；from === to 時改為原地環狀脈衝。 */
  flow(fromPath: string, toPath: string, label: string): Promise<void>;
  /** 粒子沿某條傳導管線流動（約 2s）並讓管線短暫加亮；找不到管線時退回 flow。 */
  flowAlong(channelId: string, label: string, opts?: { quiet?: boolean }): Promise<void>;
  /** 從目前焦點擴散到台灣證交所，顏色依 direction 與配色模式，並顯示摘要。 */
  ripple(direction: -1 | 0 | 1, summary: string): Promise<void>;
  /** 終幕：在對應地標插上旗幟；未確認者加「未確認」。 */
  showFlags(items: { path: string; text: string; confirmed: boolean }[]): void;
  /** 清除所有特效並讓進行中的 Promise 立即完成。 */
  clear(): void;
}

export interface EffectsCtx {
  stage: Stage;
  graph: WorldGraph;
  colorMode(): ColorMode;
  focus(): string | null;
  /** 傳導管線的曲線；沒有管線層或找不到時回傳 null。 */
  channelCurve?(id: string): THREE.Curve<THREE.Vector3> | null;
  flashChannel?(id: string, ms: number): void;
}

const NEGATIVE = new THREE.Color('#ff5b3a');
const POSITIVE = new THREE.Color('#ffe27a');
const NEUTRAL = new THREE.Color('#e8eef3');

function sentimentColor(s: number): THREE.Color {
  return s < 0 ? NEGATIVE : s > 0 ? POSITIVE : NEUTRAL;
}

/** 以文字節點建立 CSS2D 標籤（資料一律當文字，不當 HTML）。 */
function label(lines: string[], cls: string, accent?: string): CSS2DObject {
  const div = document.createElement('div');
  div.className = `fx-label ${cls}`;
  if (accent) div.style.borderColor = accent;
  for (const line of lines) {
    const p = document.createElement('div');
    p.textContent = line;
    div.appendChild(p);
  }
  return new CSS2DObject(div);
}

function ringMesh(color: THREE.Color, inner = 0.8, outer = 1): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
}

export function createEffects(ctx: EffectsCtx): Effects {
  const { stage, graph } = ctx;
  const root = new THREE.Group();
  stage.scene.add(root);

  /** 落點一律取最近的已繪節點；查不到時回傳 null，由呼叫端靜默略過。 */
  const ground = (path: string, y = 0): THREE.Vector3 | null => {
    const n = graph.nearest(path);
    if (!n) return null;
    // 地區節點的 group 位於原點，所以一律取 anchor 的水平位置。
    const { x, z } = n.anchor();
    return new THREE.Vector3(x, y, z);
  };
  const topOf = (path: string): THREE.Vector3 | null => graph.nearest(path)?.anchor() ?? null;
  /** 漣漪標籤只保留到下一次脈衝，避免畫面堆積。 */
  let rippleTags: THREE.Object3D[] = [];
  /** clear() 會遞增；進行中的特效在每個 await 後比對，不同就中止，避免在新的一週畫出舊資料。 */
  let generation = 0;

  function remove(o: THREE.Object3D) {
    o.traverse((c) => {
      if (c instanceof CSS2DObject) c.element.remove();
      const m = c as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    o.removeFromParent();
  }

  async function pulse(path: string, sentiment: number): Promise<void> {
    const node = graph.nearest(path);
    const base = ground(path, 0.55);
    if (!node || !base) return;
    const height = node.anchor().y;
    const gen = generation;
    rippleTags.forEach(remove);
    rippleTags = [];
    const color = sentimentColor(sentiment);
    const ring = ringMesh(color, 0.85, 1.1);
    ring.position.copy(base);
    root.add(ring);
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 1, 24, 1, true).translate(0, 0.5, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    );
    column.position.copy(base).setY(0.45);
    root.add(column);
    const strength = 0.12 + Math.min(3, Math.abs(sentiment)) * 0.06;
    await stage.animate(1500, (k) => {
      ring.scale.setScalar(1 + k * 2.6);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - k * k);
      column.scale.set(1 - k * 0.4, 0.5 + Math.sin(k * Math.PI) * (height + 1), 1 - k * 0.4);
      (column.material as THREE.MeshBasicMaterial).opacity = 0.35 * Math.sin(k * Math.PI);
      // 地區節點的 group 位於原點，縮放會讓島滑開，所以只對區塊與實體做彈跳。
      if (node.kind !== 'region') node.object.scale.setScalar(1 + Math.sin(k * Math.PI * 2) * strength * (1 - k));
    });
    node.object.scale.setScalar(1);
    remove(ring);
    remove(column);
    if (gen !== generation) return;
  }

  async function flow(from: string, to: string, text: string): Promise<void> {
    if (from === to) {
      await pulse(from, 0);
      return;
    }
    const gen = generation;
    const a = topOf(from);
    const b = topOf(to);
    if (!a || !b) return;
    const dist = a.distanceTo(b);
    const mid = a.clone().lerp(b, 0.5);
    mid.y += 1.5 + dist * 0.28;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);

    const arc = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(64)),
      new THREE.LineDashedMaterial({ color: '#fff4c2', dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.85 }),
    );
    arc.computeLineDistances();
    root.add(arc);

    await particles(curve, text);
    if (gen !== generation) return;
    (arc.material as THREE.LineDashedMaterial).opacity = 0.4;
  }

  /** 粒子沿 curve 從起點流到終點（2s），curve 中點上方顯示 text。 */
  async function particles(curve: THREE.Curve<THREE.Vector3>, text: string, quiet = false): Promise<void> {
    const n = stage.lowPower || quiet ? 12 : 40;
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffd166', size: 8, sizeAttenuation: false, transparent: true, opacity: 1, depthWrite: false }));
    points.frustumCulled = false;
    root.add(points);

    if (!quiet) {
      const tag = label([text], 'fx-flow');
      tag.position.copy(curve.getPoint(0.5)).add(new THREE.Vector3(0, 0.5, 0));
      root.add(tag);
    }

    const v = new THREE.Vector3();
    await stage.animate(quiet ? 1600 : 2000, (k) => {
      for (let i = 0; i < n; i++) {
        const u = k * 1.4 - (i / n) * 0.4;
        curve.getPoint(Math.min(1, Math.max(0, u)), v);
        arr.set([v.x, v.y, v.z], i * 3);
      }
      geo.attributes.position!.needsUpdate = true;
      (points.material as THREE.PointsMaterial).opacity = k < 0.9 ? 1 : (1 - k) * 10;
    });
    remove(points);
  }

  async function flowAlong(channelId: string, text: string, opts: { quiet?: boolean } = {}): Promise<void> {
    const curve = ctx.channelCurve?.(channelId) ?? null;
    if (!curve) {
      const c = getChannel(channelId);
      if (c) await flow(getChannelNode(c.from).path, getChannelNode(c.to).path, text);
      return;
    }
    if (!opts.quiet) ctx.flashChannel?.(channelId, 2600);
    await particles(curve, text, opts.quiet);
  }

  async function ripple(direction: -1 | 0 | 1, summary: string): Promise<void> {
    const gen = generation;
    const c = UP_DOWN[ctx.colorMode()];
    const color = new THREE.Color(direction > 0 ? c.up : direction < 0 ? c.down : '#cfd8dc');
    const target = ground('tw', 0.55);
    if (!target) return;
    const src = ctx.focus();
    const origin = (src && ground(src, 0.55)) || target.clone();
    const reach = Math.max(1.2, origin.distanceTo(target));

    const wave = ringMesh(color, 0.9, 1);
    wave.position.copy(origin);
    root.add(wave);
    await stage.animate(1300, (k) => {
      wave.scale.setScalar(0.5 + k * reach);
      (wave.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k * 0.7);
    });
    remove(wave);
    if (gen !== generation) return;

    const hit = ringMesh(color, 0.7, 1.05);
    hit.position.copy(target);
    root.add(hit);
    const tag = label(['對台灣的影響', summary], 'fx-ripple', `#${color.getHexString()}`);
    tag.position.copy(target).add(new THREE.Vector3(3.2, 1.2, 1.6));
    root.add(tag);
    rippleTags.push(tag);
    await stage.animate(900, (k) => {
      hit.scale.setScalar(1 + k * 1.5);
      (hit.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    });
    remove(hit);
  }

  function showFlags(items: { path: string; text: string; confirmed: boolean }[]): void {
    // 旗子插在每個位置上；標籤則依地區合併成一個（海域依各航道），避免相鄰標籤重疊。
    const flagged = new Set<string>();
    const byRegion = new Map<string, { anchor: string; lines: string[] }>();
    for (const it of items) {
      if (!graph.nearest(it.path)) continue;
      flagged.add(it.path);
      const region = it.path.split('/')[0]!;
      const key = region === 'seas' ? it.path : region;
      const g = byRegion.get(key) ?? { anchor: it.path, lines: [] };
      g.lines.push(it.confirmed ? it.text : `${it.text}（未確認）`);
      byRegion.set(key, g);
    }
    for (const path of flagged) {
      const top = topOf(path)!;
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 5), new THREE.MeshStandardMaterial({ color: '#ddd' }));
      pole.position.set(0.6, top.y + 1, 0);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.03), new THREE.MeshStandardMaterial({ color: '#ffb703', emissive: new THREE.Color('#ff8800'), emissiveIntensity: 0.4 }));
      flag.position.set(1.0, top.y + 1.75, 0);
      g.add(pole, flag);
      g.position.set(top.x, 0, top.z);
      root.add(g);
    }
    for (const { anchor, lines } of byRegion.values()) {
      const top = topOf(anchor)!;
      const tag = label(lines.slice(0, 4).concat(lines.length > 4 ? [`…另 ${lines.length - 4} 項`] : []), 'fx-flag');
      tag.position.set(top.x + 0.6, top.y + 2.8, top.z);
      root.add(tag);
    }
  }

  function clear(): void {
    generation++;
    stage.cancelTweens();
    for (const n of graph.all()) n.object.scale.setScalar(1);
    for (const c of [...root.children]) remove(c);
    rippleTags = [];
  }

  return { pulse, flow, flowAlong, ripple, showFlags, clear };
}
