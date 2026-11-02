import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { getEntity, type EntityId } from '../world/entities';
import { UP_DOWN, type Landmark } from './islands';
import type { ColorMode, Stage } from './scene';

export interface Effects {
  /** 依地標類型播放事件動畫（約 1.5s）；負面偏紅暗、正面偏亮。 */
  pulse(id: EntityId, sentiment: number): Promise<void>;
  /** 粒子沿弧線從 from 流到 to（約 2s），弧頂顯示 label；from === to 時改為原地環狀脈衝。 */
  flow(from: EntityId, to: EntityId, label: string): Promise<void>;
  /** 從目前焦點擴散到台灣證交所，顏色依 direction 與配色模式，並顯示摘要。 */
  ripple(direction: -1 | 0 | 1, summary: string): Promise<void>;
  /** 終幕：在對應地標插上旗幟；未確認者加「未確認」。 */
  showFlags(items: { entity: EntityId; text: string; confirmed: boolean }[]): void;
  /** 清除所有特效並讓進行中的 Promise 立即完成。 */
  clear(): void;
}

export interface EffectsCtx {
  stage: Stage;
  landmarks: Map<EntityId, Landmark>;
  colorMode(): ColorMode;
  focus(): EntityId | null;
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
  const { stage, landmarks } = ctx;
  const root = new THREE.Group();
  stage.scene.add(root);

  const pos = (id: EntityId, y = 0) => {
    const [x, z] = getEntity(id).position;
    return new THREE.Vector3(x, y, z);
  };
  const topOf = (id: EntityId) => pos(id, (landmarks.get(id)?.top ?? 1.5) + 0.3);

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

  async function pulse(id: EntityId, sentiment: number): Promise<void> {
    const lm = landmarks.get(id);
    if (!lm) return;
    const color = sentimentColor(sentiment);
    const ring = ringMesh(color, 0.85, 1.1);
    ring.position.copy(pos(id, 0.55));
    root.add(ring);
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 1, 24, 1, true).translate(0, 0.5, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    );
    column.position.copy(pos(id, 0.45));
    root.add(column);
    const strength = 0.12 + Math.min(3, Math.abs(sentiment)) * 0.06;
    await stage.animate(1500, (k) => {
      ring.scale.setScalar(1 + k * 2.6);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - k * k);
      column.scale.set(1 - k * 0.4, 0.5 + Math.sin(k * Math.PI) * (lm.top + 1.5), 1 - k * 0.4);
      (column.material as THREE.MeshBasicMaterial).opacity = 0.35 * Math.sin(k * Math.PI);
      lm.group.scale.setScalar(1 + Math.sin(k * Math.PI * 2) * strength * (1 - k));
    });
    lm.group.scale.setScalar(1);
    remove(ring);
    remove(column);
  }

  async function flow(from: EntityId, to: EntityId, text: string): Promise<void> {
    if (from === to) {
      await pulse(from, 0);
      return;
    }
    const a = topOf(from);
    const b = topOf(to);
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

    const n = stage.lowPower ? 12 : 40;
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffd166', size: 8, sizeAttenuation: false, transparent: true, opacity: 1, depthWrite: false }));
    root.add(points);

    const tag = label([text], 'fx-flow');
    tag.position.copy(curve.getPoint(0.5)).add(new THREE.Vector3(0, 0.5, 0));
    root.add(tag);

    const v = new THREE.Vector3();
    await stage.animate(2000, (k) => {
      for (let i = 0; i < n; i++) {
        const u = k * 1.4 - (i / n) * 0.4;
        curve.getPoint(Math.min(1, Math.max(0, u)), v);
        arr.set([v.x, v.y, v.z], i * 3);
      }
      geo.attributes.position!.needsUpdate = true;
      (points.material as THREE.PointsMaterial).opacity = k < 0.9 ? 1 : (1 - k) * 10;
    });
    remove(points);
    (arc.material as THREE.LineDashedMaterial).opacity = 0.4;
  }

  async function ripple(direction: -1 | 0 | 1, summary: string): Promise<void> {
    const c = UP_DOWN[ctx.colorMode()];
    const color = new THREE.Color(direction > 0 ? c.up : direction < 0 ? c.down : '#cfd8dc');
    const target = pos('tw-twse', 0.55);
    const src = ctx.focus();
    const origin = src ? pos(src, 0.55) : target.clone();
    const reach = Math.max(1.2, origin.distanceTo(target));

    const wave = ringMesh(color, 0.9, 1);
    wave.position.copy(origin);
    root.add(wave);
    await stage.animate(1300, (k) => {
      wave.scale.setScalar(0.5 + k * reach);
      (wave.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k * 0.7);
    });
    remove(wave);

    const hit = ringMesh(color, 0.7, 1.05);
    hit.position.copy(target);
    root.add(hit);
    const tag = label(['對台灣的影響', summary], 'fx-ripple', `#${color.getHexString()}`);
    tag.position.copy(target).add(new THREE.Vector3(3.2, 1.2, 1.6));
    root.add(tag);
    await stage.animate(900, (k) => {
      hit.scale.setScalar(1 + k * 1.5);
      (hit.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    });
    remove(hit);
  }

  function showFlags(items: { entity: EntityId; text: string; confirmed: boolean }[]): void {
    const byEntity = new Map<EntityId, string[]>();
    for (const it of items) {
      const line = it.confirmed ? it.text : `${it.text}（未確認）`;
      byEntity.set(it.entity, [...(byEntity.get(it.entity) ?? []), line]);
    }
    for (const [id, lines] of byEntity) {
      const top = topOf(id);
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 5), new THREE.MeshStandardMaterial({ color: '#ddd' }));
      pole.position.set(0.6, top.y + 0.7, 0);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.02), new THREE.MeshStandardMaterial({ color: '#ffb703', emissive: new THREE.Color('#ff8800'), emissiveIntensity: 0.4 }));
      flag.position.set(0.88, top.y + 1.25, 0);
      g.add(pole, flag);
      g.position.set(top.x, 0, top.z);
      root.add(g);
      const tag = label(lines.slice(0, 3).concat(lines.length > 3 ? [`…另 ${lines.length - 3} 項`] : []), 'fx-flag');
      tag.position.set(top.x + 0.6, top.y + 2.1, top.z);
      root.add(tag);
    }
  }

  function clear(): void {
    stage.cancelTweens();
    for (const lm of landmarks.values()) lm.group.scale.setScalar(1);
    for (const c of [...root.children]) remove(c);
  }

  return { pulse, flow, ripple, showFlags, clear };
}
