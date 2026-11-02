import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildIndex } from '../../src/data/buildIndex';
import { CHANNEL_NODES, CHANNELS, channelsTouching, getChannelNode, touches } from '../../src/world/channels';
import { resolvePath, type EntityRecord } from '../../src/world/registry';

const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];

describe('channel catalogue', () => {
  test('36 nodes and 40 channels', () => {
    expect(CHANNEL_NODES).toHaveLength(36);
    expect(CHANNELS).toHaveLength(40);
  });
  test('ids are unique', () => {
    expect(new Set(CHANNEL_NODES.map((n) => n.id)).size).toBe(CHANNEL_NODES.length);
    expect(new Set(CHANNELS.map((c) => c.id)).size).toBe(CHANNELS.length);
  });
  test('channels connect existing, distinct nodes without duplicate pairs', () => {
    const ids = new Set(CHANNEL_NODES.map((n) => n.id));
    const pairs = new Set<string>();
    for (const c of CHANNELS) {
      expect(ids.has(c.from), c.id).toBe(true);
      expect(ids.has(c.to), c.id).toBe(true);
      expect(c.from).not.toBe(c.to);
      expect(pairs.has(`${c.from}>${c.to}`), c.id).toBe(false);
      pairs.add(`${c.from}>${c.to}`);
      expect(c.mechanism.length, c.id).toBeGreaterThan(5);
    }
  });
  test('no isolated nodes', () => {
    for (const n of CHANNEL_NODES) expect(CHANNELS.some((c) => c.from === n.id || c.to === n.id), n.id).toBe(true);
  });
  test('taiwan is dense (≥ 10 channels)', () => {
    const tw = CHANNELS.filter((c) => [c.from, c.to].some((id) => getChannelNode(id).path.startsWith('tw') || id === 'tw.strait-risk'));
    expect(tw.length).toBeGreaterThanOrEqual(10);
  });
  test('every node path resolves', () => {
    for (const n of CHANNEL_NODES) expect(resolvePath(n.path, seed), n.id).toEqual({ ok: true });
  });
  test('twd is inverse to usdtwd', () => expect(getChannelNode('tw.twd')).toMatchObject({ indicator: 'usdtwd', indicatorSign: -1 }));
  test('touches and channelsTouching', () => {
    expect(touches('us/central-bank', 'us')).toBe(true);
    expect(touches('us', 'us/central-bank')).toBe(true);
    expect(touches('us/central-bank', 'us/bonds')).toBe(false);
    expect(channelsTouching('tw').map((c) => c.id)).toContain('tsmc-to-tw-equity');
    expect(channelsTouching('kr').map((c) => c.id)).not.toContain('tsmc-to-tw-equity');
  });
  test('districts include channel node paths', () => {
    const idx = buildIndex([], seed);
    expect(idx.districts.us).toContain('fx');
    expect(idx.districts.tw).toContain('trade');
    expect(idx.districts.gulf).toContain('government');
  });
});
