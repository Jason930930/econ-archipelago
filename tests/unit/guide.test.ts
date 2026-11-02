import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { INDICATOR_KEYS } from '../../src/data/types';
import { REGION_IDS } from '../../src/world/regions';
import { SECTOR_IDS } from '../../src/world/sectors';

const guide = readFileSync('docs/WEEKLY_DATA_GUIDE.md', 'utf8');

test.each([...REGION_IDS])('guide documents region %s', (id) => expect(guide).toContain(`\`${id}\``));
test.each([...SECTOR_IDS])('guide documents sector %s', (id) => expect(guide).toContain(`\`${id}\``));
test.each([...INDICATOR_KEYS])('guide documents indicator %s', (key) => expect(guide).toContain(`\`${key}\``));

test('guide covers the v2 entity workflow', () => {
  for (const s of ['data/world/registry.json', 'newEntities', '人物不新增', 'schemaVersion: 2', '"geo"']) expect(guide, s).toContain(s);
});

test('guide embeds the latest example week verbatim', () => {
  expect(guide).toContain(readFileSync('data/weeks/2026-10-30.json', 'utf8').trim());
});
