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
