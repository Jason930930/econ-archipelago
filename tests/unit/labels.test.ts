// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildIndex } from '../../src/data/buildIndex';
import type { WeekData } from '../../src/data/types';
import { labelVisibility, makeLabel } from '../../src/render/layers/labels';
import { hoverInfo } from '../../src/ui/hover';
import type { EntityRecord } from '../../src/world/registry';

const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];
const weeks = ['2026-10-16', '2026-10-23', '2026-10-30'].map((id) => JSON.parse(readFileSync(`data/weeks/${id}.json`, 'utf8')) as WeekData);
const index = buildIndex(weeks, seed);

describe('labels', () => {
  test('entity label renders name as text', () => {
    const el = makeLabel('<img src=x onerror=alert(1)>', 'x');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
  });
  test('labelVisibility thresholds', () => {
    expect(labelVisibility('region', 0.8)).toBe(true);
    expect(labelVisibility('district', 1.79)).toBe(false);
    expect(labelVisibility('district', 1.8)).toBe(true);
    expect(labelVisibility('entity', 1.79)).toBe(false);
    expect(labelVisibility('entity', 1.8)).toBe(true);
    expect(labelVisibility('entity-name', 2.99)).toBe(false);
    expect(labelVisibility('entity-name', 3.0)).toBe(true);
  });
});

describe('hoverInfo', () => {
  test('enlarged island says so and shows approximate GDP', () => {
    const h = hoverInfo('tw', '2026-10-30', index);
    expect(h.title).toBe('台灣');
    expect(h.lines.join(' ')).toContain('約略 GDP 1.0 兆美元');
    expect(h.lines.join(' ')).toContain('為可讀性放大');
  });
  test('large island is not marked enlarged', () => {
    expect(hoverInfo('us', '2026-10-30', index).lines.join(' ')).not.toContain('為可讀性放大');
  });
  test('indicator node includes value and note', () => {
    const h = hoverInfo('tw/equity', '2026-10-30', index);
    expect(h.title).toBe('台灣 › 股市');
    expect(h.lines.join(' ')).toContain('45,211.83');
    expect(h.lines.join(' ')).toContain('10/30 單日漲跌');
  });
  test('entity shows breadcrumb title', () => expect(hoverInfo('tw/semiconductor/tsmc', '2026-10-30', index).title).toBe('台灣 › 半導體 › 台積電'));
});
