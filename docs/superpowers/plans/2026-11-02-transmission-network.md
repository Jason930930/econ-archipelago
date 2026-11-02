# 常駐傳導網絡 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在世界中常駐一張精選的經濟傳導管道圖。週報事件會點亮管道，跨週累計熱度；排程可以提議新管道等待審閱。

**Architecture:** 純邏輯放在 `src/world/channels.ts`（節點與管道清單）和 `src/world/activation.ts`（強度、熱度、連續週數、提議彙總），驗證規則擴充在 `src/data/validate.ts`。繪圖新增 `src/render/layers/channels.ts` 一層，UI 新增管道面板與網絡模式。全部沿用 v2 的路徑系統。

**Tech Stack:** 沿用現有，不新增依賴。

**Spec:** `docs/superpowers/specs/2026-11-02-transmission-network-design.md`

## Global Constraints

- 不新增 npm 依賴；介面文字一律繁體中文；資料文字一律用 textContent 寫入 DOM。
- 管道清單和節點清單必須和規格 §2 完全一致：36 個節點、40 條管道、11 條台灣相關。
- 熱度半衰期 1 週：`heat(w) = intensity(w) + 0.5·heat(w−1)`，強度上限 3；`streak ≥ 2` 為「持續活躍」。
- 週資料欄位全部選填，舊週檔不改也必須通過驗證。
- 管道面板固定顯示：`方向與強度為教科書層級的定性判斷，不是量化模型或預測。`
- 網絡模式偏好的 localStorage key 為 `econ-archipelago:network`，讀寫都包 try/catch。
- v1 和 v2 既有的 E2E 測試全部繼續通過。

## Review Focus

1. **提議的機制說明含 HTML** → 提議面板以文字顯示（Task 6 測試 `proposal panel renders text`）。
2. **管道端點的區塊不是預設區塊**（例如 `us/fx`、`tw/trade`）→ 區塊一定會畫出，管線不會接到島心（Task 1 測試 `districts include channel node paths`）。
3. **週次之間有缺漏**（例如少了一週）→ 熱度仍依現有週次的排序遞迴計算，不報錯（Task 3 測試 `heat ignores calendar gaps`）。
4. **某條管道的兩端在同一地區**（例如 Fed → 美債）→ 管線改走島上方的拱形，而不是穿過島（Task 5 測試 `sameRegion arch`）。
5. **排程在連線上標了不相干的管道** → 驗證失敗，並指出是哪一端碰不到（Task 2 測試 `link channel must touch both ends`）。

---

### Task 1: 節點與管道清單

**Files:** Create `src/world/channels.ts`、`tests/unit/channels.test.ts`；Modify `src/data/buildIndex.ts`（區塊集合加入節點路徑）。

**Interfaces — Produces:**
- `type ChannelFamily = 'energy-inflation' | 'monetary' | 'markets' | 'flows-fx' | 'supply-chain' | 'geopolitics' | 'policy-trade'`
- `FAMILY_INFO: Record<ChannelFamily, { name: string; color: string }>`：能源與通膨 `#f08c2e`、貨幣政策 `#3a7bd5`、金融市場 `#2fa36b`、資金流與匯率 `#1fb5b5`、供應鏈與產業 `#8e6cc2`、地緣與航運 `#e5484d`、政策與貿易 `#d9b52c`
- `interface ChannelNode { id; path; name; indicator?: IndicatorKey; indicatorSign?: 1 | -1 }`、`CHANNEL_NODES`
- `interface Channel { id; from; to; sign: 1 | -1; strength: 1 | 2 | 3; lag: 'days' | 'weeks' | 'months'; family: ChannelFamily; mechanism: string }`、`CHANNELS`
- `getChannel(id): Channel | undefined`、`getChannelNode(id): ChannelNode`、`isChannelId(s): boolean`
- `LAG_LABEL = { days: '數日', weeks: '數週', months: '數月' }`
- `touches(place: string, nodePath: string): boolean`（等於 `isWithin(place, nodePath) || isWithin(nodePath, place)`）
- `channelsTouching(path: string): Channel[]`：任一端節點路徑 `isWithin(nodePath, path)` 的管道

- [ ] Step 1：寫失敗測試：
  - 數量：36 個節點、40 條管道；
  - id 唯一；兩端節點存在；`from ≠ to`；沒有重複的 `(from, to)`；
  - 每個節點至少有一條管道；
  - 台灣相關管道 ≥ 10 條（端點路徑以 `tw` 開頭，或節點為 `tw.strait-risk`）；
  - 每個節點的路徑都能用種子實體解析（`resolvePath`）；
  - `tw.twd.indicatorSign === -1`；
  - `channelsTouching('tw')` 包含 `tsmc-to-tw-equity`；
  - `districts include channel node paths`：`buildIndex([], seed).districts.us` 包含 `fx`、`districts.tw` 包含 `trade`。
- [ ] Step 2：FAIL → 依規格 §2.1、§2.2 寫入清單；`buildIndex` 對每個節點路徑呼叫 `reference(path)` → PASS。
- [ ] Step 3：Commit `feat(world): curated transmission channels`。

### Task 2: 週資料擴充與驗證

**Files:** Modify `schema/week.schema.json`、`src/data/types.ts`、`src/data/validate.ts`、`tests/fixtures/valid-week.json`；Test `tests/unit/validate.test.ts`。

**Interfaces — Produces:**
- `CausalLink.channel?: string`
- `WeekEvent.channels?: string[]`
- `interface ProposedChannel { id; fromPath; toPath; fromVar; toVar; sign: 1 | -1; mechanism; evidence: string[] }`
- `WeekData.proposedChannels?: ProposedChannel[]`
- `ValidateContext.proposals: Map<string, { fromPath: string; toPath: string; sign: 1 | -1 }>`（較早週出現過的提議；`validateArchive` 負責累積）

- [ ] Step 1：在 fixture 上補 `channel` 與提議，讓它保持有效：
  - fixture 的 link e2→e1 是從荷莫茲到 Meta，補上 `hormuz-to-oil` 之類的管道會碰不到終點，所以**不在 fixture 的 link 上加 channel**；
  - e1 加 `channels: ["ai-capex-to-tw-semis"]`；
  - 加一個提議 `{ id: 'jp-tech-proposal', fromPath: 'jp/tech', toPath: 'us/tech', fromVar: '日本科技', toVar: '美國科技', sign: 1, mechanism: '測試', evidence: ['e1'] }`。
- [ ] Step 2：寫失敗測試：
  - `unknown channel id`（link 和 event 各一）；
  - `link channel must touch both ends`：把 fixture 的 link 標成 `us-equity-to-tw-equity`，錯誤路徑為 `/links/0/channel`，訊息包含「起點」；
  - `event channel must touch an end`：e2 加 `tsmc-to-tw-equity` → `/events/1/channels/0`；
  - `duplicate event channel`；
  - `proposal id clashes with core channel`；
  - `proposal duplicates a core pair`：from `us/central-bank`、to `us/bonds` → 訊息包含 `fed-to-us-yield`；
  - `proposal evidence must exist and touch`；
  - `proposal unresolvable path`；
  - `proposal same from/to`；
  - `proposal empty mechanism`；
  - `proposal repeated id within a week`；
  - `proposal repeated across weeks must match`（`validateArchive` 兩週、sign 不同 → 第二週報錯）；
  - `proposal repeated across weeks consistent is fine`。
- [ ] Step 3：FAIL → 實作（schema 加欄位；語意檢查依規格 §3.1）→ PASS；`npm run validate` 仍為 `✓ 3 週`。
- [ ] Step 4：Commit `feat(data): channel tags and proposed channels in week data`。

### Task 3: 活躍度計算

**Files:** Create `src/world/activation.ts`、`tests/unit/activation.test.ts`；Modify `src/data/buildIndex.ts`、`tests/unit/buildIndex.test.ts`。

**Interfaces — Produces:**
- `weekIntensity(week: WeekData): Record<string, { intensity: number; eventIds: string[] }>`
- `interface ChannelActivity { intensity: number; heat: number; streak: number }`
- `interface ProposalSummary { id; fromPath; toPath; fromVar; toVar; sign; mechanism; weeks: { weekId: string; evidence: string[] }[]; promoted: boolean }`
- `computeActivation(weeksAsc: WeekData[]): { byWeek: Record<string, Record<string, ChannelActivity>>; history: Record<string, { weekId: string; eventIds: string[] }[]>; proposals: ProposalSummary[] }`。`byWeek[w]` 只列出 `heat > 0.01` 的管道。
- `ArchiveIndex.channels`：上述結果

- [ ] Step 1：寫失敗測試：
  - 強度上限 3（4 則事件標同一條管道 → 3）；
  - link 計入兩端事件，同一事件只算一次；
  - 熱度：強度 1、0、2 → 1、0.5、2.25；
  - `heat ignores calendar gaps`：週次 10-16、10-30（中間缺一週）→ 熱度照排序遞迴，第二週 = 本週強度 + 0.5·第一週；
  - 連續週數 1、0、1、2；
  - 歷史列出週次與事件；
  - 提議彙總：兩週同一 id → `weeks` 長度 2，mechanism 取最近一次；提議 id 等於精選管道 id 時 `promoted: true`。
  - `buildIndex` 的結果包含 `channels`。
- [ ] Step 2：FAIL → 實作 → PASS。
- [ ] Step 3：Commit `feat(world): channel activation, heat and proposals`。

### Task 4: 舊資料回填

**Files:** Modify `data/weeks/*.json`；Test `tests/unit/realData.test.ts`。

- [ ] Step 1：寫失敗測試 `backfilled channels`：用 `computeActivation` 算三週，斷言：
  - 10-30 的 `oil-to-us-inflation` 強度為 2，熱度為 2 + 0.5·(10-23 的熱度)；
  - 10-23 的 `oil-to-us-inflation` 連續週數 = 2；
  - 10-30 的 `us-equity-to-tw-equity` 強度 ≥ 1。
- [ ] Step 2：FAIL → 依規格 §6 的表逐一標註（以 rank 對應事件、以 from/to 對應連線）→ `npm run validate` 為 `✓ 3 週`，PASS。
- [ ] Step 3：Commit 訊息列出每一處標註與依據的原文。

### Task 5: 管線繪圖層

**Files:** Create `src/render/layers/channels.ts`、`src/render/channelRoute.ts`、`tests/unit/channelRoute.test.ts`；Modify `src/render/world.ts`、`src/render/effects.ts`。

**Interfaces — Produces:**
- `channelRoute.ts`（純函式，不 import three）：
  - `sameRegion(a: string, b: string): boolean`；
  - `routeControls(a: [x, z], b: [x, z], laneIndex: number, same: boolean): { mid: [x, y, z] }`：不同地區時中點 y = 0.15，弧度為距離 × 0.18、往法線方向偏移，每條側道再錯開 1.2 單位；同地區時 y = 2.5。
  - `laneIndexes(channels: Channel[]): Map<string, number>`：同一對地區（不分方向）之間的管道依 id 排序，依序給 0、1、2…
- `WorldView` 新增：
  - `setChannelActivity(a: Record<string, ChannelActivity>, proposals: ProposalSummary[]): void`
  - `setNetworkMode(on: boolean): void`
  - `channelScreenPoint(id: string): { x: number; y: number } | null`
  - `onPick(cb: (hit: PickHit | null) => void)`，其中 `PickHit = { kind: 'node'; path: string } | { kind: 'channel'; id: string } | { kind: 'proposal'; id: string }`
- `Effects.flowAlong(channelId: string, label: string): Promise<void>`：沿管線曲線移動粒子；找不到管線時退回 `flow`。

- [ ] Step 1：寫失敗測試 `channelRoute.test.ts`：
  - `sameRegion arch`：`us/central-bank` 與 `us/bonds` → true，路線中點 y = 2.5；
  - `us/equity` 與 `tw/equity` → false，中點 y = 0.15；
  - 同一對地區的兩條管道，laneIndex 分別為 0、1，中點的水平距離 ≥ 1.2；
  - `laneIndexes` 不分方向（`us→tw` 和 `tw→us` 算同一對）。
- [ ] Step 2：FAIL → 實作 → PASS。
- [ ] Step 3：實作 `layers/channels.ts`：
  - TubeGeometry 沿 QuadraticBezierCurve3 建管；
  - 暗管、亮管、反向的「−」標記、提議虛線、流動光點，依規格 §5.1；
  - 網絡模式：所有管道套亮管樣式並顯示名稱，世界 root 底下 MeshStandardMaterial 的 opacity 降到 0.35；
  - 拾取：管線物件的 `userData.channel`，提議虛線用 `userData.proposal`；
  - 區塊或節點重建後（`setWeekFocus`、`build`）要重建管線。
- [ ] Step 4：目視驗證：dev 伺服器的 10/30 週全圖截圖：油價 → 美國通膨、美國 → 台股等亮管可見；開網絡模式時全網提亮、建築變淡。
- [ ] Step 5：Commit `feat(render): transmission pipelines layer`。

### Task 6: UI

**Files:** Create `src/ui/channelPanel.ts`；Modify `src/ui/nodePanel.ts`、`src/ui/textMode.ts`、`src/ui/app.ts`、`src/ui/styles.css`；Test `tests/unit/channelPanel.test.ts`。

**Interfaces — Produces:**
- `renderChannelPanel(id, week, index): HTMLElement`
- `renderProposalPanel(id, index): HTMLElement`
- `renderActiveChannels(weekId, index): HTMLElement`：本週點亮的管道清單，依熱度排序；元素帶 `data-channel`
- `renderProposalList(index): HTMLElement`
- 節點面板新增 `.node-channels` 區塊
- 事件：`select-channel`、`select-proposal`、`select-node`、`select-event`、`select-week`（detail `{ weekId }`）

- [ ] Step 1：寫失敗測試（jsdom）：
  - 管道面板：起點、終點名稱為按鈕；顯示「反向」或「同向」；強度符號；`數週`；機制；固定說明；本週事件按鈕；歷史週次按鈕；「持續活躍 2 週」。
  - `proposal panel renders text`：mechanism 為 `<img onerror>` 時不產生 img 元素。
  - 節點面板 `tw` 列出 `tsmc-to-tw-equity`，而且本週有亮的排在前面。
  - 文字模式列出本週點亮的管道名稱與機制。
- [ ] Step 2：FAIL → 實作 → PASS。
- [ ] Step 3：`app.ts`：
  - 頂欄加「傳導網絡」按鈕（`data-action="network"`），偏好存 localStorage；
  - 網絡模式開啟時顯示 `.channel-legend`（7 種類別色塊與「待審提議 N」按鈕）；
  - `onPick` 依 kind 分派；
  - 切週時呼叫 `setChannelActivity`；
  - 本週故事面板附上 `renderActiveChannels`；
  - 播放時，連線有 `channel` 就用 `flowAlong`；
  - 測試鉤子加 `pickChannel(id)`。
- [ ] Step 4：Commit `feat(ui): channel panel, network mode and active channels`。

### Task 7: 說明書、合成週、E2E、README

**Files:** Modify `docs/WEEKLY_DATA_GUIDE.md`、`tests/unit/guide.test.ts`、`scripts/synthetic-week.ts`、`tests/unit/syntheticWeek.test.ts`、`README.md`；Create `tests/e2e/channels.spec.ts`。

- [ ] Step 1：寫失敗測試：
  - guide 測試：每個 `CHANNELS` 的 id 都以反引號形式出現在說明書中，並包含 `proposedChannels`、`fromVar`、`evidence`、`碰到`；
  - 合成週測試：輸出的 `proposedChannels` 長度 ≤ 1，並且和其他週一起通過 `validateArchive`。
- [ ] Step 2：FAIL → 改寫說明書（依規格 §7）、合成週邏輯 → PASS。
- [ ] Step 3：E2E `channels.spec.ts`：
  - 網絡模式按鈕切換 `aria-pressed`，圖例出現；
  - `pickChannel('oil-to-us-inflation')` → 面板出現機制說明與固定說明；
  - 實際點擊 `channelScreenPoint('oil-to-us-inflation')` → 開出管道面板；
  - 本週故事面板列出 `oil-to-us-inflation`；
  - 文字模式列出「本週點亮的管道」；
  - 以 `?fast=1` 播放 10/30 直到終幕，沒有 pageerror；
  - 只在合成週存在時執行：待審提議清單列出 `synthetic-proposal`。
- [ ] Step 4：完整 E2E 跑三種情況：一般、含合成週、負載下（`--repeat-each 3 --workers 4`）。README 補上傳導網絡的說明，並換上新的截圖。
- [ ] Step 5：Commit 並推送，確認 CI 全綠。

## 執行後
- 派獨立 reviewer 審查整個分支 → 修正 → 合併到 main **之前先問使用者**。
