import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { migrateWeek, V1_TO_V2 } from '../../scripts/migrate-v1-to-v2';
import { validateWeek } from '../../src/data/validate';
import type { EntityRecord } from '../../src/world/registry';

const v1 = JSON.parse(readFileSync('tests/fixtures/v1/2026-10-30.json', 'utf8'));
const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];
const V1_IDS = ['us-fed', 'us-wallst', 'us-bonds', 'us-tech', 'tw-cbc', 'tw-twse', 'tw-fab', 'kr-memory', 'me-oil', 'eu-ecb', 'jp-boj', 'cn-industry', 'gold-vault', 'crypto', 'sea-hormuz', 'sea-pacific', 'global'];

test('mapping covers every v1 id', () => expect(Object.keys(V1_TO_V2).sort()).toEqual([...V1_IDS].sort()));

test('migrated week matches snapshot', () => expect(migrateWeek(v1)).toMatchSnapshot());

test('migrated week is valid v2', () => {
  expect(validateWeek(migrateWeek(v1), '2026-10-30.json', { knownStorylines: new Set(['ai-capex', 'fed-hiking-cycle', 'mideast-energy']), entities: seed })).toEqual([]);
});

test('unknown v1 id throws with the id', () => {
  const bad = structuredClone(v1);
  bad.events[0].entities.push('mars-base');
  expect(() => migrateWeek(bad)).toThrow(/mars-base/);
});
