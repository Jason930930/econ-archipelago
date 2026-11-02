/** 等距圓柱投影，以東經 150° 置中（太平洋在中央）。x 向東、z 向南。 */
export const WORLD_SCALE = 0.29;
export const CENTER_LON = 150;

export function wrapLon(d: number): number {
  return (((d + 180) % 360) + 360) % 360 - 180;
}

export function project(lat: number, lon: number): [x: number, z: number] {
  return [WORLD_SCALE * wrapLon(lon - CENTER_LON), -WORLD_SCALE * lat];
}
