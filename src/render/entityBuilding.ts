import * as THREE from 'three';
import type { Archetype } from '../world/sectors';
import { fnv1a } from './colors';
import { LANDMARKS, type Landmark } from './landmarks';
import { mesh, std } from './landmarks/shared';

export interface EntityLook {
  heightScale: number;
  hueShift: number;
  roof: 0 | 1 | 2;
}

/** 由 id 決定外觀（FNV-1a）：同一個 id 每次都一樣。 */
export function entityLook(id: string): EntityLook {
  const h = fnv1a(id);
  const a = (h & 0xffff) / 0xffff;
  const b = ((h >>> 16) & 0xff) / 0xff;
  return { heightScale: 0.7 + a * 0.7, hueShift: -0.08 + b * 0.16, roof: ((h >>> 24) % 3) as 0 | 1 | 2 };
}

/** 實體建築：部門原型縮成 0.45，再套用 entityLook 的高度、色相與屋頂樣式。 */
export function buildEntityBuilding(archetype: Archetype, id: string, plot: number): Landmark {
  const look = entityLook(id);
  const lm = LANDMARKS[archetype]({ plot: plot * 0.45 });
  lm.group.scale.y *= look.heightScale;
  const seen = new Set<THREE.Material>();
  lm.group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m || !m.isMeshStandardMaterial || seen.has(m)) return;
    seen.add(m);
    const c = m.clone();
    c.color.offsetHSL(look.hueShift, 0, 0);
    (o as THREE.Mesh).material = c;
  });
  const top = lm.top * look.heightScale;
  const local = top / lm.group.scale.y;
  if (look.roof === 1) {
    const r = mesh(new THREE.ConeGeometry(0.35, 0.3, 4), std('#c96f4a'), 0, local + 0.1, 0);
    r.rotation.y = Math.PI / 4;
    lm.group.add(r);
  } else if (look.roof === 2) {
    lm.group.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), std('#999'), 0, local + 0.25, 0));
  }
  return { ...lm, top: top + 0.15 };
}
