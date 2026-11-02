import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/** 標籤一律以 textContent 寫入（資料中的名稱可能來自排程新增的實體）。 */
export function makeLabel(text: string, cls: string): HTMLDivElement {
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = text;
  return div;
}

export function labelObject(text: string, cls: string): CSS2DObject {
  return new CSS2DObject(makeLabel(text, cls));
}

export type LabelKind = 'region' | 'district' | 'entity' | 'entity-name';

/** 縮放分級：地區永遠顯示；部門名與實體建築 ≥ 1.8；實體名稱 ≥ 3.0。 */
export function labelVisibility(kind: LabelKind, zoom: number): boolean {
  switch (kind) {
    case 'region': return true;
    case 'district':
    case 'entity': return zoom >= 1.8;
    case 'entity-name': return zoom >= 3.0;
  }
}
