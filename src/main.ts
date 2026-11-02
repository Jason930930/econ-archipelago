import './ui/styles.css';
import type { ArchiveIndex } from './data/buildIndex';
import type { WeekData } from './data/types';
import { createWorld } from './render/world';
import { computeVisualParams } from './world/visualParams';

// Task 7 暫時入口：以最新一週建立世界，供目視驗證。Task 10 改為 startApp。
async function main() {
  const base = import.meta.env.BASE_URL;
  const index = (await (await fetch(`${base}data/index.json`)).json()) as ArchiveIndex;
  const latest = index.weeks[index.weeks.length - 1]!;
  const week = (await (await fetch(`${base}data/weeks/${latest.weekId}.json`)).json()) as WeekData;
  const app = document.getElementById('app')!;
  app.style.cssText = 'position:fixed;inset:0';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block';
  app.appendChild(canvas);
  const world = createWorld(canvas);
  world.setParams(computeVisualParams(index.indicators[latest.weekId]!, week.events));
  world.onPick((id) => console.log('pick', id));
  Object.assign(window, { __world: world });
}
void main();
