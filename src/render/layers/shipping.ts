import * as THREE from 'three';
import type { WorldGraph } from '../graph';
import { mesh, std } from '../landmarks/shared';

/** 油輪航線：中東 → 荷莫茲 → 麻六甲 → 台灣海峽 → 太平洋航線 → 美國。 */
export const SHIPPING_ROUTE = [
  'gulf/energy',
  'seas/shipping-lane/hormuz',
  'seas/shipping-lane/malacca',
  'seas/shipping-lane/taiwan-strait',
  'seas/shipping-lane/pacific',
  'us',
] as const;

const MAX_TANKERS = 8;

/** 建立航線；節點不存在的路段直接略過。跨越換日線的點會平移到同一側。 */
export function buildShipping(graph: WorldGraph, worldWidth: number) {
  const group = new THREE.Group();
  const pts: THREE.Vector3[] = [];
  for (const path of SHIPPING_ROUTE) {
    const n = graph.get(path);
    if (!n) continue;
    const p = n.object.getWorldPosition(new THREE.Vector3());
    if (n.kind === 'region') p.copy(n.anchor());
    p.y = 0.05;
    const prev = pts.at(-1);
    if (prev && Math.abs(p.x - prev.x) > worldWidth / 2) p.x += p.x > prev.x ? -worldWidth : worldWidth;
    pts.push(p);
  }
  if (pts.length < 2) return { group, setCount() {}, update() {} };
  const curve = new THREE.CatmullRomCurve3(pts);
  const lane = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curve.getPoints(200)),
    new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 0.6, gapSize: 0.5, transparent: true, opacity: 0.45 }),
  );
  lane.computeLineDistances();
  group.add(lane);
  const ships: THREE.Group[] = [];
  const hull = std('#2f3b4a');
  const deck = std('#e5484d');
  for (let i = 0; i < MAX_TANKERS; i++) {
    const s = new THREE.Group();
    s.add(mesh(new THREE.BoxGeometry(1.2, 0.3, 0.42), hull));
    s.add(mesh(new THREE.BoxGeometry(0.3, 0.32, 0.34), deck, -0.38, 0.3, 0));
    group.add(s);
    ships.push(s);
  }
  let count = 5;
  return {
    group,
    setCount(n: number) {
      count = Math.max(0, Math.min(MAX_TANKERS, n));
    },
    update(_dt: number, t: number) {
      ships.forEach((s, i) => {
        s.visible = i < count;
        if (!s.visible) return;
        const u = (t * 0.008 + i / Math.max(1, count)) % 1;
        const pos = curve.getPointAt(u);
        const ahead = curve.getPointAt(Math.min(1, u + 0.005));
        s.position.set(pos.x, 0.08 + Math.sin(t * 2 + i) * 0.04, pos.z);
        s.lookAt(ahead.x, s.position.y, ahead.z);
        s.rotateY(-Math.PI / 2);
      });
    },
  };
}
