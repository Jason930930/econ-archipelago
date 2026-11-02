import * as THREE from 'three';

/** 地標原型：以 plot=1.6 為基準設計，回傳前依 plot 等比縮放。 */
export interface Landmark {
  group: THREE.Group;
  /** 頂端高度（已含縮放）。 */
  top: number;
  /** 具名部位，供 L3 儀表掛載（例如 roof、windows、floors、flameTop、pole、gem）。 */
  parts: Record<string, THREE.Object3D>;
  update?(dt: number, t: number): void;
}

export type LandmarkBuilder = (opts: { plot: number }) => Landmark;

export function std(color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, flatShading: true, ...extra });
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function anchorAt(x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  return o;
}

/** 以 plot/1.6 等比縮放，並把 top 換算成縮放後高度。 */
export function finish(group: THREE.Group, top: number, plot: number, parts: Record<string, THREE.Object3D>, update?: Landmark['update']): Landmark {
  const s = plot / 1.6;
  group.scale.setScalar(s);
  for (const p of Object.values(parts)) if (!p.parent) group.add(p);
  return { group, top: top * s, parts, update };
}

/** 工廠：廠房、鋸齒屋頂、煙囪與冒煙（半導體、記憶體、工業共用）。 */
export function factory(plot: number, roofColor: string, stacks: number, extra?: (g: THREE.Group) => void): Landmark {
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
      puff.userData.phase = k / 3;
      puff.userData.x = x;
      smoke.push(puff);
      g.add(puff);
    }
  }
  extra?.(g);
  return finish(g, 2.3, plot, { roof: anchorAt(0, 1.6, 0) }, (_dt, t) => {
    for (const p of smoke) {
      const k = (t * 0.35 + (p.userData.phase as number)) % 1;
      p.position.set((p.userData.x as number) + k * 0.3, 1.65 + k * 1.1, -0.3);
      p.scale.setScalar(0.6 + k * 1.2);
      (p.material as THREE.MeshStandardMaterial).opacity = 0.7 * (1 - k);
    }
  });
}
