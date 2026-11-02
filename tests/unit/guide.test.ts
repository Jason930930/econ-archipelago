import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { INDICATOR_KEYS } from '../../src/data/types';
import { REGION_IDS } from '../../src/world/regions';
import { SECTOR_IDS } from '../../src/world/sectors';
import { CHANNELS } from '../../src/world/channels';
import { isQualitative, NODE_SOURCES } from '../../src/world/stateSources';

const guide = readFileSync('docs/WEEKLY_DATA_GUIDE.md', 'utf8');

test.each([...REGION_IDS])('guide documents region %s', (id) => expect(guide).toContain(`\`${id}\``));
test.each([...SECTOR_IDS])('guide documents sector %s', (id) => expect(guide).toContain(`\`${id}\``));
test.each([...INDICATOR_KEYS])('guide documents indicator %s', (key) => expect(guide).toContain(`\`${key}\``));

test('guide covers the v2 entity workflow', () => {
  for (const s of ['data/world/registry.json', 'newEntities', '人物不新增', 'schemaVersion: 2', '"geo"', '不要填 `addedIn`', '`aliases` 必填', '`places` 不可重複']) expect(guide, s).toContain(s);
});

test('guide embeds the latest example week verbatim', () => {
  expect(guide).toContain(readFileSync('data/weeks/2026-10-30.json', 'utf8').trim());
});

test.each(CHANNELS.map((c) => c.id))('guide lists channel %s', (id) => expect(guide).toContain(`\`${id}\``));

test('guide covers channel tagging and proposals', () => {
  for (const s of ['proposedChannels', 'fromVar', 'toVar', 'evidence', '碰到', '`channel`', '`channels`', '不填強度']) expect(guide, s).toContain(s);
});

test('guide separates events[].channels from taiwanImpact.channels', () => {
  expect(guide).toContain('| `channels` | 選填：本則事件內點亮的精選管道 id（見第 11 節）');
  expect(guide).toContain('`events[].channels` 只能填精選管道 id');
});

test.each(Object.keys(NODE_SOURCES).filter(isQualitative))('guide lists qualitative node %s', (id) => expect(guide).toContain(`\`${id}\``));

test('guide covers nodeStates', () => {
  for (const s of ['nodeStates', '不要手動沿用', 'FRED', '`level`', '`direction`', '`basis`']) expect(guide, s).toContain(s);
});

test('guide pulls before pushing to main (FRED bot also pushes daily)', () => {
  expect(guide).toContain('git pull --rebase origin main && git push origin main');
  expect(guide).toContain('推送被拒');
});
