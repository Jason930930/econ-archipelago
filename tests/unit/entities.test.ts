import { describe, expect, test } from 'vitest';
import { ENTITIES, ENTITY_IDS, getEntity } from '../../src/world/entities';

describe('entity registry', () => {
  test('has exactly the 17 spec entities', () => {
    expect([...ENTITY_IDS].sort()).toEqual(
      ['crypto', 'cn-industry', 'eu-ecb', 'global', 'gold-vault', 'jp-boj', 'kr-memory', 'me-oil', 'sea-hormuz', 'sea-pacific', 'tw-cbc', 'tw-fab', 'tw-twse', 'us-bonds', 'us-fed', 'us-tech', 'us-wallst'].sort(),
    );
  });

  test('ids unique and positions distinct', () => {
    expect(new Set(ENTITY_IDS).size).toBe(ENTITY_IDS.length);
    for (let i = 0; i < ENTITIES.length; i++) {
      for (let j = i + 1; j < ENTITIES.length; j++) {
        const [ax, az] = ENTITIES[i]!.position;
        const [bx, bz] = ENTITIES[j]!.position;
        expect(Math.hypot(ax - bx, az - bz), `${ENTITIES[i]!.id} vs ${ENTITIES[j]!.id}`).toBeGreaterThanOrEqual(1.5);
      }
    }
  });

  test('kr-memory is on island kr with kind memory', () => {
    const e = getEntity('kr-memory');
    expect(e.island).toBe('kr');
    expect(e.kind).toBe('memory');
  });
});
