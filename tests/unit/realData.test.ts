import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { validateArchive } from '../../src/data/validate';
import type { EntityRecord } from '../../src/world/registry';

const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];

const DIR = 'data/weeks';
const files = readdirSync(DIR).filter((n) => n.endsWith('.json')).map((fileName) => ({
  fileName, raw: JSON.parse(readFileSync(`${DIR}/${fileName}`, 'utf8')) as { events: unknown[] },
}));

test('archive has at least the three backfilled weeks', () => {
  expect(files.length).toBeGreaterThanOrEqual(3);
});

test('all weeks pass validation', () => {
  expect(validateArchive(files, seed)).toEqual([]);
});

test('backfilled channels', async () => {
  const { computeActivation } = await import('../../src/world/activation');
  const { byWeek } = computeActivation(files.map((f) => f.raw as never));
  const w30 = byWeek['2026-10-30']!, w23 = byWeek['2026-10-23']!;
  expect(w30['oil-to-us-inflation']!.intensity).toBe(2);
  expect(w30['oil-to-us-inflation']!.heat).toBeCloseTo(2 + 0.5 * w23['oil-to-us-inflation']!.heat);
  expect(w23['oil-to-us-inflation']!.streak).toBe(2);
  expect(w30['us-equity-to-tw-equity']!.intensity).toBeGreaterThanOrEqual(1);
});
