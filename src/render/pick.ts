import * as THREE from 'three';

/**
 * 線段（提議的虛線、航線）的拾取寬度（世界單位）。three 預設 1，
 * 在半徑只有 2 的台灣島上，虛線兩側各 1 單位都會搶走區塊的點擊。
 */
export const LINE_PICK_THRESHOLD = 0.12;

export function createPickRaycaster(): THREE.Raycaster {
  const r = new THREE.Raycaster();
  r.params.Line = { threshold: LINE_PICK_THRESHOLD };
  return r;
}
