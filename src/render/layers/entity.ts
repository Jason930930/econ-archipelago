import * as THREE from 'three';
import type { EntityRecord } from '../../world/registry';
import { getSector } from '../../world/sectors';
import { buildEntityBuilding } from '../entityBuilding';
import type { WorldNode } from '../graph';
import type { Landmark } from '../landmarks';
import { labelObject } from './labels';
import { makeNode, tagPath } from './nodeBase';

export interface EntityNode extends WorldNode {
  readonly label: THREE.Object3D;
  readonly landmark: Landmark;
}

/** L2 實體建築節點：依部門原型自動生成，名稱標籤以文字寫入。 */
export function buildEntityNode(path: string, entity: EntityRecord, at: THREE.Vector3, plot: number): EntityNode {
  const group = new THREE.Group();
  group.position.copy(at);
  const lm = buildEntityBuilding(getSector(entity.sector).archetype, entity.id, plot);
  group.add(lm.group);
  const label = labelObject(entity.name, 'entity-label');
  label.position.set(0, lm.top + 0.25, 0);
  group.add(label);
  tagPath(group, path);
  const node = makeNode({
    path, kind: 'entity', object: group, ringRadius: plot * 0.24, ringY: 0.05,
    anchor: () => group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, lm.top + 0.2, 0)),
    update: lm.update,
  });
  return Object.assign(node, { label, landmark: lm });
}
