import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { synthesizeNextWeek } from '../../scripts/synthetic-week';
import type { WeekData } from '../../src/data/types';
import { validateArchive } from '../../src/data/validate';
import type { EntityRecord } from '../../src/world/registry';

const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];
const latest = JSON.parse(readFileSync('data/weeks/2026-10-30.json', 'utf8')) as WeekData;

test('synthetic week is valid next to the archive', () => {
  const next = synthesizeNextWeek(latest);
  expect(next.weekId).toBe('2026-11-06');
  const archive = ['2026-10-16', '2026-10-23', '2026-10-30'].map((id) => ({ fileName: `${id}.json`, raw: JSON.parse(readFileSync(`data/weeks/${id}.json`, 'utf8')) as unknown }));
  expect(validateArchive([...archive, { fileName: '2026-11-06.json', raw: next }], seed)).toEqual([]);
});

test('does not duplicate places that the latest week already uses', () => {
  const w = structuredClone(latest);
  w.events.find((e) => e.rank === 2)!.places.push('jp/real-estate');
  w.events.find((e) => e.rank === 1)!.places.push('in/tech');
  const next = synthesizeNextWeek(w);
  for (const e of next.events) expect(new Set(e.places).size).toBe(e.places.length);
});

test('does not re-add an entity that already exists in the latest week', () => {
  const w = structuredClone(latest);
  w.newEntities = [{ id: 'synthetic-co', name: '演練公司', region: 'in', sector: 'tech', aliases: [] }];
  expect(synthesizeNextWeek(w).newEntities ?? []).toEqual([]);
});

test('synthetic week tags a channel on rank 1 and proposes at most one channel', () => {
  const next = synthesizeNextWeek(latest);
  const r1 = next.events.find((e) => e.rank === 1)!;
  expect(r1.channels?.length ?? 0).toBeGreaterThanOrEqual(1);
  expect(next.proposedChannels?.length ?? 0).toBeLessThanOrEqual(1);
  expect(next.proposedChannels?.[0]?.id).toBe('synthetic-proposal');
});

test('synthetic proposal never duplicates a core pair', () => {
  const w = structuredClone(latest);
  const r1 = w.events.find((e) => e.rank === 1)!;
  r1.places = ['us/central-bank', 'us/bonds'];
  r1.primary = 'us/central-bank';
  const p = synthesizeNextWeek(w).proposedChannels?.[0];
  expect(p && [p.fromPath, p.toPath]).not.toEqual(['us/central-bank', 'us/bonds']);
});

test('synthetic proposal is skipped when rank 1 has no usable pair', () => {
  const w = structuredClone(latest);
  const r1 = w.events.find((e) => e.rank === 1)!;
  r1.places = ['in/tech/synthetic-co'];
  r1.primary = 'in/tech/synthetic-co';
  expect(synthesizeNextWeek(w).proposedChannels ?? []).toEqual([]);
});

test('synthetic week adds a rehearsal node state the rank 1 event touches', () => {
  const next = synthesizeNextWeek(latest);
  const r1 = next.events.find((e) => e.rank === 1)!;
  const st = next.nodeStates?.find((n) => n.basis === '演練用狀態');
  expect(st).toMatchObject({ level: 'mid', direction: 0, evidence: [r1.id] });
  const archive = ['2026-10-16', '2026-10-23', '2026-10-30'].map((id) => ({ fileName: `${id}.json`, raw: JSON.parse(readFileSync(`data/weeks/${id}.json`, 'utf8')) as unknown }));
  expect(validateArchive([...archive, { fileName: '2026-11-06.json', raw: next }], seed)).toEqual([]);
});

test('no rehearsal node state when rank 1 touches no qualitative node', () => {
  const w = structuredClone(latest);
  const r1 = w.events.find((e) => e.rank === 1)!;
  r1.places = ['ca/energy'];
  r1.primary = 'ca/energy';
  expect((synthesizeNextWeek(w).nodeStates ?? []).some((n) => n.basis === '演練用狀態')).toBe(false);
});
