import * as THREE from 'three';
import { getSector, type SectorId } from '../../world/sectors';
import { GROUP_COLORS } from '../colors';
import type { WorldNode } from '../graph';
import type { Landmark } from '../landmarks';
import { ISLAND_TOP_Y } from './islandTerrain';
import { labelObject } from './labels';
import { makeNode, tagPath } from './nodeBase';

/** L1 部門區塊：一塊依部門分組上色的地皮與看板。建築（L2）之後掛在 group 上。 */
export interface DistrictNode extends WorldNode {
  readonly group: THREE.Group;
  readonly plot: number;
  readonly sector: SectorId;
  readonly label: THREE.Object3D;
  readonly landmark: Landmark;
}

/** 主建築佔區塊中央約一半，四個角落留給實體建築。 */
export const MAIN_SCALE = 0.5;

export function buildDistrict(path: string, sector: SectorId, at: [number, number], plot: number, landmark: Landmark): DistrictNode {
  const group = new THREE.Group();
  group.position.set(at[0], ISLAND_TOP_Y, at[1]);
  const slab = new THREE.Mesh(
    // 圓形地皮：與格位計算（以圓距離間隔）一致，斜向相鄰也不會重疊或超出島緣。
    new THREE.CylinderGeometry(plot * 0.46, plot * 0.46, 0.12, 28),
    new THREE.MeshStandardMaterial({ color: GROUP_COLORS[getSector(sector).group], roughness: 0.9, flatShading: true }),
  );
  slab.position.y = 0.06;
  slab.receiveShadow = true;
  group.add(slab);
  landmark.group.position.y = 0.12;
  group.add(landmark.group);
  const label = labelObject(getSector(sector).name, 'district-label');
  label.position.set(0, 0.2, plot * 0.5);
  group.add(label);
  tagPath(group, path);
  const node = makeNode({
    path, kind: 'district', object: group, ringRadius: plot * 0.62, ringY: 0.14,
    anchor: () => group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, landmark.top + 0.4, 0)),
    update: landmark.update,
  });
  return Object.assign(node, { group, plot, sector, label, landmark });
}
