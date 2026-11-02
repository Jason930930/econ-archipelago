import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ENTITIES, getEntity, type EntityDef, type EntityId, type IslandId } from '../world/entities';
import type { Light, VisualParams } from '../world/visualParams';
import { mulberry32, type ColorMode } from './scene';

export const ISLAND_NAMES: Record<Exclude<IslandId, 'sea'>, string> = {
  us: '美國島', tw: '台灣島', kr: '韓國島', me: '中東島', eu: '歐洲島', jp: '日本島', cn: '中國島',
  gold: '金庫礁', crypto: '加密小島', port: '港口',
};

const ISLAND_SEED: Record<string, number> = { us: 11, tw: 23, kr: 31, me: 41, eu: 53, jp: 61, cn: 71, gold: 83, crypto: 97, port: 101 };

export const UP_DOWN: Record<ColorMode, { up: string; down: string }> = {
  tw: { up: '#e5484d', down: '#2fa36b' },
  intl: { up: '#2fa36b', down: '#e5484d' },
};
const FLAT = '#f2d27a';

export interface Landmark {
  id: EntityId;
  def: EntityDef;
  group: THREE.Group;
  /** 地標頂端（世界座標 y），供標籤與旗幟定位。 */
  top: number;
  apply(p: VisualParams, mode: ColorMode): void;
  setDim(dim: boolean): void;
  update(dt: number, t: number): void;
}

function std(color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, flatShading: true, ...extra });
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** 依島上實體位置決定島的中心與半徑，產生不規則低多邊形島嶼。 */
export function buildIslands(scene: THREE.Scene): void {
  const groups = new Map<IslandId, EntityDef[]>();
  for (const e of ENTITIES) {
    if (e.island === 'sea') continue;
    groups.set(e.island, [...(groups.get(e.island) ?? []), e]);
  }
  const top = std('#7fbf6a');
  const side = std('#d8c08c');
  for (const [island, ents] of groups) {
    const cx = ents.reduce((s, e) => s + e.position[0], 0) / ents.length;
    const cz = ents.reduce((s, e) => s + e.position[1], 0) / ents.length;
    const spread = Math.max(...ents.map((e) => Math.hypot(e.position[0] - cx, e.position[1] - cz)));
    const radius = spread + (island === 'gold' || island === 'crypto' || island === 'port' ? 1.3 : 1.9);
    const rand = mulberry32(ISLAND_SEED[island] ?? 1);
    const shape = new THREE.Shape();
    const N = 22;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = radius * (0.86 + rand() * 0.24);
      const x = Math.cos(a) * r * (island === 'us' ? 1.15 : 1);
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: true, bevelSize: 0.35, bevelThickness: 0.25, bevelSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, [top, side]);
    m.position.set(cx, -0.55, cz);
    m.receiveShadow = true;
    m.castShadow = true;
    scene.add(m);

    const name = ISLAND_NAMES[island as Exclude<IslandId, 'sea'>];
    const div = document.createElement('div');
    div.className = 'island-label';
    div.textContent = name;
    const label = new CSS2DObject(div);
    label.position.set(cx, 0.4, cz + radius + 0.4);
    scene.add(label);
  }
}

function lightColor(l: Light, mode: ColorMode): THREE.Color {
  const c = UP_DOWN[mode];
  return new THREE.Color(l.trend > 0 ? c.up : l.trend < 0 ? c.down : FLAT);
}

/** 記住每個材質的原色，變暗時把飽和度降一半。 */
function dimmer(group: THREE.Group) {
  const mats: { mat: THREE.MeshStandardMaterial; base: THREE.Color }[] = [];
  group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && m.isMeshStandardMaterial && !mats.some((x) => x.mat === m)) mats.push({ mat: m, base: m.color.clone() });
  });
  return (dim: boolean) => {
    for (const { mat, base } of mats) {
      const hsl = { h: 0, s: 0, l: 0 };
      base.getHSL(hsl);
      mat.color.setHSL(hsl.h, dim ? hsl.s * 0.5 : hsl.s, dim ? hsl.l * 0.85 : hsl.l);
    }
  };
}

function bank(def: EntityDef): Landmark {
  const g = new THREE.Group();
  const stone = std('#e9e4d8');
  g.add(mesh(new THREE.BoxGeometry(1.5, 0.22, 1.1), stone, 0, 0.11, 0));
  for (const x of [-0.55, -0.18, 0.18, 0.55]) g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6), stone, x, 0.62, 0.38));
  g.add(mesh(new THREE.BoxGeometry(1.4, 0.8, 0.6), std('#d7d0c0'), 0, 0.62, -0.1));
  const roof = mesh(new THREE.ConeGeometry(0.95, 0.45, 4), std('#b9b1a0'), 0, 1.25, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.75);
  g.add(roof);
  let top = 1.5;

  let beam: THREE.Mesh | null = null;
  let flag: THREE.Mesh | null = null;
  if (def.id === 'us-fed') {
    beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.24, 1, 10, 1, true).translate(0, 0.5, 0),
      new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 1.45;
    g.add(beam);
    top = 4;
  }
  if (def.id === 'tw-cbc') {
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5), std('#888'), 0.85, 1.2, 0.3));
    flag = mesh(new THREE.BoxGeometry(0.5, 0.3, 0.02), std('#e5484d'), 1.1, 1.5, 0.3);
    g.add(flag);
    top = 2.5;
  }
  const setDim = dimmer(g);
  return {
    id: def.id, def, group: g, top, setDim,
    apply(p) {
      if (beam) beam.scale.y = 0.6 + 4.5 * p.fedBeam;
      if (flag) flag.position.y = 0.6 + 1.7 * p.cbcFlag;
    },
    update(_dt, t) {
      if (beam) (beam.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 2.2) * 0.12;
      if (flag) flag.rotation.y = Math.sin(t * 3) * 0.25;
    },
  };
}

function exchange(def: EntityDef): Landmark {
  const g = new THREE.Group();
  const body = std('#5d6b7a');
  const windows = std('#222', { emissive: new THREE.Color(FLAT), emissiveIntensity: 0.6 });
  g.add(mesh(new THREE.BoxGeometry(1.1, 2.2, 1.1), body, 0, 1.1, 0));
  g.add(mesh(new THREE.BoxGeometry(0.75, 0.6, 0.75), body, 0, 2.5, 0));
  for (let i = 0; i < 5; i++) {
    g.add(mesh(new THREE.BoxGeometry(1.12, 0.14, 1.12), windows, 0, 0.35 + i * 0.38, 0));
  }
  const sign = mesh(new THREE.BoxGeometry(0.9, 0.3, 0.05), windows, 0, 2.4, 0.4);
  g.add(sign);
  const setDim = dimmer(g);
  let pulse = 0.6;
  return {
    id: def.id, def, group: g, top: 3.1, setDim,
    apply(p, mode) {
      const l = def.id === 'us-wallst' ? p.wallst : p.twse;
      windows.emissive.copy(lightColor(l, mode));
      pulse = 0.35 + 1.4 * l.intensity;
    },
    update(_dt, t) {
      windows.emissiveIntensity = pulse * (0.85 + Math.sin(t * 3) * 0.15);
    },
  };
}

function bonds(def: EntityDef): Landmark {
  const g = new THREE.Group();
  const floors: THREE.Mesh[] = [];
  const mats = [std('#c9d3dd'), std('#9fb0c2')];
  for (let i = 0; i < 12; i++) {
    const f = mesh(new THREE.BoxGeometry(0.9 - i * 0.02, 0.24, 0.9 - i * 0.02), mats[i % 2]!, 0, 0.12 + i * 0.25, 0);
    floors.push(f);
    g.add(f);
  }
  const cap = mesh(new THREE.ConeGeometry(0.35, 0.4, 4), std('#7d8fa3'), 0, 0, 0);
  g.add(cap);
  const setDim = dimmer(g);
  const lm: Landmark = {
    id: def.id, def, group: g, top: 3.4, setDim,
    apply(p) {
      floors.forEach((f, i) => (f.visible = i < p.bondFloors));
      cap.position.y = p.bondFloors * 0.25 + 0.2;
      lm.top = cap.position.y + 0.4;
    },
    update() {},
  };
  return lm;
}

function tech(def: EntityDef): Landmark {
  const g = new THREE.Group();
  const glass = std('#7cc6e8', { metalness: 0.3, roughness: 0.3 });
  g.add(mesh(new THREE.BoxGeometry(0.7, 1.6, 0.7), glass, -0.35, 0.8, -0.2));
  g.add(mesh(new THREE.BoxGeometry(0.6, 1.1, 0.6), glass, 0.45, 0.55, 0.15));
  const dome = mesh(new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std('#e7f3f9'), 0.1, 0, 0.6);
  g.add(dome);
  const chip = mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), std('#2b2b2b', { emissive: new THREE.Color('#5be3ff'), emissiveIntensity: 0.8 }), -0.35, 1.65, -0.2);
  g.add(chip);
  const setDim = dimmer(g);
  return { id: def.id, def, group: g, top: 2, setDim, apply() {}, update(_dt, t) { chip.rotation.y = t * 0.8; } };
}

function factory(def: EntityDef, roofColor: string, stacks: number): Landmark {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.5, 0.7, 1), std('#d9d4cc'), 0, 0.35, 0));
  for (let i = 0; i < 3; i++) {
    const r = mesh(new THREE.BoxGeometry(0.5, 0.25, 1), std(roofColor), -0.5 + i * 0.5, 0.8, 0);
    r.rotation.z = 0.35;
    g.add(r);
  }
  const smoke: THREE.Mesh[] = [];
  const smokeMat = new THREE.MeshStandardMaterial({ color: '#e9eef2', transparent: true, opacity: 0.7, flatShading: true, depthWrite: false });
  for (let s = 0; s < stacks; s++) {
    const x = 0.5 - s * 0.35;
    g.add(mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 6), std('#8c8c8c'), x, 1.05, -0.3));
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), smokeMat);
      puff.position.set(x, 1.7 + k * 0.35, -0.3);
      puff.userData.phase = k / 3;
      puff.userData.x = x;
      smoke.push(puff);
      g.add(puff);
    }
  }
  const setDim = dimmer(g);
  return {
    id: def.id, def, group: g, top: 2.3, setDim, apply() {},
    update(_dt, t) {
      for (const p of smoke) {
        const k = (t * 0.35 + (p.userData.phase as number)) % 1;
        p.position.y = 1.65 + k * 1.1;
        p.position.x = (p.userData.x as number) + k * 0.3;
        p.scale.setScalar(0.6 + k * 1.2);
        (p.material as THREE.MeshStandardMaterial).opacity = 0.7 * (1 - k);
      }
    },
  };
}

function memory(def: EntityDef): Landmark {
  const lm = factory(def, '#7b5cc4', 1);
  const chip = mesh(new THREE.BoxGeometry(0.8, 0.08, 0.5), std('#1d1d2b', { emissive: new THREE.Color('#9d7bff'), emissiveIntensity: 0.7 }), 0, 0.75, 0.62);
  lm.group.add(chip);
  return lm;
}

function oil(def: EntityDef): Landmark {
  const g = new THREE.Group();
  const steel = std('#5b5b5b');
  for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]] as const) {
    const leg = mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.9, 4), steel, x * 0.6, 0.95, z * 0.6);
    leg.rotation.set(z * 0.35, 0, -x * 0.35);
    g.add(leg);
  }
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), steel, 0, 1.85, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 8), std('#c9b28a'), 0.85, 0.25, 0.4));
  g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 8), std('#c9b28a'), 0.85, 0.25, -0.4));
  const flameMat = new THREE.MeshStandardMaterial({ color: '#ff8a1f', emissive: new THREE.Color('#ff6a00'), emissiveIntensity: 1.6, transparent: true, opacity: 0.92, flatShading: true });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1, 6).translate(0, 0.5, 0), flameMat);
  flame.position.set(0, 1.9, 0);
  g.add(flame);
  const glow = new THREE.PointLight('#ff7a1a', 2, 6, 2);
  glow.position.set(0, 2.4, 0);
  g.add(glow);
  let base = 1;
  const setDim = dimmer(g);
  return {
    id: def.id, def, group: g, top: 3.4, setDim,
    apply(p) {
      base = 0.3 + 1.8 * p.oilFlame;
      glow.intensity = 1 + 4 * p.oilFlame;
    },
    update(_dt, t) {
      const f = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
      flame.scale.set(0.8 + base * 0.3, base * f, 0.8 + base * 0.3);
    },
  };
}

function vault(def: EntityDef): Landmark {
  const g = new THREE.Group();
  const gold = std('#e3b23c', { metalness: 0.6, roughness: 0.35, emissive: new THREE.Color('#7a5200'), emissiveIntensity: 0.3 });
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(0.8 - i * 0.2, 0.3, 0.5 - i * 0.1), gold, 0, 0.15 + i * 0.3, 0));
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 10),
    new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.2, depthWrite: false }),
  );
  halo.position.y = 0.5;
  g.add(halo);
  let level = 0.5;
  const setDim = dimmer(g);
  return {
    id: def.id, def, group: g, top: 1.6, setDim,
    apply(p) { level = p.goldGlow; },
    update(_dt, t) {
      halo.scale.setScalar(0.7 + level * 0.8 + Math.sin(t * 2) * 0.05);
      (halo.material as THREE.MeshBasicMaterial).opacity = 0.08 + level * 0.3;
    },
  };
}

function crypto(def: EntityDef): Landmark {
  const g = new THREE.Group();
  const mat = std('#f7931a', { emissive: new THREE.Color('#f7931a'), emissiveIntensity: 0.4, metalness: 0.4 });
  const gem = mesh(new THREE.OctahedronGeometry(0.55, 0), mat, 0, 1.4, 0);
  g.add(gem);
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.3, 6), std('#4a4a5a'), 0, 0.15, 0));
  let flicker = 0;
  const setDim = dimmer(g);
  return {
    id: def.id, def, group: g, top: 2.2, setDim,
    apply(p) { flicker = p.cryptoFlicker; },
    update(_dt, t) {
      gem.rotation.y = t * 1.2;
      gem.position.y = 1.4 + Math.sin(t * 1.6) * 0.15;
      mat.emissiveIntensity = 0.35 + flicker * (0.5 + 0.5 * Math.sin(t * 18)) * 1.2;
    },
  };
}

function seaMark(def: EntityDef): Landmark {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.35, 8), std('#e5484d'), 0, 0.05, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 5), std('#eee'), 0, 0.6, 0));
  const lampMat = std('#fff3a0', { emissive: new THREE.Color('#fff3a0'), emissiveIntensity: 1 });
  g.add(mesh(new THREE.SphereGeometry(0.12, 8, 6), lampMat, 0, 1.1, 0));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
  ring.position.y = 0.02;
  g.add(ring);
  const setDim = dimmer(g);
  return {
    id: def.id, def, group: g, top: 1.4, setDim, apply() {},
    update(_dt, t) {
      g.position.y = Math.sin(t * 1.5 + def.position[0]) * 0.06;
      lampMat.emissiveIntensity = 0.5 + (Math.sin(t * 4) > 0 ? 1 : 0);
      ring.scale.setScalar(1 + ((t * 0.5) % 1) * 0.6);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - ((t * 0.5) % 1));
    },
  };
}

function board(def: EntityDef): Landmark {
  const g = new THREE.Group();
  const wood = std('#9b6b43');
  g.add(mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), wood, -0.5, 0.55, 0));
  g.add(mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), wood, 0.5, 0.55, 0));
  g.add(mesh(new THREE.BoxGeometry(1.25, 0.7, 0.06), std('#f3ead7'), 0, 0.9, 0.02));
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(0.3, 0.22, 0.02), std(['#ffd166', '#a0e7e5', '#ffadad'][i]!), -0.35 + i * 0.35, 0.9, 0.06));
  const setDim = dimmer(g);
  return { id: def.id, def, group: g, top: 1.5, setDim, apply() {}, update() {} };
}

export function buildLandmark(def: EntityDef): Landmark {
  let lm: Landmark;
  switch (def.kind) {
    case 'bank': lm = bank(def); break;
    case 'exchange': lm = exchange(def); break;
    case 'bonds': lm = bonds(def); break;
    case 'tech': lm = tech(def); break;
    case 'fab': lm = factory(def, '#4f8fd6', 2); break;
    case 'memory': lm = memory(def); break;
    case 'industry': lm = factory(def, '#c0583c', 3); break;
    case 'oil': lm = oil(def); break;
    case 'vault': lm = vault(def); break;
    case 'crypto': lm = crypto(def); break;
    case 'sea': lm = seaMark(def); break;
    case 'board': lm = board(def); break;
  }
  lm.group.position.set(def.position[0], 0.15, def.position[1]);
  lm.group.userData.entityId = def.id;
  lm.group.traverse((o) => (o.userData.entityId = def.id));
  return lm;
}

/** 油輪航線：中東 → 荷莫茲 → 台灣南方 → 太平洋 → 美國。可見數量 = tankers。 */
export function buildShipping(scene: THREE.Scene) {
  const p = (id: EntityId, dx = 0, dz = 0) => new THREE.Vector3(getEntity(id).position[0] + dx, 0.05, getEntity(id).position[1] + dz);
  const curve = new THREE.CatmullRomCurve3([
    p('me-oil', 1.8, -0.8), p('sea-hormuz'), new THREE.Vector3(-7, 0.05, 8), new THREE.Vector3(-1, 0.05, 9),
    p('sea-pacific'), new THREE.Vector3(10, 0.05, 4.5),
  ]);
  const lane = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curve.getPoints(120)),
    new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 0.4, gapSize: 0.35, transparent: true, opacity: 0.45 }),
  );
  lane.computeLineDistances();
  scene.add(lane);

  const ships: THREE.Group[] = [];
  const hull = std('#2f3b4a');
  const deck = std('#e5484d');
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Group();
    s.add(mesh(new THREE.BoxGeometry(0.9, 0.22, 0.32), hull));
    s.add(mesh(new THREE.BoxGeometry(0.22, 0.25, 0.26), deck, -0.28, 0.22, 0));
    scene.add(s);
    ships.push(s);
  }
  let count = 5;
  return {
    setCount(n: number) { count = Math.max(0, Math.min(8, n)); },
    update(_dt: number, t: number) {
      ships.forEach((s, i) => {
        s.visible = i < count;
        if (!s.visible) return;
        const u = (t * 0.018 + i / Math.max(1, count)) % 1;
        const pos = curve.getPointAt(u);
        const ahead = curve.getPointAt(Math.min(1, u + 0.01));
        s.position.set(pos.x, 0.05 + Math.sin(t * 2 + i) * 0.03, pos.z);
        s.lookAt(ahead.x, s.position.y, ahead.z);
        s.rotateY(-Math.PI / 2);
      });
    },
  };
}
