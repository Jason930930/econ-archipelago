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
