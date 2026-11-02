import * as THREE from 'three';
import { factory, mesh, std, type LandmarkBuilder } from './shared';

/** 記憶體：紫屋頂廠房，前方一片發光晶片。 */
export const memory: LandmarkBuilder = ({ plot }) =>
  factory(plot, '#7b5cc4', 1, (g) => {
    g.add(mesh(new THREE.BoxGeometry(0.8, 0.08, 0.5), std('#1d1d2b', { emissive: new THREE.Color('#9d7bff'), emissiveIntensity: 0.7 }), 0, 0.75, 0.62));
  });
