# 完整狀態鏡像 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 36 個傳導節點都有狀態（水準、方向、日期、來源）：FRED 每日自動更新、週報補定性判斷，以徽章、狀態卡、總覽呈現。

**Architecture:** 純邏輯的來源表與狀態計算（`src/world/stateSources.ts`、`src/world/state.ts`）在建置索引時把 `data/state/fred.json` 與週檔算成 `ArchiveIndex.state`；每日 GitHub Actions 抓 FRED、提交檔案並觸發部署；畫面只讀索引。

**Tech Stack:** TypeScript、Vite、Three.js（CSS2D 徽章）、ajv、Vitest（jsdom）、Playwright、GitHub Actions。

**Spec:** `docs/superpowers/specs/2026-11-02-state-mirror-design.md`

## Global Constraints

- 水準切點：百分位 ≥ 80 高、≤ 20 低；5 年視窗；最少 26 週點或 24 月點，否則 level = null。
- 方向：日資料回看 28 天、月資料回看 3 個月；門檻 0.5 × 同間隔變化標準差（標準差 0 時任何非零變化都算）；週報指標 4 週內最早週值、門檻 1%。
- 新鮮度：FRED 日資料 ≤ 14 天、月資料 ≤ 75 天為 fresh；定性沿用 1–7 週 aging、≥ 8 週 stale。
- 徽章顏色：低 `#4a90d9`、中 `#8a96a3`、高 `#e0a030`；顯示門檻 zoom ≥ 1.8 或網絡模式；地區層節點永遠顯示。
- 固定說明原文：「高／中／低為相對過去 5 年的位置，不代表好壞，也不是預測。」；來源說明原文：「部分數據來自 FRED（聖路易聯邦準備銀行），各指數版權屬原提供者。」
- 建置與測試不連網；所有週檔文字以 textContent 寫入。
- 提交訊息結尾附 Co-Authored-By 與 Claude-Session 兩行；不在程式碼放模型名稱。

## Review Focus

1. **`data/state/fred.json` 不存在或某序列缺漏** → 建置成功，FRED 節點顯示「未知」（Task 4 測試 `missing fred file leaves fred nodes unknown`）。
2. **月資料正常落後約 6 週**（例：CPI 9 月值在 11/2 才是最新）→ 仍為 fresh（Task 4 測試 `monthly series 60 days old is fresh`）。
3. **看的那週早於序列有足夠歷史**（樣本 < 26）→ level 與 percentile 為 null、不報錯（Task 4 測試 `short history gives null level`）。
4. **排程在 nodeStates 填了 FRED 節點** → 驗證失敗並說明該節點的資料來源（Task 3 測試 `fred node in nodeStates is rejected with its source`）。
5. **反向序列**：USD/JPY 上升 → 日圓水準下降、方向 ↓（Task 4 測試 `inverted series flips level and direction`）。

---

### Task 1: 來源表與 fred.json 格式

**Files:** Create `src/world/stateSources.ts`、`schema/fred.schema.json`、`src/data/fredFile.ts`、`tests/unit/stateSources.test.ts`、`tests/fixtures/fred.json`；Modify `scripts/validate.ts`。

**Interfaces — Produces:**
- `stateSources.ts`：`type NodeSource`（規格 §2.1）、`NODE_SOURCES: Record<string, NodeSource>`、`sourceOf(nodeId): NodeSource`（找不到丟錯）、`FRED_SERIES: string[]`（去重）、`isQualitative(nodeId): boolean`、`fredUrl(series) = 'https://fred.stlouisfed.org/series/' + series`。
- `fredFile.ts`：`interface FredFile { fetchedAt: string; series: Record<string, { cadence: 'daily'|'monthly'; latest: [string, number]; samples: [string, number][] }> }`；`checkSeries(id, s): string[]`（回傳問題清單：非有限數、日期非遞增、超出 sane、無點）；`validateFredFile(raw): string[]`（schema + 每個序列 checkSeries + `FRED_SERIES` 都存在）。

- [ ] Step 1：寫失敗測試：來源表恰好涵蓋 `CHANNEL_NODES` 的 36 個 id；FRED 16、週報指標 2（gold、taiex）、定性 18；`jp.yen`、`intl.risk-appetite`、`tw.twd` 為 invert；`us.inflation`、`ez.inflation` 為 yoy；`validateFredFile(fixture)` 為空；日期倒序、NaN、超出 sane、缺序列各自回報。
- [ ] Step 2：FAIL → 實作（fixture 為 16 個序列各 30 點左右的合成資料，數值落在 sane 內）→ PASS。
- [ ] Step 3：`scripts/validate.ts`：`data/state/fred.json` 存在時呼叫 `validateFredFile`，有問題就失敗；不存在時印「（尚無 data/state/fred.json）」。`npm run validate` 仍為 `✓ 3 週`。
- [ ] Step 4：Commit `feat(state): node source table and FRED file format`。

### Task 2: FRED 抓取腳本與首次資料

**Files:** Create `scripts/fetch-fred.ts`、`tests/unit/fetchFred.test.ts`、`data/state/fred.json`（真實資料）。

**Interfaces — Produces:**
- `parseFredCsv(text): [string, number][]`（略過 `.`、表頭）
- `weeklySamples(points, cadence): [string, number][]`（日資料：每週五當天或之前的最後一點，保留觀測日；月資料原樣）
- `fetchAll(opts: { fetchText(url): Promise<string>; previous: FredFile | null; now: Date }): Promise<{ file: FredFile | null; warnings: string[] }>`：每序列失敗或 `checkSeries` 不過 → 沿用 previous 的該序列並加警告；全部失敗 → `file: null`。
- CLI：讀既有檔當 previous，`fetchText` 用全域 fetch（逾時 30 秒、重試 2 次）；`file === null` 時結束代碼 1。

- [ ] Step 1：寫失敗測試：CSV 解析；週五取樣（含跨週假日）；單一序列失敗沿用 previous；壞資料（超出 sane）被擋並沿用；全部失敗回傳 null；`cosd` 參數為 6 年前。
- [ ] Step 2：FAIL → 實作 → PASS。
- [ ] Step 3：實際執行 `npx tsx scripts/fetch-fred.ts`，確認 16 個序列、檔案約 60 KB、`npm run validate` 通過。
- [ ] Step 4：Commit `feat(state): FRED fetch script and first snapshot`。

### Task 3: 週資料 nodeStates、說明書與回填

**Files:** Modify `schema/week.schema.json`、`src/data/types.ts`、`src/data/validate.ts`、`tests/unit/validate.test.ts`、`tests/fixtures/valid-week.json`、`docs/WEEKLY_DATA_GUIDE.md`、`tests/unit/guide.test.ts`、`data/weeks/*.json`、`tests/unit/realData.test.ts`。

**Interfaces — Produces:** `interface NodeStateEntry { node: string; level: 'high'|'mid'|'low'; direction: 1|0|-1; basis: string; evidence: string[] }`；`WeekData.nodeStates?: NodeStateEntry[]`。

- [ ] Step 1：寫失敗測試（驗證器，錯誤路徑 `/nodeStates/<i>/...`）：未知節點；`fred node in nodeStates is rejected with its source`（`us.long-yield` → 訊息含 `DGS10`）；週報指標節點（`intl.gold`）被拒；同節點重複（第二筆 `/nodeStates/1/node`）；空 basis；evidence 不存在；evidence 碰不到節點路徑；合法一筆通過。guide 測試：包含 `nodeStates`、每個定性節點 id（反引號）、「不要手動沿用」。realData：10/23 `tw.foreign-flow` 為 low。
- [ ] Step 2：FAIL → 實作 schema、型別、驗證器 → 說明書第 12 節（規格 §8）與第 2 節結構 → 依規格 §7 回填（含 10/23 e2 補 places）→ 重新嵌入第 10 節範例 → PASS，`npm run validate` 為 `✓ 3 週`。
- [ ] Step 3：Commit（訊息列出每筆回填與原文依據）。

### Task 4: 狀態計算與索引

**Files:** Create `src/world/state.ts`、`tests/unit/state.test.ts`；Modify `src/data/buildIndex.ts`、`scripts/build-index.ts`（或目前產生索引的腳本）、`tests/unit/buildIndex.test.ts`。

**Interfaces — Produces:**
- `NodeState`、`StateSource`、`Freshness`（規格 §2）
- `numericState(nodeId, src: FredSource, s: FredFile['series'][string] | undefined, ref: string): NodeState`
- `reportNumericState(nodeId, src, weeksAsc: WeekData[], resolved: ResolvedIndicators[], i: number): NodeState`
- `qualitativeStates(weeksAsc): Record<string, NodeState>[]`（與 weeksAsc 對齊）
- `computeState(weeksAsc, fred: FredFile | null): ArchiveIndex['state']`
- `stateTransitions(prev: Record<string, NodeState>, cur: Record<string, NodeState>, limit = 5): { node: string; kind: 'level' | 'direction'; from: string; to: string }[]`
- `buildIndex(weeks, seed, fred?: FredFile | null)`：第三個參數可省略。

- [ ] Step 1：寫失敗測試：百分位（20 個等差點的最後一點 = 100 → 高）；80／20 切點邊界；`short history gives null level`；方向門檻與標準差 0；YoY；`inverted series flips level and direction`；`monthly series 60 days old is fresh`、日資料 15 天為 stale；`missing fred file leaves fred nodes unknown`；週報指標（金價週數 < 26 → level null、變化 ≥ 1% 才有方向）；定性：本週 fresh、沿用 aging 與 carriedWeeks、≥ 8 週 stale、從未 unknown；`latest` 用 fetchedAt；`series` 只含最近 2 年；`stateTransitions` 排序與上限；`buildIndex` 含 `state`。
- [ ] Step 2：FAIL → 實作 → PASS；`npm run index` 後 `data/index.json` 的 `state.latest['us.long-yield'].value` 為 FRED 最新值。
- [ ] Step 3：Commit `feat(state): node state computation in the index`。

### Task 5: 狀態徽章

**Files:** Create `src/render/layers/stateBadges.ts`、`src/render/stateBadge.ts`（純函式）、`tests/unit/stateBadge.test.ts`；Modify `src/render/world.ts`、`src/ui/styles.css`。

**Interfaces — Produces:**
- `stateBadge.ts`：`LEVEL_COLORS`、`badgeText(s: NodeState): string`（↑ → ↓ ·；未知 ?）、`badgeLabel(name, s): string`（aria-label）、`badgeTooltip(name, s, src): string`、`badgeVisible(nodePath, zoom, network): boolean`
- `WorldView.setNodeStates(states: Record<string, NodeState>): void`；徽章點擊走 `onPick({ kind: 'node', path })`；滑過走既有 tooltip（`onHover` 加第三個參數 `extra?: string`）。

- [ ] Step 1：寫失敗測試：箭頭與未知文字；aria-label；tooltip 內容（數值、百分位、日期）；`badgeVisible`（地區層永遠、其他依 zoom 1.8 或網絡模式）。
- [ ] Step 2：FAIL → 實作純函式 → PASS → 實作圖層（同路徑並排、stale 虛線半透明、重建時清掉 DOM）並接到 world。
- [ ] Step 3：目視：拉近台灣與美國，徽章清楚、不擋建築名稱；網絡模式全顯示。
- [ ] Step 4：Commit `feat(render): node state badges`。

### Task 6: UI

**Files:** Create `src/ui/stateCard.ts`、`tests/unit/stateCard.test.ts`；Modify `src/ui/nodePanel.ts`、`src/ui/channelPanel.ts`、`src/ui/textMode.ts`、`src/ui/app.ts`、`src/ui/hover.ts`、`src/ui/styles.css`。

**Interfaces — Produces:** `renderStateCard(nodeId, state, index, opts?: { compact?: boolean }): HTMLElement`、`renderNodeStates(path, states, index, weekId): HTMLElement | null`（`.node-states`）、`renderWorldState(states, index): HTMLElement`（`.world-state`，每列 `data-node`、事件 `select-node`）、`renderTransitions(list, index): HTMLElement | null`、`stateChip(state): HTMLElement`；`statesFor(weekId, index)`：最新週用 `latest`，其他用 `byWeek`。

- [ ] Step 1：寫失敗測試（jsdom）：卡片含數值與單位、反向註記「數值越高日圓越弱」、FRED 連結 href、百分位文字、固定說明；定性卡含 basis 與事件按鈕、「沿用 N 週前」；`basis renders as text`（含 `<img onerror>` 不產生元素）；總覽 36 列與摘要數字相加 = 36、來源說明；轉變清單；管道面板端點小標；文字模式「世界狀態」段落；節點面板 `tw` 列出 9 個台灣節點。
- [ ] Step 2：FAIL → 實作 → PASS。
- [ ] Step 3：app：頂欄「世界狀態」按鈕（`data-action="state"`）、切週時 `setNodeStates(statesFor(...))`、本週故事面板加轉變清單、節點面板與管道面板帶入狀態、測試鉤子 `nodeState(id)`。
- [ ] Step 4：Commit `feat(ui): state cards, world state overview and transitions`。

### Task 7: 每日工作流程、合成週、E2E、README

**Files:** Create `.github/workflows/fred.yml`、`tests/e2e/state.spec.ts`；Modify `scripts/synthetic-week.ts`、`tests/unit/syntheticWeek.test.ts`、`README.md`。

- [ ] Step 1：寫失敗測試：合成週 rank 1 加一筆碰得到的定性節點狀態（找不到就略過），並與檔案庫一起通過 `validateArchive`。
- [ ] Step 2：FAIL → 實作 → PASS。
- [ ] Step 3：`fred.yml` 依規格 §3.3；以 `actionlint`（若可用）或 YAML 解析檢查語法。
- [ ] Step 4：E2E `state.spec.ts`：拉近台灣後徽章出現、點徽章開出狀態卡；總覽 36 列、點一列飛到節點；文字模式「世界狀態」；只在合成週存在時：演練狀態出現在 rank 1 事件碰到的節點卡上。
- [ ] Step 5：完整 E2E 三種情況（一般、合成週、`--repeat-each 3 --workers 4`）；README 加「完整狀態鏡像」段落、每日更新流程圖、資料來源說明與新截圖。
- [ ] Step 6：Commit、推送，確認 CI 全綠。

## 執行後
- 派獨立 reviewer 審查整個分支 → 修正 → 合併到 main **之前先問使用者**。
- 合併後手動觸發 `fred.yml` 一次並確認提交與部署。
