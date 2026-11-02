import { describe, expect, test } from 'vitest';
import { entityLook } from '../../src/render/entityBuilding';
import { LANDMARKS } from '../../src/render/landmarks';
import { SECTOR_IDS } from '../../src/world/sectors';

describe('entityLook', () => {
  test('is deterministic', () => expect(entityLook('tsmc')).toEqual(entityLook('tsmc')));
  test('stays within ranges', () => {
    for (let i = 0; i < 200; i++) {
      const l = entityLook(`co-${i * 7919}`);
      expect(l.heightScale).toBeGreaterThanOrEqual(0.7);
      expect(l.heightScale).toBeLessThanOrEqual(1.4);
      expect(l.hueShift).toBeGreaterThanOrEqual(-0.08);
      expect(l.hueShift).toBeLessThanOrEqual(0.08);
      expect([0, 1, 2]).toContain(l.roof);
    }
  });
  test('different ids usually look different', () => expect(entityLook('tsmc')).not.toEqual(entityLook('intel')));
});

describe('landmarks', () => {
  test('one builder per sector archetype', () => expect(Object.keys(LANDMARKS).sort()).toEqual([...SECTOR_IDS].sort()));
  test('every builder produces geometry with a positive top', () => {
    for (const id of SECTOR_IDS) {
      const lm = LANDMARKS[id]({ plot: 1.6 });
      expect(lm.top, id).toBeGreaterThan(0);
      expect(lm.group.children.length, id).toBeGreaterThan(0);
    }
  });
});
