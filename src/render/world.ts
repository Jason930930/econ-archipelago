import * as THREE from 'three';
import { ENTITIES, type EntityId } from '../world/entities';
import { primaryIndicator } from '../world/entityIndicators';
import { lerpVisualParams, type VisualParams } from '../world/visualParams';
import { createEffects, type Effects } from './effects';
import { buildIslands, buildLandmark, buildShipping, type Landmark } from './islands';
import { createStage, HOME, type ColorMode } from './scene';

export { supportsWebGL } from './support';
export type { ColorMode } from './scene';

export interface WorldView {
  setParams(p: VisualParams): void;
  tweenTo(p: VisualParams, ms: number): Promise<void>;
  flyTo(id: EntityId, ms?: number): Promise<void>;
  resetCamera(ms?: number): Promise<void>;
  highlight(ids: EntityId[]): void;
  setColorMode(m: ColorMode): void;
  setLowPower(on: boolean): void;
  onPick(cb: (id: EntityId | null) => void): void;
  onHover(cb: (id: EntityId | null, screen: { x: number; y: number }) => void): void;
  effects: Effects;
  dispose(): void;
}

export function createWorld(canvas: HTMLCanvasElement): WorldView {
  const overlay = canvas.parentElement ?? document.body;
  const stage = createStage(canvas, overlay);
  const { scene, camera } = stage;

  buildIslands(scene);
  const shipping = buildShipping(scene);
  const landmarks = new Map<EntityId, Landmark>();
  const pickables: THREE.Object3D[] = [];
  for (const def of ENTITIES) {
    const lm = buildLandmark(def);
    landmarks.set(def.id, lm);
    scene.add(lm.group);
    pickables.push(lm.group);
  }

  // 高亮光環
  const rings = new Map<EntityId, THREE.Mesh>();
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  for (const [id, lm] of landmarks) {
    const r = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.3, 40).rotateX(-Math.PI / 2), ringMat);
    r.position.set(lm.def.position[0], 0.2, lm.def.position[1]);
    r.visible = false;
    scene.add(r);
    rings.set(id, r);
  }

  let colorMode: ColorMode = 'tw';
  let current: VisualParams | null = null;
  let focus: EntityId | null = null;

  function apply(p: VisualParams) {
    current = p;
    for (const lm of landmarks.values()) {
      lm.apply(p, colorMode);
      const key = primaryIndicator(lm.id);
      lm.setDim(key !== null && p.status[key] !== undefined);
    }
    shipping.setCount(p.tankers);
    stage.setWeather(p.weather);
    stage.setHaze(p.cpiHaze);
  }

  stage.onFrame((dt, t) => {
    for (const lm of landmarks.values()) lm.update(dt, t);
    shipping.update(dt, t);
    ringMat.opacity = 0.55 + Math.sin(t * 4) * 0.25;
  });

  // 拾取與 hover
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pickAt(clientX: number, clientY: number): EntityId | null {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pickables, true)[0];
    return (hit?.object.userData.entityId as EntityId | undefined) ?? null;
  }

  const pickCbs: ((id: EntityId | null) => void)[] = [];
  const hoverCbs: ((id: EntityId | null, s: { x: number; y: number }) => void)[] = [];
  let down: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
  const onUp = (e: PointerEvent) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
      const id = pickAt(e.clientX, e.clientY);
      for (const cb of pickCbs) cb(id);
    }
    down = null;
  };
  let hoverPending = false;
  let lastHover: EntityId | null = null;
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || hoverPending) return;
    hoverPending = true;
    requestAnimationFrame(() => {
      hoverPending = false;
      const id = pickAt(e.clientX, e.clientY);
      canvas.style.cursor = id ? 'pointer' : '';
      if (id !== lastHover || id) for (const cb of hoverCbs) cb(id, { x: e.clientX, y: e.clientY });
      lastHover = id;
    });
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointermove', onMove);

  const effects = createEffects({ stage, landmarks, colorMode: () => colorMode, focus: () => focus });

  return {
    setParams: apply,
    tweenTo(p, ms) {
      const from = current;
      if (!from) {
        apply(p);
        return Promise.resolve();
      }
      return stage.animate(ms, (k) => apply(lerpVisualParams(from, p, k)));
    },
    flyTo(id, ms = 1200) {
      focus = id;
      const [x, z] = landmarks.get(id)!.def.position;
      return stage.lookAt(x, z + 0.5, 1.9, ms);
    },
    resetCamera(ms = 1200) {
      focus = null;
      return stage.lookAt(HOME.x, HOME.z, HOME.zoom, ms);
    },
    highlight(ids) {
      for (const [id, r] of rings) r.visible = ids.includes(id);
    },
    setColorMode(m) {
      colorMode = m;
      if (current) apply(current);
    },
    setLowPower: stage.setLowPower,
    onPick: (cb) => void pickCbs.push(cb),
    onHover: (cb) => void hoverCbs.push(cb),
    effects,
    dispose() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointermove', onMove);
      stage.dispose();
    },
  };
}
