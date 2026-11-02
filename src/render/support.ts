/** 偵測 WebGL2（three r163 起只支援 WebGL2）；不 import three，可在 Node 測試。 */
export function supportsWebGL(canvas?: HTMLCanvasElement): boolean {
  try {
    const c = canvas ?? document.createElement('canvas');
    return Boolean(c.getContext('webgl2'));
  } catch {
    return false;
  }
}
