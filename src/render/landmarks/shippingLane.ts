import * as THREE from 'three';
import { anchorAt, finish, mesh, std, type LandmarkBuilder } from './shared';

/** 航道：浮標、閃燈與擴散水波。 */
export const shippingLane: LandmarkBuilder = ({ plot }) => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.35, 8), std('#e5484d'), 0, 0.05, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 5), std('#eee'), 0, 0.6, 0));
  const lamp = std('#fff3a0', { emissive: new THREE.Color('#fff3a0'), emissiveIntensity: 1 });
  g.add(mesh(new THREE.SphereGeometry(0.12, 8, 6), lamp, 0, 1.1, 0));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
  ring.position.y = 0.02;
  g.add(ring);
  return finish(g, 1.4, plot, { roof: anchorAt(0, 1.2, 0) }, (_dt, t) => {
    g.position.y = Math.sin(t * 1.5) * 0.06;
    lamp.emissiveIntensity = 0.5 + (Math.sin(t * 4) > 0 ? 1 : 0);
    ring.scale.setScalar(1 + ((t * 0.5) % 1) * 0.6);
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - ((t * 0.5) % 1));
  });
};
