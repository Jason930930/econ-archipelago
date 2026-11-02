import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { INDICATOR_KEYS } from '../../src/data/types';
import { ENTITY_IDS } from '../../src/world/entities';

const guide = readFileSync('docs/WEEKLY_DATA_GUIDE.md', 'utf8');

test.each([...ENTITY_IDS])('guide documents entity %s', (id) => {
  expect(guide).toContain(`\`${id}\``);
});

test.each([...INDICATOR_KEYS])('guide documents indicator %s', (key) => {
  expect(guide).toContain(`\`${key}\``);
});

test('guide embeds the latest example week verbatim', () => {
  const example = readFileSync('data/weeks/2026-10-30.json', 'utf8').trim();
  expect(guide).toContain(example);
});
