import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { NodeKind, NodeState, WorldNode } from '../graph';

/** 把 group 底下所有物件標上路徑（拾取時往上找第一個有 path 的物件）。 */
export function tagPath(obj: THREE.Object3D, path: string): void {
  obj.traverse((o) => {
    if (o.userData.path === undefined) o.userData.path = path;
  });
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((c) => {
    if (c instanceof CSS2DObject) c.element.remove();
    const m = c as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
  obj.removeFromParent();
}

/** 高亮光環 + 變暗（降低飽和度），所有節點共用。 */
export function makeNode(opts: {
  path: string;
  kind: NodeKind;
  object: THREE.Object3D;
  anchor: () => THREE.Vector3;
  ringRadius: number;
  ringY: number;
  /** 環的水平中心（世界座標）；地區節點的 group 位於原點，需指定島心。 */
  ringCenter?: [number, number];
  update?: (dt: number, t: number) => void;
}): WorldNode {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(opts.ringRadius, opts.ringRadius * 1.18, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
  );
  ring.position.set(opts.ringCenter?.[0] ?? 0, opts.ringY, opts.ringCenter?.[1] ?? 0);
  ring.visible = false;
  ring.userData.path = opts.path;
  ring.userData.isRing = true;
  opts.object.add(ring);
  const mats: { mat: THREE.MeshStandardMaterial; base: THREE.Color }[] = [];
  const collect = () => {
    opts.object.traverse((o) => {
      if (o === ring) return;
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && m.isMeshStandardMaterial && !mats.some((x) => x.mat === m)) mats.push({ mat: m, base: m.color.clone() });
    });
  };
  let state: NodeState = 'normal';
  return {
    path: opts.path,
    kind: opts.kind,
    object: opts.object,
    anchor: opts.anchor,
    setState(s) {
      if (s === state) return;
      state = s;
      ring.visible = s === 'highlight';
      if (mats.length === 0) collect();
      for (const { mat, base } of mats) {
        const hsl = { h: 0, s: 0, l: 0 };
        base.getHSL(hsl);
        mat.color.setHSL(hsl.h, s === 'dim' ? hsl.s * 0.5 : hsl.s, s === 'dim' ? hsl.l * 0.85 : hsl.l);
      }
    },
    update(dt, t) {
      if (ring.visible) (ring.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 4) * 0.3;
      opts.update?.(dt, t);
    },
    dispose() {
      disposeObject(opts.object);
    },
  };
}
