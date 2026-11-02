import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { validateArchive } from '../../src/data/validate';

const DIR = 'data/weeks';
const files = readdirSync(DIR).filter((n) => n.endsWith('.json')).map((fileName) => ({
  fileName, raw: JSON.parse(readFileSync(`${DIR}/${fileName}`, 'utf8')) as { events: unknown[] },
}));

test('archive has at least the three backfilled weeks', () => {
  expect(files.length).toBeGreaterThanOrEqual(3);
});

test('all weeks pass validation', () => {
  expect(validateArchive(files)).toEqual([]);
});

test('each week has five events', () => {
  for (const f of files) expect(f.raw.events.length, f.fileName).toBe(5);
});
