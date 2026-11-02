// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildIndex } from '../../src/data/buildIndex';
import type { WeekData } from '../../src/data/types';
import { channelName, renderActiveChannels, renderChannelPanel, renderProposalList, renderProposalPanel, QUALITATIVE_NOTE } from '../../src/ui/channelPanel';
import { renderNodePanel } from '../../src/ui/nodePanel';
import { renderTextMode } from '../../src/ui/textMode';
import { orderEvents } from '../../src/story/order';
import type { EntityRecord } from '../../src/world/registry';

const load = (id: string) => JSON.parse(readFileSync(`data/weeks/${id}.json`, 'utf8')) as WeekData;
const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];
const weeks = ['2026-10-16', '2026-10-23', '2026-10-30'].map(load);
const latest = weeks[2]!;
const evil = '<img src=x onerror="alert(1)">';
const withProposal: WeekData = {
  ...latest,
  proposedChannels: [{ id: 'jp-tech-proposal', fromPath: 'jp/tech', toPath: 'us/tech', fromVar: '日本科技', toVar: '美國科技', sign: -1, mechanism: evil, evidence: ['e1'] }],
};
const index = buildIndex([weeks[0]!, weeks[1]!, withProposal], seed);

/** 收集元素派發的自訂事件。 */
function captured(node: HTMLElement) {
  const got: { type: string; detail: unknown }[] = [];
  for (const type of ['select-node', 'select-event', 'select-week', 'select-channel', 'select-proposal']) {
    node.addEventListener(type, (e) => got.push({ type, detail: (e as CustomEvent).detail }));
  }
  return got;
}

describe('renderChannelPanel', () => {
  const panel = () => renderChannelPanel('oil-to-us-inflation', latest, index);
  test('title endpoints are buttons that select nodes', () => {
    const p = panel();
    const got = captured(p);
    const ends = p.querySelectorAll<HTMLButtonElement>('.channel-ends button');
    expect([...ends].map((b) => b.textContent)).toEqual(['油價', '美國通膨']);
    ends[0]!.click();
    expect(got).toEqual([{ type: 'select-node', detail: { path: 'gulf/energy' } }]);
  });
  test('shows direction, strength, lag, family, mechanism and the fixed note', () => {
    const t = panel().textContent!;
    expect(t).toContain('同向');
    expect(t).toContain('●●●');
    expect(t).toContain('數週');
    expect(t).toContain('能源與通膨');
    expect(t).toContain('汽油與運輸成本');
    expect(t).toContain(QUALITATIVE_NOTE);
    expect(QUALITATIVE_NOTE).toBe('方向與強度為教科書層級的定性判斷，不是量化模型或預測。');
  });
  test('inverse channel says 反向 and shows weaker strength', () => {
    const t = renderChannelPanel('us-yield-to-tech', latest, index).textContent!;
    expect(t).toContain('反向');
    expect(t).toContain('●●●');
    expect(renderChannelPanel('fed-to-tw-policy-rate', latest, index).textContent).toContain('●○○');
  });
  test('lists this week\'s events and history weeks as buttons', () => {
    const p = panel();
    const got = captured(p);
    const evs = [...p.querySelectorAll<HTMLButtonElement>('[data-event-id]')];
    expect(evs.map((b) => b.dataset.eventId)).toEqual(['e3', 'e5']);
    evs[0]!.click();
    const hist = [...p.querySelectorAll<HTMLButtonElement>('[data-week-id]')];
    expect(hist.map((b) => b.dataset.weekId)).toEqual(['2026-10-16', '2026-10-23', '2026-10-30']);
    hist[0]!.click();
    expect(got).toEqual([
      { type: 'select-event', detail: { eventId: 'e3' } },
      { type: 'select-week', detail: { weekId: '2026-10-16' } },
    ]);
  });
  test('streak of two or more shows 持續活躍', () => {
    expect(panel().textContent).toContain('持續活躍 3 週');
    expect(renderChannelPanel('hormuz-to-oil', latest, index).textContent).not.toContain('持續活躍');
  });
  test('quiet channel says it is not lit this week', () => {
    expect(renderChannelPanel('boj-to-yen', latest, index).textContent).toContain('本週未點亮');
  });
});

describe('renderProposalPanel', () => {
  test('proposal panel renders text, never HTML', () => {
    const p = renderProposalPanel('jp-tech-proposal', index);
    expect(p.querySelector('img')).toBeNull();
    expect(p.textContent).toContain(evil);
    expect(p.textContent).toContain('待審提議：不參與推演');
    expect(p.textContent).toContain('反向');
    expect(p.textContent).toContain('日本科技');
    expect(p.textContent).toContain('2026-10-30');
  });
  test('proposal list lists every proposal with a select button', () => {
    const l = renderProposalList(index);
    const got = captured(l);
    const btns = [...l.querySelectorAll<HTMLButtonElement>('[data-proposal]')];
    expect(btns.map((b) => b.dataset.proposal)).toEqual(['jp-tech-proposal']);
    btns[0]!.click();
    expect(got).toEqual([{ type: 'select-proposal', detail: { id: 'jp-tech-proposal' } }]);
  });
});

describe('renderActiveChannels', () => {
  test('lists lit channels ordered by heat, highest first', () => {
    const l = renderActiveChannels('2026-10-30', index);
    const ids = [...l.querySelectorAll<HTMLElement>('[data-channel]')].map((b) => b.dataset.channel);
    expect(ids[0]).toBe('oil-to-us-inflation');
    expect(ids).toContain('us-equity-to-tw-equity');
    const heats = ids.map((id) => index.channels.byWeek['2026-10-30']![id!]!.heat);
    expect([...heats].sort((a, b) => b - a)).toEqual(heats);
  });
  test('includes fading channels only while heat ≥ 0.5', () => {
    const ids = [...renderActiveChannels('2026-10-30', index).querySelectorAll<HTMLElement>('[data-channel]')].map((b) => b.dataset.channel);
    // 10/23 點亮（熱度 1）、10/30 未點亮：熱度 0.5，仍列為亮管
    expect(ids).toContain('foreign-flow-to-tw-equity');
  });
  test('clicking dispatches select-channel', () => {
    const l = renderActiveChannels('2026-10-30', index);
    const got = captured(l);
    l.querySelector<HTMLButtonElement>('[data-channel="hormuz-to-oil"]')!.click();
    expect(got).toEqual([{ type: 'select-channel', detail: { id: 'hormuz-to-oil' } }]);
  });
});

describe('node panel channels', () => {
  test('tw lists tsmc-to-tw-equity, lit channels first', () => {
    const p = renderNodePanel('tw', latest, index);
    const ids = [...p.querySelectorAll<HTMLElement>('.node-channels [data-channel]')].map((b) => b.dataset.channel!);
    expect(ids).toContain('tsmc-to-tw-equity');
    const lit = (id: string) => (index.channels.byWeek['2026-10-30']![id]?.heat ?? 0) >= 0.5 || (index.channels.byWeek['2026-10-30']![id]?.intensity ?? 0) > 0;
    const firstDark = ids.findIndex((id) => !lit(id));
    expect(firstDark).toBeGreaterThan(0);
    expect(ids.slice(firstDark).every((id) => !lit(id))).toBe(true);
  });
  test('entity panel only lists channels at or under it', () => {
    const ids = [...renderNodePanel('tw/semiconductor/tsmc', latest, index).querySelectorAll<HTMLElement>('.node-channels [data-channel]')].map((b) => b.dataset.channel);
    expect(ids).toEqual(['tsmc-to-tw-equity']);
  });
});

describe('text mode channels', () => {
  test('lists lit channels with name and mechanism', () => {
    const t = renderTextMode(latest, orderEvents(latest), seed);
    const sec = t.querySelector('.text-channels')!;
    expect(sec.textContent).toContain(channelName('oil-to-us-inflation'));
    expect(sec.textContent).toContain('汽油與運輸成本');
    expect(sec.textContent).toContain(channelName('hormuz-to-oil'));
  });
  test('untagged week has no channel section', () => {
    const plain: WeekData = { ...latest, links: latest.links.map(({ channel: _c, ...l }) => l), events: latest.events.map(({ channels: _c, ...e }) => e) };
    expect(renderTextMode(plain, orderEvents(plain), seed).querySelector('.text-channels')).toBeNull();
  });
});
