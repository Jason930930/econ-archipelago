import * as THREE from 'three';
import type { IslandLayout } from '../../world/layout';
import { fnv1a } from '../colors';
import { mulberry32 } from '../scene';

const top = () => new THREE.MeshStandardMaterial({ color: '#7fbf6a', roughness: 0.8, flatShading: true });
const side = () => new THREE.MeshStandardMaterial({ color: '#d8c08c', roughness: 0.85, flatShading: true });
export const ISLAND_TOP_Y = 0.4;

/** 依地區 id 決定形狀的低多邊形抽象島（不是真實海岸線）。 */
export function buildIslandTerrain(regionId: string, layout: IslandLayout, intl = false): THREE.Mesh {
  const rand = mulberry32(fnv1a(regionId));
  const shape = new THREE.Shape();
  const N = 28;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = layout.radius * (0.94 + rand() * 0.12);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: true, bevelSize: 0.35, bevelThickness: 0.25, bevelSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  const t = top();
  if (intl) t.color.set('#c9d6df');
  const m = new THREE.Mesh(geo, [t, side()]);
  m.position.set(layout.center[0], -0.55, layout.center[1]);
  m.receiveShadow = true;
  m.castShadow = true;
  return m;
}
