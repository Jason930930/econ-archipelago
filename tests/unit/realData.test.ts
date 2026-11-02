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
