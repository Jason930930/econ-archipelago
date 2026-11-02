/** 開發用預覽頁（Task 7–10 目視驗證用，Task 11 刪除）：以最新一週建立世界。 */
import './ui/styles.css';
import type { ArchiveIndex } from './data/buildIndex';
import type { WeekData } from './data/types';
import { createWorld } from './render/world';
import { project } from './world/geo';
import { computeWorldParams } from './world/indicators';

async function main() {
  const base = import.meta.env.BASE_URL;
  const index = (await (await fetch(`${base}data/index.json`)).json()) as ArchiveIndex;
  const latest = index.weeks.at(-1)!;
  const week = (await (await fetch(`${base}data/weeks/${latest.weekId}.json`)).json()) as WeekData;
  const stage = document.getElementById('stage')!;
  const canvas = document.createElement('canvas');
  stage.append(canvas);
  const seaPoints = index.entities.filter((e) => e.geo).map((e) => project(e.geo!.lat, e.geo!.lon));
  const world = createWorld(canvas, seaPoints);
  world.build({ entities: index.entities, districts: index.districts, mentions: index.mentions });
  world.setWeekFocus(week.events.flatMap((e) => e.places));
  world.setParams(computeWorldParams(index.indicators[latest.weekId]!, week.events));
  world.onPick((p) => console.log('pick', p));
  Object.assign(window, { __world: world, __week: week });
}
void main();
