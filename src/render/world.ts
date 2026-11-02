import * as THREE from 'three';
import { districtSlots, pickVisibleEntities } from '../world/districts';
import { project } from '../world/geo';
import type { WorldParams } from '../world/indicators';
import { INDICATOR_BINDINGS, lerpWorldParams } from '../world/indicators';
import { layoutIslands, placeAtSea, type IslandLayout } from '../world/layout';
import { getRegion, type RegionId } from '../world/regions';
import type { EntityRecord } from '../world/registry';
import { getSector, type SectorId } from '../world/sectors';
import { createEffects, type Effects } from './effects';
import { createGauge, type Gauge, type GaugeHost } from './gauges';
import { buildShipping } from './layers/shipping';
import { createChannelLayer } from './layers/channels';
import type { ChannelActivity, ProposalSummary } from '../world/activation';
import { WorldGraph, type NodeKind, type WorldNode } from './graph';
import { buildDistrict, type DistrictNode } from './layers/district';
import { buildEntityNode, type EntityNode } from './layers/entity';
import { LANDMARKS } from './landmarks';
import { buildIslandTerrain, ISLAND_TOP_Y } from './layers/islandTerrain';
import { labelObject, labelVisibility } from './layers/labels';
import { disposeObject, makeNode, tagPath } from './layers/nodeBase';
import { createStage, type ColorMode, type WorldExtent } from './scene';

export { supportsWebGL } from './support';
export type { ColorMode } from './scene';

export interface WorldBuildInput {
  entities: EntityRecord[];
  districts: Record<RegionId, SectorId[]>;
  mentions: Record<string, number>;
}

/** 點擊命中的對象：節點（路徑）、精選管道或提議管道。 */
export type PickHit = { kind: 'node'; path: string } | { kind: 'channel'; id: string } | { kind: 'proposal'; id: string };

/** 網絡模式下，島嶼與建築的不透明度。 */
export const NETWORK_FADE = 0.35;

export interface WorldView {
  build(input: WorldBuildInput): void;
  setWeekFocus(paths: string[]): void;
  setParams(p: WorldParams): void;
  tweenTo(p: WorldParams, ms: number): Promise<void>;
  flyTo(path: string, ms?: number): Promise<void>;
  resetCamera(ms?: number): Promise<void>;
  focusAsiaPacific(ms?: number): Promise<void>;
  cameraTarget(): [number, number];
  /** 節點地面位置在螢幕上的座標（供測試與標籤定位）；不在畫面內時回傳 null。 */
  screenOf(path: string): { x: number; y: number } | null;
  highlight(paths: string[]): void;
  setColorMode(m: ColorMode): void;
  setLowPower(on: boolean): void;
  setTimeScale(s: number): void;
  setInsets(right: number, bottom: number): void;
  onPick(cb: (hit: PickHit | null) => void): void;
  /** 本週各管道活躍度與待審提議（提議以灰色虛線呈現）。 */
  setChannelActivity(a: Record<string, ChannelActivity>, proposals: ProposalSummary[]): void;
  /** 網絡模式：所有管道提亮並顯示名稱，島嶼與建築變淡。 */
  setNetworkMode(on: boolean): void;
  /** 管線中點的螢幕座標（供測試）；找不到或不在畫面內時回傳 null。 */
  channelScreenPoint(id: string): { x: number; y: number } | null;
  onHover(cb: (path: string | null, screen: { x: number; y: number }) => void): void;
  readonly graph: WorldGraph;
  readonly effects: Effects;
  dispose(): void;
}

/** 全圖說明（常駐於畫面角落）。 */
export const LEGEND_TEXT = '島嶼大小約與 GDP 成正比（約略值）；為避免重疊，相鄰島嶼位置略有偏移。';

/** 鏡頭縮放（相對全圖）依節點層級。 */
export const ZOOM_BY_KIND: Record<NodeKind, number> = { region: 1.6, district: 2.4, entity: 3.2 };
const ASIA_PACIFIC_ZOOM = 2.2;

export function worldExtent(seaPoints: [number, number][] = []): WorldExtent {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const l of layoutIslands().values()) {
    minX = Math.min(minX, l.center[0] - l.radius); maxX = Math.max(maxX, l.center[0] + l.radius);
    minZ = Math.min(minZ, l.center[1] - l.radius); maxZ = Math.max(maxZ, l.center[1] + l.radius);
  }
  for (const [x, z] of seaPoints) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, halfW: (maxX - minX) / 2, halfD: (maxZ - minZ) / 2 };
}

function regionNode(id: RegionId, layout: IslandLayout): WorldNode {
  const group = new THREE.Group();
  group.add(buildIslandTerrain(id, layout, id === 'intl'));
  const label = labelObject(getRegion(id).name, 'island-label');
  label.position.set(layout.center[0], 0.6, layout.center[1] + layout.radius + 0.6);
  group.add(label);
  group.userData.radius = layout.radius;
  tagPath(group, id);
  return makeNode({
    path: id, kind: 'region', object: group, ringRadius: layout.radius + 0.4, ringY: 0.35, ringCenter: layout.center,
    anchor: () => new THREE.Vector3(layout.center[0], ISLAND_TOP_Y + 1.5, layout.center[1]),
  });
}

/** 虛擬節點（海域與航道區塊）：沒有地形，只提供落點。 */
function virtualNode(path: string, kind: NodeKind, at: THREE.Vector3): WorldNode {
  const group = new THREE.Group();
  group.position.copy(at);
  return makeNode({ path, kind, object: group, ringRadius: 0.01, ringY: 0, anchor: () => at.clone().setY(1.2) });
}

export function createWorld(canvas: HTMLCanvasElement, seaPoints: [number, number][] = []): WorldView {
  const overlay = canvas.parentElement ?? document.body;
  const extent = worldExtent(seaPoints);
  const stage = createStage(canvas, overlay, extent);
  const { scene, camera } = stage;
  const graph = new WorldGraph();
  const root = new THREE.Group();
  scene.add(root);

  // L0：地區島（固定，不隨資料重建）
  const layouts = layoutIslands();
  for (const [id, layout] of layouts) {
    const n = regionNode(id, layout);
    graph.add(n);
    root.add(n.object);
  }

  let built: WorldBuildInput | null = null;
  let weekFocus = new Set<string>();
  let colorMode: ColorMode = 'tw';
  let current: WorldParams | null = null;
  let focus: string | null = null;
  const highlighted = new Set<string>();
  const dimmed = new Set<string>();

  // L3：指標儀表依綁定表掛在節點上；節點重建時重新掛載。
  const gauges = new Map<string, { gauge: Gauge; node: WorldNode }>();
  function attachGauges() {
    for (const b of INDICATOR_BINDINGS) {
      const node = graph.get(b.path);
      const cur = gauges.get(b.path);
      if (cur && cur.node === node) continue;
      cur?.gauge.dispose();
      gauges.delete(b.path);
      if (!node) continue;
      const gauge = createGauge(b.gauge);
      gauge.attach(node as GaugeHost);
      gauges.set(b.path, { gauge, node });
    }
    if (current) apply(current);
  }

  let shipping = buildShipping(graph, extent.halfW * 2);
  function rebuildShipping() {
    shipping.group.removeFromParent();
    shipping = buildShipping(graph, extent.halfW * 2);
    root.add(shipping.group);
    if (current) shipping.setCount(current.tankers);
  }

  function applyStates() {
    for (const n of graph.all()) n.setState(highlighted.has(n.path) ? 'highlight' : dimmed.has(n.path) ? 'dim' : 'normal');
  }

  /** 各區塊目前顯示的實體（用來判斷 setWeekFocus 後哪些區塊需要重建）。 */
  const shownEntities = new Map<string, string>();
  const CORNERS: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const LANE_PLOT = 1.6;

  /** L2：區塊角落最多 4 棟實體建築（本週提到的優先）。 */
  function buildEntities(d: DistrictNode, input: WorldBuildInput, onlyIfChanged = false): boolean {
    const [region, sector] = d.path.split('/') as [RegionId, SectorId];
    const candidates = input.entities
      .filter((e) => e.region === region && e.sector === sector)
      .map((e) => ({ id: e.id, mentioned: input.mentions[`${d.path}/${e.id}`] ?? 0 }));
    const inWeek = new Set([...weekFocus].filter((p) => p.startsWith(`${d.path}/`)).map((p) => p.split('/')[2]!));
    // 掛有指標儀表的實體（黃金、比特幣）必須畫出來，否則儀表會消失。
    const pinned = new Set(INDICATOR_BINDINGS.map((b) => b.path).filter((p) => p.startsWith(`${d.path}/`)).map((p) => p.split('/')[2]!));
    const visible = pickVisibleEntities(candidates, inWeek, 4, pinned);
    if (onlyIfChanged && shownEntities.get(d.path) === visible.join(',')) return false;
    shownEntities.set(d.path, visible.join(','));
    for (const c of graph.children(d.path)) graph.removeSubtree(c.path);
    const center = d.object.getWorldPosition(new THREE.Vector3());
    visible.forEach((id, i) => {
      const e = input.entities.find((x) => x.id === id)!;
      const [sx, sz] = CORNERS[i]!;
      const at = new THREE.Vector3(center.x + sx * d.plot * 0.33, center.y + 0.12, center.z + sz * d.plot * 0.33);
      const n = buildEntityNode(`${d.path}/${id}`, e, at, d.plot);
      graph.add(n);
      root.add(n.object);
    });
    return true;
  }

  /** L1：依區塊清單重建部門區塊與主建築，再交給 L2 放實體。 */
  function buildDistricts(input: WorldBuildInput) {
    for (const [id, layout] of layouts) {
      const sectors = input.districts[id] ?? [];
      const { offsets, plot } = districtSlots(layout.radius, sectors.length);
      sectors.forEach((sector, i) => {
        const path = `${id}/${sector}`;
        graph.removeSubtree(path);
        const at: [number, number] = [layout.center[0] + offsets[i]![0], layout.center[1] + offsets[i]![1]];
        const landmark = LANDMARKS[getSector(sector).archetype]({ plot: plot * 0.5 });
        const d: DistrictNode = buildDistrict(path, sector, at, plot, landmark);
        graph.add(d);
        root.add(d.object);
        buildEntities(d, input);
      });
    }
    // 海域：沒有島，航道實體各自位於真實經緯度。
    graph.removeSubtree('seas');
    const lanes = input.entities.filter((e) => e.region === 'seas' && e.geo);
    const pts = lanes.map((e) => placeAtSea(project(e.geo!.lat, e.geo!.lon)));
    const c = pts.length ? pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]) : [0, 0];
    for (const n of [virtualNode('seas', 'region', new THREE.Vector3(c[0], 0, c[1])), virtualNode('seas/shipping-lane', 'district', new THREE.Vector3(c[0], 0, c[1]))]) {
      graph.add(n);
      root.add(n.object);
    }
    // 航道不受每區 4 棟上限，全部放在真實經緯度。
    lanes.forEach((e, i) => {
      const n = buildEntityNode(`seas/shipping-lane/${e.id}`, e, new THREE.Vector3(pts[i]![0], 0, pts[i]![1]), LANE_PLOT / 0.45);
      graph.add(n);
      root.add(n.object);
    });
  }

  // L5：依縮放顯示部門名、實體建築與實體名；航道名稱永遠顯示。
  let lodZoom = -1;
  function applyLod(force = false) {
    const z = camera.zoom;
    if (!force && Math.abs(z - lodZoom) < 1e-3) return;
    lodZoom = z;
    for (const n of graph.all()) {
      if (n.kind === 'district' && !n.path.startsWith('seas')) (n as DistrictNode).label.visible = labelVisibility('district', z);
      if (n.kind === 'entity') {
        const lane = n.path.startsWith('seas/');
        const e = n as EntityNode;
        e.object.visible = lane || labelVisibility('entity', z);
        e.label.visible = lane || labelVisibility('entity-name', z);
      }
    }
  }

  const legend = document.createElement('div');
  legend.className = 'world-legend';
  legend.textContent = LEGEND_TEXT;
  overlay.append(legend);

  // L4：常駐傳導網絡（管線）。端點依節點位置，所以區塊或實體重建後要重建。
  const channels = createChannelLayer(graph, { lowPower: () => stage.lowPower, zoom: () => camera.zoom });
  root.add(channels.group);
  let networkMode = false;
  const faded = new Map<THREE.Material, { transparent: boolean; opacity: number; depthWrite: boolean }>();
  /** 網絡模式下把世界的 MeshStandardMaterial 調淡；關閉時恢復。 */
  function applyFade() {
    for (const [m, o] of faded) Object.assign(m, o);
    faded.clear();
    if (!networkMode) return;
    root.traverse((o) => {
      if (o === channels.group || o.parent === channels.group) return;
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m || !m.isMeshStandardMaterial || faded.has(m)) return;
      faded.set(m, { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite });
      m.transparent = true;
      m.opacity = Math.min(m.opacity, NETWORK_FADE);
      m.depthWrite = false;
      m.needsUpdate = true;
    });
  }
  function rebuildChannels() {
    channels.rebuild();
    applyFade();
  }

  stage.onFrame((dt, t) => {
    applyLod();
    channels.update(dt, t);
    for (const n of graph.all()) n.update(dt, t);
    for (const { gauge } of gauges.values()) gauge.update(dt, t);
    shipping.update(dt, t);
  });

  // 拾取：沿父節點往上找第一個標了 path 的物件，因此回傳的是最深一層。
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pickAt(clientX: number, clientY: number): PickHit | null {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    for (const hit of raycaster.intersectObjects(root.children, true)) {
      let shown = true;
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (!o.visible) shown = false;
      if (!shown) continue;
      const ud = hit.object.userData;
      if (typeof ud.channel === 'string' || typeof ud.proposal === 'string') {
        if (!ud.pickable) continue;
        return typeof ud.channel === 'string' ? { kind: 'channel', id: ud.channel as string } : { kind: 'proposal', id: ud.proposal as string };
      }
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
        if (typeof o.userData.path === 'string') return { kind: 'node', path: o.userData.path as string };
      }
    }
    return null;
  }

  const pickCbs: ((p: PickHit | null) => void)[] = [];
  const hoverCbs: ((p: string | null, s: { x: number; y: number }) => void)[] = [];
  let down: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
  const onUp = (e: PointerEvent) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
      const p = pickAt(e.clientX, e.clientY);
      for (const cb of pickCbs) cb(p);
    }
    down = null;
  };
  let hoverPending = false;
  let lastHover: string | null = null;
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || hoverPending) return;
    hoverPending = true;
    requestAnimationFrame(() => {
      hoverPending = false;
      const hit = pickAt(e.clientX, e.clientY);
      const p = hit?.kind === 'node' ? hit.path : null;
      canvas.style.cursor = hit ? 'pointer' : '';
      if (p !== lastHover || p) for (const cb of hoverCbs) cb(p, { x: e.clientX, y: e.clientY });
      lastHover = p;
    });
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointermove', onMove);

  const effects = createEffects({
    stage, graph, colorMode: () => colorMode, focus: () => focus,
    channelCurve: (id) => channels.curve(id),
    flashChannel: (id, ms) => channels.flash(id, ms),
  });

  function apply(p: WorldParams) {
    current = p;
    stage.setWeather(p.weather);
    shipping.setCount(p.tankers);
    dimmed.clear();
    for (const [path, r] of Object.entries(p.gauges)) {
      gauges.get(path)?.gauge.set(r, colorMode);
      if (r.status !== 'fresh') dimmed.add(path);
    }
    applyStates();
  }

  return {
    graph,
    effects,
    build(input) {
      built = input;
      buildDistricts(input);
      attachGauges();
      rebuildShipping();
      rebuildChannels();
      applyStates();
      applyLod(true);
    },
    setWeekFocus(paths) {
      weekFocus = new Set(paths);
      if (!built) return;
      // 只重建「可見實體有變動」的區塊。
      let changed = false;
      for (const n of graph.all()) {
        if (n.kind !== 'district' || n.path.startsWith('seas')) continue;
        changed = buildEntities(n as DistrictNode, built, true) || changed;
      }
      if (changed) {
        attachGauges();
        rebuildChannels();
        applyStates();
        applyLod(true);
      }
    },
    setParams: apply,
    tweenTo(p, ms) {
      const from = current;
      if (!from) {
        apply(p);
        return Promise.resolve();
      }
      return stage.animate(ms, (k) => apply(lerpWorldParams(from, p, k)));
    },
    flyTo(path, ms = 1200) {
      const n = graph.nearest(path);
      if (!n) return Promise.resolve();
      focus = n.path;
      const at = n.object.getWorldPosition(new THREE.Vector3());
      const target = n.kind === 'region' ? n.anchor() : at;
      return stage.lookAt(target.x, target.z, ZOOM_BY_KIND[n.kind], ms);
    },
    resetCamera(ms = 1200) {
      focus = null;
      return stage.lookAt(stage.home.x, stage.home.z, stage.home.zoom, ms);
    },
    focusAsiaPacific(ms = 1200) {
      const tw = layouts.get('tw')!;
      return stage.lookAt(tw.center[0], tw.center[1], ASIA_PACIFIC_ZOOM, ms);
    },
    cameraTarget() {
      return [stage.controls.target.x, stage.controls.target.z];
    },
    screenOf(path) {
      const n = graph.get(path);
      if (!n) return null;
      const v = n.kind === 'region' ? n.anchor().setY(ISLAND_TOP_Y) : n.object.getWorldPosition(new THREE.Vector3()).setY(ISLAND_TOP_Y + 0.15);
      // 相機矩陣通常在渲染時才更新；剛 lookAt 完還沒渲染時要先手動更新，否則會投影到舊位置。
      camera.updateMatrixWorld();
      v.project(camera);
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    },
    highlight(paths) {
      highlighted.clear();
      paths.forEach((p) => {
        const n = graph.nearest(p);
        if (n) highlighted.add(n.path);
      });
      applyStates();
    },
    setColorMode(m) {
      colorMode = m;
      if (current) apply(current);
    },
    setLowPower: stage.setLowPower,
    setTimeScale: stage.setTimeScale,
    setInsets: stage.setInsets,
    onPick: (cb) => void pickCbs.push(cb),
    setChannelActivity(a, proposals) {
      channels.setActivity(a, proposals);
      applyFade();
    },
    setNetworkMode(on) {
      networkMode = on;
      channels.setNetwork(on);
      applyFade();
    },
    channelScreenPoint(id) {
      const c = channels.curve(id);
      if (!c) return null;
      const v = c.getPoint(0.5);
      camera.updateMatrixWorld();
      v.project(camera);
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    },
    onHover: (cb) => void hoverCbs.push(cb),
    dispose() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointermove', onMove);
      for (const n of graph.all()) disposeObject(n.object);
      channels.dispose();
      legend.remove();
      stage.dispose();
    },
  };
}
