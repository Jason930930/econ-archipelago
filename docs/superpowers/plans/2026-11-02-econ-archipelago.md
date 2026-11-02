# 經濟群島 econ-archipelago Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把每週《財金週報》的結構化資料演成一個可互動、跨週演化的 3D 經濟群島，並由既有排程每週自動餵入。

**Architecture:** 純邏輯層（`src/data`、`src/world`、`src/story`、`src/ui/route.ts`）不依賴 DOM／Three.js，全部以 Vitest TDD；`src/render` 只吃已計算好的 `VisualParams` 與指令；`src/ui` 組裝畫面。資料是 `data/weeks/*.json`，build 前由腳本驗證並產生索引，GitHub Actions 驗證→測試→建置→部署 Pages。

**Tech Stack:** Node 22、Vite、TypeScript、Three.js、ajv（JSON Schema draft 2020-12）、tsx（跑腳本）、Vitest、@playwright/test 1.63.0（對應環境內建 Chromium）。

**Spec:** `docs/superpowers/specs/2026-11-02-econ-archipelago-design.md`

## Global Constraints

- 所有依賴鎖定**確切版本**（不用 `^`／`~`），且每個版本的發布日至少早於安裝日 14 天（以 `npm view <pkg> time --json` 確認）；`@playwright/test` 固定 `1.63.0`。
- 介面文字一律繁體中文。
- 免責聲明常駐，文字固定：`僅為資訊整理，不構成任何買賣或個人化投資建議。`
- 漲跌配色預設台股慣例（紅漲綠跌），可切換國際慣例；偏好存 localStorage key `econ-archipelago:colorMode`，值 `tw` | `intl`，讀寫一律 try/catch。
- 無外部美術素材；所有 3D 幾何以程式生成。
- 資料中的文字一律以 `textContent` 寫入 DOM，絕不用 `innerHTML` 插入資料內容。
- 所有來源 URL 必須是 https，且不得含 `google.com/url?q=`。
- 版面在 375px 寬無水平捲動，左右邊距 16px。
- Vite `base` 為 `/econ-archipelago/`（GitHub Pages 子路徑）。
- 不修改既有排程的 (a)(b) 行為，只在 Task 12 追加內容。

## Review Focus

1. **週檔的 `links` 有循環或完全沒有** → 播放仍需完整走完 5 則事件，依 `rank` 排序，不可卡住或遺漏（Task 6 測試 `orderEvents falls back to rank on cycle`）。
2. **第一週就缺某指標**（如回填週沒有 btc）→ 畫面顯示中性預設並標「無資料」，而非 0 或 NaN（Task 3 測試 `marks missing when no prior week`、Task 5 測試 `missing indicator yields neutral param`）。
3. **事件文字含 `<script>`、`&`、超長標題** → 原樣以文字顯示、版面不爆（Task 9 測試 `renders data as text not HTML`）。
4. **深層連結指向不存在的週或事件** → 回到最新一週並顯示提示，不白畫面（Task 6 測試 `parseHash invalid event`、Task 11 E2E `invalid deep link`）。
5. **WebGL 不可用**（老舊瀏覽器、headless 無 GPU）→ 自動進文字模式且內容完整（Task 11 E2E `falls back to text mode without WebGL`）。

---

## File Structure

```
package.json / tsconfig.json / vite.config.ts / vitest.config.ts / playwright.config.ts
.gitignore                         node_modules, dist, data/index.json, public/data/
index.html
schema/week.schema.json
data/weeks/2026-10-16.json, 2026-10-23.json, 2026-10-30.json
src/world/entities.ts              實體清單（唯一來源）
src/data/types.ts                  WeekData 等型別
src/data/urls.ts                   Google 轉址拆除
src/data/validate.ts               schema + 語意驗證
src/data/indicators.ts             補值／stale
src/data/buildIndex.ts             ArchiveIndex
src/world/visualParams.ts          指標→視覺參數、情緒→天氣、補間
src/story/order.ts                 因果排序
src/story/player.ts                播放狀態機
src/ui/route.ts                    hash 解析／產生
src/render/scene.ts                場景、相機、光影、天氣
src/render/islands.ts              島嶼與地標幾何
src/render/effects.ts              粒子、漣漪、旗幟、事件動畫
src/render/world.ts                WorldView 對外介面
src/ui/app.ts                      組裝、狀態、路由
src/ui/eventCard.ts / timeline.ts / controls.ts / textMode.ts / entityPanel.ts
src/ui/styles.css
src/main.ts
scripts/validate.ts / scripts/build-index.ts
tests/unit/*.test.ts、tests/fixtures/*.json、tests/e2e/*.spec.ts
docs/WEEKLY_DATA_GUIDE.md
.github/workflows/deploy.yml
```

---

### Task 1: 專案骨架、實體清單與型別

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore`, `index.html`, `src/main.ts`（暫時只 `console.log`）
- Create: `src/world/entities.ts`, `src/data/types.ts`
- Test: `tests/unit/entities.test.ts`

**Interfaces:**
- Produces:
  - `type IslandId = 'us'|'tw'|'kr'|'me'|'eu'|'jp'|'cn'|'gold'|'crypto'|'sea'|'port'`
  - `interface EntityDef { id: EntityId; name: string; island: IslandId; kind: 'bank'|'exchange'|'bonds'|'tech'|'fab'|'memory'|'oil'|'industry'|'vault'|'crypto'|'sea'|'board'; position: [x: number, z: number]; covers: string }`
  - `const ENTITIES: readonly EntityDef[]`、`const ENTITY_IDS: readonly EntityId[]`、`type EntityId`（字面量聯集：spec §2.1 的 17 個 id）、`function getEntity(id: EntityId): EntityDef`
  - `src/data/types.ts`：`IndicatorKey = 'brent'|'wti'|'fedFunds'|'us10y'|'sp500'|'nasdaq'|'dow'|'taiex'|'cpiYoY'|'gold'|'btc'|'usdtwd'`；`INDICATOR_KEYS: readonly IndicatorKey[]`；`Indicator { value: number; range?: [number, number]; unit?: string; changePct?: number|null; note?: string }`；`TaiwanImpact { summary: string; direction: -1|0|1; channels: string[] }`；`WeekEvent`、`CausalLink { from; to; label }`、`StorylineDef { id; name }`、`WatchItem { date: string|null; text; entities: EntityId[]; confirmed: boolean }`、`WeekData`——欄位與 spec §3.2 完全一致。
  - npm scripts：`dev`、`build`（`npm run validate && npm run index && vite build`）、`test`（`vitest run`）、`validate`（`tsx scripts/validate.ts`）、`index`（`tsx scripts/build-index.ts`）、`e2e`（`playwright test`）。

- [ ] **Step 1:** `npm init`，依 Global Constraints 安裝確切版本：`three`、`@types/three`、`vite`、`typescript`、`vitest`、`ajv`、`tsx`、`@playwright/test@1.63.0`。`engines.node` 設 `>=22`。
- [ ] **Step 2: 寫失敗測試** `tests/unit/entities.test.ts`：
  ```ts
  test('has exactly the 17 spec entities', () => {
    expect([...ENTITY_IDS].sort()).toEqual(['crypto','cn-industry','eu-ecb','global','gold-vault','jp-boj','kr-memory','me-oil','sea-hormuz','sea-pacific','tw-cbc','tw-fab','tw-twse','us-bonds','us-fed','us-tech','us-wallst'].sort());
  });
  test('ids unique and positions distinct', () => { /* Set 大小 = 長度；任兩個 position 距離 >= 1.5 */ });
  test('kr-memory is on island kr with kind memory', ...);
  ```
- [ ] **Step 3:** `npm test` → FAIL（模組不存在）。
- [ ] **Step 4:** 實作 `entities.ts`（座標自訂，島嶼大致地理相對位置：美國在東、台灣韓國日本中國在西側成群、中東在南西、歐洲在北西；航道實體座標落在海上）與 `types.ts`。
- [ ] **Step 5:** `npm test` → PASS；`npx tsc --noEmit` 無錯誤。
- [ ] **Step 6:** Commit `chore: scaffold project, entity registry and data types`。

---

### Task 2: JSON Schema 與驗證器（含 Google 轉址拆除）

**Files:**
- Create: `schema/week.schema.json`, `src/data/urls.ts`, `src/data/validate.ts`, `scripts/validate.ts`
- Test: `tests/unit/validate.test.ts`, `tests/unit/urls.test.ts`, `tests/fixtures/valid-week.json`

**Interfaces:**
- Consumes: `ENTITY_IDS`, `INDICATOR_KEYS`, `WeekData`
- Produces:
  - `unwrapGoogleRedirect(url: string): string` — 若為 `https://www.google.com/url?q=<X>&...` 回傳 decode 後的 `<X>`，否則原樣回傳。
  - `interface ValidationError { file: string; path: string; message: string }`
  - `validateWeek(raw: unknown, fileName: string, knownStorylines: ReadonlySet<string>): ValidationError[]`
  - `validateArchive(files: { fileName: string; raw: unknown }[]): ValidationError[]` — 依檔名排序逐週驗證；`knownStorylines` 累積「較早週」與「本週」定義的主線。
  - CLI `scripts/validate.ts [dir=data/weeks]`：印出每筆 `file path: message`，有錯 exit 1，無錯印 `✓ N 週資料驗證通過` exit 0。

- [ ] **Step 1: 寫失敗測試** `urls.test.ts`：Gmail 範例 `https://www.google.com/url?q=https://finance.yahoo.com/a.html&source=gmail&ust=1&sa=E` → `https://finance.yahoo.com/a.html`；非轉址原樣回傳。
- [ ] **Step 2: 寫失敗測試** `validate.test.ts`：`valid-week.json`（檔名 `2026-10-30.json`）回傳 `[]`；以下各自複製 fixture 改一處，斷言至少一個錯誤且 `path` 指向該處：
  - 未知實體 `"tw-memory"`；`primaryEntity` 不在 `entities`
  - `weekId` ≠ 檔名；`period.end` ≠ `weekId`；`start > end`
  - `rank` 重複、`rank` 不從 1 連續
  - `events[].id` 重複；`links` 指向不存在事件；`from === to`
  - `sentiment` 為 4 或 1.5；`taiwanImpact.direction` 為 2
  - URL 為 `http://`；URL 含 `google.com/url?q=`
  - 引用未定義主線；但同一主線在**較早週**有定義時通過（用 `validateArchive` 兩檔測）
  - 缺 `indicators` 中任一鍵仍通過；`indicators` 有未知鍵（如 `eth`）失敗
- [ ] **Step 3:** `npm test` → FAIL。
- [ ] **Step 4:** 寫 `schema/week.schema.json`（draft 2020-12，`additionalProperties: false`，實體 id 用 enum，`sentiment` integer -3..3）。實作 `validate.ts`：ajv 結構錯誤轉 `ValidationError`（`path` 用 ajv `instancePath`），結構通過才跑語意檢查。
- [ ] **Step 5: 加測試** `schema entity enum equals ENTITY_IDS`、`schema indicator keys equal INDICATOR_KEYS`（讀 schema 檔比對，防止兩份清單漂移）。
- [ ] **Step 6:** `npm test` → PASS；`npm run validate -- tests/fixtures` 對只含 valid fixture 的暫存目錄輸出 `✓`。
- [ ] **Step 7:** Commit `feat: week JSON schema and validator`。

---

### Task 3: 指標補值與索引產生

**Files:**
- Create: `src/data/indicators.ts`, `src/data/buildIndex.ts`, `scripts/build-index.ts`
- Test: `tests/unit/indicators.test.ts`, `tests/unit/buildIndex.test.ts`

**Interfaces:**
- Consumes: `WeekData`, `IndicatorKey`, `INDICATOR_KEYS`
- Produces:
  - `type ResolvedIndicator = { status: 'fresh'|'stale'|'missing'; value: number|null; changePct: number|null; range?: [number,number]; note?: string; fromWeek: string|null }`
  - `type ResolvedIndicators = Record<IndicatorKey, ResolvedIndicator>`
  - `resolveIndicators(weeksAsc: WeekData[]): ResolvedIndicators[]`（與輸入同序）
  - `interface ArchiveIndex { weeks: { weekId: string; title: string; period: {start;end} }[]; storylines: { id: string; name: string; events: { weekId: string; eventId: string; title: string }[] }[]; indicators: Record<string /*weekId*/, ResolvedIndicators> }`
  - `buildIndex(weeks: WeekData[]): ArchiveIndex`（內部先依 weekId 升冪排序）
  - CLI `scripts/build-index.ts`：讀 `data/weeks/*.json` → 寫 `data/index.json`、`public/data/index.json`，並複製週檔到 `public/data/weeks/`。前端只讀 `public/data/`。

- [ ] **Step 1: 寫失敗測試** `indicators.test.ts`：
  - `marks fresh when present`：第 2 週有 brent 113 → `{status:'fresh', value:113, fromWeek:'2026-10-30'}`
  - `carries forward as stale`：第 2 週缺 brent、第 1 週 100 → `{status:'stale', value:100, fromWeek:'2026-10-23'}`
  - `stale changePct is null`：沿用的值 `changePct` 為 `null`（不沿用上週漲跌幅）
  - `marks missing when no prior week`：首週缺 btc → `{status:'missing', value:null, fromWeek:null}`
- [ ] **Step 2: 寫失敗測試** `buildIndex.test.ts`：輸入亂序兩週 → `weeks` 升冪；主線同 id 兩週名稱不同 → 取最早週名稱；`storylines[].events` 依週次排序。
- [ ] **Step 3:** `npm test` → FAIL。
- [ ] **Step 4:** 實作。
- [ ] **Step 5:** `npm test` → PASS。
- [ ] **Step 6:** Commit `feat: indicator carry-forward and archive index`。

---

### Task 4: 回填 3 期週報

**Files:**
- Create: `data/weeks/2026-10-16.json`, `data/weeks/2026-10-23.json`, `data/weeks/2026-10-30.json`
- Test: `tests/unit/realData.test.ts`

**Interfaces:**
- Consumes: `validateArchive`、`unwrapGoogleRedirect`、spec §3.3 規則
- Produces: 3 個通過驗證的週檔（後續 UI、E2E 的資料來源）

來源：Gmail 主旨「財金週報（…）」三封信——thread `1a14a9382fbd2042`（10/10–10/16，主旨含【測試寄送】）、`1a16b675983f3696`（10/17–10/23）、`1a18f73e92462c61`（10/24–10/30）。用 Gmail `get_thread`（PLAIN_TEXT）讀取。

- [ ] **Step 1: 寫失敗測試** `realData.test.ts`：讀 `data/weeks/` 全部檔案 → `validateArchive` 回傳 `[]`；檔案數 ≥ 3；每週 `events.length === 5`。
- [ ] **Step 2:** `npm test` → FAIL（無檔案）。
- [ ] **Step 3:** 逐期轉檔，規則：
  - `title` 保留原主旨（10/10 那期含「【測試寄送】」）；`what`／`why`／`discrepancy` 用週報原文（`備註：` 段落併入 `discrepancy`）。
  - `taiwanImpact` 只在週報原文明確提到台灣時填，`summary` 改寫自原文；否則 `null`。
  - `indicators` 只填週報中有出現的數字；報價不一致時填 `range` 與 `note`，`value` 取週報明示採用的值，未明示則取區間中點。
  - `links` 只連週報原文有寫到因果的事件（如「能源價格推升通膨與升息預期」）。
  - 所有 URL 經 `unwrapGoogleRedirect`。
  - 跨三週使用一致的主線 id（例：`fed-hiking-cycle`、`hormuz-tension`、`ai-capex`）。
  - 週報中的旁註事件（如 10/30 那期幣安駭客、比特幣）放進所屬事件的 `metrics`，`entities` 加 `crypto`。
- [ ] **Step 4:** `npm run validate` → `✓ 3 週資料驗證通過`；`npm test` → PASS。
- [ ] **Step 5:** Commit `data: backfill three weekly reports`。

---

### Task 5: 世界狀態——指標→視覺參數、情緒→天氣、補間

**Files:**
- Create: `src/world/visualParams.ts`
- Test: `tests/unit/visualParams.test.ts`

**Interfaces:**
- Consumes: `ResolvedIndicators`、`WeekEvent`
- Produces:
  - `type Weather = 'sunny'|'cloudy'|'overcast'|'storm'`
  - `interface VisualParams { oilFlame: number; tankers: number; fedBeam: number; bondFloors: number; wallst: Light; twse: Light; cpiHaze: number; goldGlow: number; cryptoFlicker: number; cbcFlag: number; weather: Weather; sentimentScore: number; status: Partial<Record<IndicatorKey, 'stale'|'missing'>> }`
  - `interface Light { trend: -1|0|1; intensity: number }`（0..1）
  - `computeVisualParams(ind: ResolvedIndicators, events: WeekEvent[]): VisualParams`
  - `sentimentScore(events: WeekEvent[]): number` — 權重 `N + 1 - rank` 的加權平均
  - `sentimentToWeather(score: number): Weather` — `score >= 0.5` sunny；`>= -0.5` cloudy；`>= -1.5` overcast；否則 storm
  - `lerpVisualParams(a: VisualParams, b: VisualParams, t: number): VisualParams` — 數值線性插值、整數欄位四捨五入、`weather`／`trend`／`status` 在 `t >= 0.5` 時取 b

映射表（`linear(v, lo, hi)` = clamp((v-lo)/(hi-lo), 0, 1)；缺值 → 中性值）：

| 參數 | 來源 | 公式 | 缺值 |
|---|---|---|---|
| oilFlame | brent | linear(v, 60, 140) | 0.5 |
| tankers | brent | round(2 + 6·oilFlame) | 5 |
| fedBeam | fedFunds | linear(v, 0, 6) | 0.5 |
| bondFloors | us10y | round(3 + 9·linear(v, 2, 6)) | 7 |
| wallst | nasdaq.changePct，無則 sp500 | trend = sign（\|x\|<0.1 為 0）；intensity = linear(\|x\|, 0, 3) | {0, 0} |
| twse | taiex.changePct | 同上 | {0, 0} |
| cpiHaze | cpiYoY | linear(v, 1, 6) | 0 |
| goldGlow | gold | linear(v, 2000, 5000) | 0.5 |
| cryptoFlicker | btc.changePct | linear(\|x\|, 0, 10) | 0 |
| cbcFlag | usdtwd | linear(v, 28, 34) | 0.5 |

- [ ] **Step 1: 寫失敗測試**：
  - brent 113 → `oilFlame ≈ 0.6625`、`tankers === 6`；brent 200 → `oilFlame === 1`（clamp）
  - us10y 5.05 → `bondFloors === 10`
  - nasdaq changePct -2.86 → `wallst = {trend:-1, intensity≈0.953}`
  - `missing indicator yields neutral param`：全部 missing → 各欄等於表中「缺值」，且 `status.brent === 'missing'`
  - stale brent → `status.brent === 'stale'`，數值仍照 value 計算
  - 情緒：rank1..5 sentiment `[-2,-1,-2,-2,-1]` → score `(-10-4-6-4-1)/15 ≈ -1.667` → `storm`；邊界 0.5→sunny、-0.5→cloudy、-1.5→overcast
  - `lerpVisualParams(a,b,0) 等於 a`、`t=1 等於 b`、`t=0.5` 的 oilFlame 為平均
- [ ] **Step 2:** `npm test` → FAIL。
- [ ] **Step 3:** 實作。
- [ ] **Step 4:** `npm test` → PASS。
- [ ] **Step 5:** Commit `feat: indicator-to-visual mapping and weather`。

---

### Task 6: 因果排序、播放狀態機、深層連結

**Files:**
- Create: `src/story/order.ts`, `src/story/player.ts`, `src/ui/route.ts`
- Test: `tests/unit/order.test.ts`, `tests/unit/player.test.ts`, `tests/unit/route.test.ts`

**Interfaces:**
- Consumes: `WeekData`
- Produces:
  - `orderEvents(week: WeekData): string[]` — Kahn 拓撲排序，每次從入度 0 的事件中取 `rank` 最小者；若偵測到循環，整週退回純 `rank` 排序。
  - `type Step = { kind: 'event'; eventId: string } | { kind: 'finale' }`
  - `buildSteps(week: WeekData): Step[]` — `orderEvents` 結果加上最後一個 `finale`
  - `interface PlayerState { steps: Step[]; index: number /* -1 = 未開始 */; playing: boolean; speed: 1|2 }`
  - `type PlayerAction = {type:'play'}|{type:'pause'}|{type:'next'}|{type:'prev'}|{type:'goto'; eventId: string}|{type:'setSpeed'; speed:1|2}|{type:'reset'}`
  - `playerReducer(s: PlayerState, a: PlayerAction): PlayerState` — `next` 在最後一步時 `playing=false` 並停在 finale；`prev` 最小到 0；`play` 在 `index=-1` 時跳到 0；`goto` 未知 id 則不變。
  - `STEP_DURATION_MS = 6000`；`stepDuration(speed: 1|2, fast: boolean): number` — fast 時固定 300，否則 `6000 / speed`
  - `type Route = { weekId: string; eventId: string|null; invalid: boolean }`
  - `parseHash(hash: string, weekIds: string[], eventIdsOf: (weekId: string) => string[]): Route` — 格式 `#/<weekId>` 或 `#/<weekId>/<eventId>`；空 hash → 最新週、`invalid:false`；週不存在 → 最新週、`invalid:true`；事件不存在 → 該週、`eventId:null`、`invalid:true`
  - `toHash(r: { weekId: string; eventId: string|null }): string`

- [ ] **Step 1: 寫失敗測試** `order.test.ts`：
  - links `e3→e5, e5→e2`、rank e1..e5 → `['e1','e3','e4','e5','e2']`
  - 無 links → `['e1'..'e5']`
  - `orderEvents falls back to rank on cycle`：`e1→e2, e2→e1` → `['e1'..'e5']`
  - 結果長度永遠等於事件數
- [ ] **Step 2: 寫失敗測試** `player.test.ts`：`stepDuration(1,false)===6000`、`stepDuration(2,false)===3000`、`stepDuration(2,true)===300`；play 從 -1 到 0；連續 next 到 finale 後 `playing === false`；prev 在 0 不變；goto `e4` 跳到其索引；goto 未知 id 不變。
- [ ] **Step 3: 寫失敗測試** `route.test.ts`：`#/2026-10-23/e2` 解析正確；`parseHash invalid event`（`#/2026-10-23/e9` → `{weekId:'2026-10-23', eventId:null, invalid:true}`）；未知週 → 最新週 invalid；空字串 → 最新週 valid；`toHash` 與 `parseHash` 互逆。
- [ ] **Step 4:** `npm test` → FAIL。
- [ ] **Step 5:** 實作三個模組。
- [ ] **Step 6:** `npm test` → PASS。
- [ ] **Step 7:** Commit `feat: causal ordering, player state machine, deep-link routing`。

---

### Task 7: 3D 場景——島嶼、地標、視覺參數、拾取、鏡頭

**Files:**
- Create: `src/render/scene.ts`, `src/render/islands.ts`, `src/render/world.ts`
- Modify: `src/main.ts`（暫時直接以最新週的 VisualParams 建立世界，供目視）
- Test: `tests/unit/world-api.test.ts`（只測不需 WebGL 的部分：`supportsWebGL` 對 mock canvas 回傳 false）

**Interfaces:**
- Consumes: `ENTITIES`、`EntityId`、`VisualParams`、`lerpVisualParams`
- Produces（`src/render/world.ts`）：
  ```ts
  export function supportsWebGL(canvas?: HTMLCanvasElement): boolean;
  export interface WorldView {
    setParams(p: VisualParams): void;
    tweenTo(p: VisualParams, ms: number): Promise<void>;   // 每幀以 lerpVisualParams 套用
    flyTo(id: EntityId, ms?: number): Promise<void>;       // 正交相機平移＋縮放
    resetCamera(ms?: number): Promise<void>;
    highlight(ids: EntityId[]): void;                       // 空陣列 = 取消
    setColorMode(m: 'tw'|'intl'): void;                     // tw：漲紅跌綠
    setLowPower(on: boolean): void;                         // 關陰影、粒子數 ×0.3
    onPick(cb: (id: EntityId|null) => void): void;
    onHover(cb: (id: EntityId|null, screen: {x:number;y:number}) => void): void;
    effects: Effects;                                       // Task 8
    dispose(): void;
  }
  export function createWorld(canvas: HTMLCanvasElement): WorldView;
  ```

視覺規格：
- 正交相機，俯角約 35°、方位角 45°；拖曳平移、滾輪／雙指縮放（縮放倍率 0.5–3）。
- 每座島：低多邊形扁平六角／不規則多邊形擠出，頂面草地色、側面沙土色；海面為大平面加緩慢起伏頂點動畫。
- 地標以 `kind` 決定外型：bank＝柱廊建築＋頂部光柱（高度 = fedBeam）；exchange＝大樓＋窗戶發光材質（顏色依 trend 與 colorMode，亮度依 intensity）；bonds＝堆疊樓層（層數 = bondFloors）；fab／memory＝廠房＋煙囪；oil＝油井＋火焰錐（縮放 = oilFlame）；vault＝金色方塊＋光暈 sprite；crypto＝懸浮八面體閃爍；sea＝海上浮標與航線曲線；board＝港口看板。
- stale／missing 地標：材質飽和度降低 50%，並在 hover 標籤顯示「沿用上週」／「無資料」。
- 天氣：sunny 暖白方向光；cloudy 加雲朵 mesh；overcast 降低光強＋灰霧；storm 深灰霧＋雨線粒子＋偶發閃電（環境光脈衝）。cpiHaze 控制美國島上方的半透明暖色霧片。
- 拾取：Raycaster 對地標群組，命中回傳 `EntityId`。

- [ ] **Step 1: 寫失敗測試** `supportsWebGL returns false when getContext returns null`。
- [ ] **Step 2:** `npm test` → FAIL；實作 → PASS。
- [ ] **Step 3:** 實作場景與 `WorldView`（除 `effects`）。
- [ ] **Step 4: 目視驗證**：`npm run dev`，用 Playwright 腳本截圖 `http://localhost:5173/econ-archipelago/` 到 scratchpad，確認 9 座島與 17 個地標可見、10/30 週為 storm 天氣、油田火焰明顯；滾輪縮放與點擊地標在 console 印出 id。
- [ ] **Step 5:** Commit `feat: procedural 3D archipelago with landmarks driven by visual params`。

---

### Task 8: 演出特效——事件動畫、因果粒子、台灣漣漪、旗幟

**Files:**
- Create: `src/render/effects.ts`
- Modify: `src/render/world.ts`（掛上 `effects`）

**Interfaces:**
- Consumes: `EntityDef.kind`、`EntityDef.position`
- Produces：
  ```ts
  export interface Effects {
    pulse(id: EntityId, sentiment: number): Promise<void>;          // 依 kind 的事件動畫，約 1.5s；負面偏紅/暗、正面偏亮
    flow(from: EntityId, to: EntityId, label: string): Promise<void>; // 粒子沿二次貝茲弧線流動約 2s，弧頂顯示 label（CSS2D 標籤）
    ripple(direction: -1|0|1, summary: string): Promise<void>;       // 從當前焦點擴散到 tw-twse，顏色依 direction 與 colorMode，顯示 summary
    showFlags(items: { entity: EntityId; text: string; confirmed: boolean }[]): void; // 未確認者旗面加「未確認」
    clear(): void;
  }
  ```
  `flow` 的 from/to 是兩則事件各自的 `primaryEntity`；兩者相同時改畫原地環狀脈衝。

- [ ] **Step 1:** 實作 `effects.ts`。所有 Promise 在 `clear()` 後立即 resolve（避免切週時卡住播放）。
- [ ] **Step 2: 目視驗證**：在 dev 頁面 console 依序呼叫 `pulse('me-oil',-2)`、`flow('me-oil','us-fed','油價推升通膨')`、`ripple(-1,'牽動半導體供應鏈')`、`showFlags([...])`，截圖確認；`clear()` 後畫面無殘留。
- [ ] **Step 3:** Commit `feat: storytelling effects`。

---

### Task 9: UI 外殼——事件卡、地標面板、文字模式、配色切換

**Files:**
- Create: `src/ui/eventCard.ts`, `src/ui/entityPanel.ts`, `src/ui/textMode.ts`, `src/ui/styles.css`, `src/ui/dom.ts`
- Modify: `index.html`
- Test: `tests/unit/eventCard.test.ts`（Vitest `environment: 'jsdom'`；需加裝 `jsdom` 確切版本）

**Interfaces:**
- Consumes: `WeekEvent`、`getEntity`、`ResolvedIndicators`、`ArchiveIndex`
- Produces:
  - `el(tag: string, attrs?: Record<string,string>, ...children: (Node|string)[]): HTMLElement`（`dom.ts`；字串一律成為 Text node）
  - `renderEventCard(ev: WeekEvent, opts: { index: number; total: number }): HTMLElement` — 區塊順序：標題、日期與相關地標名稱、「發生了什麼」、「為什麼重要」、`metrics` 表、「對台灣的影響」（null 時整塊不顯示）、「數據出入」（null 時不顯示；有時加虛線框）、來源連結（`target=_blank rel=noopener`）
  - `renderEntityPanel(id: EntityId, week: WeekData, index: ArchiveIndex): HTMLElement` — 本週相關事件清單（可點，觸發 `CustomEvent('select-event', {detail:{eventId}})`）＋相關指標近 12 週 SVG 迷你走勢圖（stale 點空心、missing 斷線）
  - `renderTextMode(week: WeekData, order: string[]): HTMLElement` — 依播放順序列出所有事件卡、因果連線文字、下週值得關注
  - 版面：頂欄（週標題＋免責聲明＋文字模式切換＋配色切換）、右側面板 `aside.panel`（寬 ≥ 768px 時固定右側 380px；以下改底部 sheet，可拖到 40%/85% 高度）、底部 `footer.timeline`。

實體與指標的對應（面板走勢圖用）：`me-oil→brent`、`us-fed→fedFunds`、`us-bonds→us10y`、`us-wallst→nasdaq,sp500`、`tw-twse→taiex`、`gold-vault→gold`、`crypto→btc`、`tw-cbc→usdtwd`；其餘無圖。

- [ ] **Step 1: 寫失敗測試** `eventCard.test.ts`：
  - `renders data as text not HTML`：title 為 `<img src=x onerror=alert(1)>` → 卡片內 `querySelector('img') === null` 且 `textContent` 含原字串
  - `taiwanImpact` 為 null → 無「對台灣的影響」標題
  - `discrepancy` 有值 → 存在 `.discrepancy` 元素
  - 來源連結 `rel` 含 `noopener`
- [ ] **Step 2:** `npm test` → FAIL；實作 → PASS。
- [ ] **Step 3:** 樣式：CSS 變數定義淺色／深色（`prefers-color-scheme`），字體系統 `-apple-system, "PingFang TC", "Noto Sans TC", sans-serif`；漲跌色以 `--up`／`--down` 變數，依 `html[data-color-mode]` 切換。
- [ ] **Step 4:** Commit `feat: event card, entity panel, text mode`。

---

### Task 10: 組裝——資料載入、時間軸與主線軌道、播放控制、路由

**Files:**
- Create: `src/ui/app.ts`, `src/ui/timeline.ts`, `src/ui/controls.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: 前面所有 Produces
- Produces: `startApp(root: HTMLElement): Promise<void>`

行為：
1. 載入 `import.meta.env.BASE_URL + 'data/index.json'`，再載入目前週檔（快取已載入週）。載入失敗 → 頁面顯示「資料載入失敗」與重試按鈕。
2. `supportsWebGL()` 為 false 或使用者選了文字模式 → 只顯示 `renderTextMode`；否則建立 `WorldView`。行動裝置（`matchMedia('(pointer: coarse)')` 或寬 < 768）→ `setLowPower(true)`。
3. 路由：`hashchange` → `parseHash`；`invalid` 時顯示 3 秒提示「找不到該連結，已回到最新一週」並 `history.replaceState` 修正 hash。選事件時更新 hash。
4. 切週：`effects.clear()` → `playerReducer reset` → `tweenTo(新週參數, 2000)`。
5. 播放：每步 `stepDuration(speed, fast)`（`fast` = `new URLSearchParams(location.search).has('fast')`，僅供 E2E 縮短時長）；event 步驟依序 `flyTo(primaryEntity)` → `pulse` → 顯示事件卡 → 若有 `taiwanImpact` 則 `ripple` → 若下一步也是事件且兩者有 link 則 `flow(本事件 primaryEntity, 下一事件 primaryEntity, link.label)`；finale → `resetCamera` → `showFlags(watchlist)`，面板顯示「下週值得關注」。暫停時不推進計時。
6. 時間軸（`timeline.ts`）：週次刻度（顯示 `MM/DD`）、目前週高亮、主線軌道（每條主線一列，該週有事件則畫點，點擊點 → 跳到該週該事件）；寬度不足時可水平捲動**於時間軸內部**（頁面本身不捲）。
7. hover 地標時顯示浮動標籤：地標名稱＋相關指標目前值（stale 加「沿用上週」、missing 顯示「無資料」）；點擊地標 → 面板顯示 `renderEntityPanel`。
8. 點擊主線名稱 → `highlight(該主線本週事件的 entities)`，時間軸上同主線的點全部高亮；再點一次取消。
9. 控制列（`controls.ts`）：▶／⏸、上一則、下一則、速度 1×／2×、重置鏡頭；鍵盤：空白鍵播放暫停、←／→ 上下一則。

- [ ] **Step 1:** 實作。
- [ ] **Step 2: 目視驗證**：`npm run build && npx vite preview`，用 Playwright 截圖：桌機 1440×900 與手機 375×812 各一張的初始畫面、播放到第 3 則、finale；確認 375 寬 `document.documentElement.scrollWidth === 375`。
- [ ] **Step 3:** Commit `feat: wire up app, timeline, playback and routing`。

---

### Task 11: E2E 煙霧測試與部署流程

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: 建置後的網站（`vite preview`，port 4173）
- Produces: CI 綠燈即部署 GitHub Pages

`playwright.config.ts`：`webServer: { command: 'npm run build && npx vite preview --port 4173', url: 'http://localhost:4173/econ-archipelago/' }`；本機若 `PW_CHROMIUM_PATH` 存在則以它為 `launchOptions.executablePath`（環境為 `/opt/pw-browsers/chromium`），CI 則用 `npx playwright install --with-deps chromium`。

- [ ] **Step 1: 寫 E2E 測試** `smoke.spec.ts`：
  - `loads world`：canvas 存在且寬高 > 0；頂欄含免責聲明全文
  - `switches week`：點時間軸第一週 → 標題含 `2026/10/10`
  - `plays to finale`：開 `?fast=1`，按 ▶ → 最終面板出現「下週值得關注」
  - `deep link`：開 `#/2026-10-30/e3` → 面板標題為該事件標題
  - `invalid deep link`：開 `#/2099-01-01/e1` → 顯示「找不到該連結」且標題為最新週
  - `falls back to text mode without WebGL`：`addInitScript` 讓 `HTMLCanvasElement.prototype.getContext` 回傳 null → 頁面無 canvas，且出現 5 張事件卡（最新週）
  - `no horizontal scroll on mobile`：viewport 375×812 → `scrollWidth <= 375`
- [ ] **Step 2:** `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e` → 全部 PASS。
- [ ] **Step 3:** 寫 `deploy.yml`：觸發 `push: branches [main]` 與 `workflow_dispatch`；job `build`：checkout → setup-node 22（cache npm）→ `npm ci` → `npm run validate` → `npm test` → `npx playwright install --with-deps chromium` → `npm run e2e` → `npm run build` → `actions/upload-pages-artifact`（path `dist`）；job `deploy`：`needs: build`、`permissions: pages: write, id-token: write`、`actions/deploy-pages`。action 版本固定到主版號 tag（`actions/checkout@v4` 等）。
- [ ] **Step 4:** Commit `ci: e2e smoke tests and GitHub Pages deploy`；push 後以 `gh run list --repo Jason930930/econ-archipelago` 確認 workflow 成功、`gh api repos/Jason930930/econ-archipelago/pages` 取得網址並以 Playwright 開啟確認。若 Pages 未啟用，請使用者在 Settings → Pages 將 Source 設為 GitHub Actions。

---

### Task 12: 排程說明書與排程 prompt 更新

**Files:**
- Create: `docs/WEEKLY_DATA_GUIDE.md`, `README.md`
- Test: `tests/unit/guide.test.ts`

**Interfaces:**
- Consumes: `ENTITIES`、`INDICATOR_KEYS`、schema、`data/weeks/2026-10-30.json`（作範例）
- Produces: 排程每週可照做的說明書；更新後的排程 `trig_016gUrfm4KMeX7SJcUDzL9zb`

`WEEKLY_DATA_GUIDE.md` 內容：
1. 目的與檔名規則（`data/weeks/<週五 YYYY-MM-DD>.json`）。
2. 實體清單表（id、名稱、涵蓋範圍），附「對應原則」：每則事件 `primaryEntity` 選最直接受衝擊者；跨國事件把各國地標都放進 `entities`；真的對應不到才用 `global`。
3. 指標鍵表（鍵、單位、取哪個報價）。
4. 欄位規則（照搬 spec §3.3 的四條），強調：`taiwanImpact` 僅依週報原文；`links` 只連週報有寫明的因果；`sentiment` 判準（-3 重大利空 … +3 重大利多）。
5. 主線：先 `npm run index` 再讀 `data/index.json` 的 `storylines`，能沿用就沿用。
6. 完整範例：嵌入 `data/weeks/2026-10-30.json`。
7. 流程與失敗處理：照 spec §5.1 第 4 點（重試 2 次、失敗推 `data/week-<日期>` 分支）。
8. commit 訊息格式：`data: week <週五日期>`。

- [ ] **Step 1: 寫失敗測試** `guide.test.ts`：說明書中出現每一個 `ENTITY_IDS` 與 `INDICATOR_KEYS`（防止新增實體後忘了更新說明書）。
- [ ] **Step 2:** `npm test` → FAIL；寫說明書 → PASS。
- [ ] **Step 3:** 寫 `README.md`：專案介紹（作品集用，附 Pages 連結與截圖）、架構圖（文字）、本機開發指令、資料流程。
- [ ] **Step 4:** Commit `docs: weekly data guide and README`，push。
- [ ] **Step 5:** 以 `get_trigger` 讀取排程目前 prompt，在**原文不刪改**的前提下：
  - 第 3 點格式在「為什麼重要」之後加一行「對台灣的影響（1 句；若無明確影響寫『無直接影響』）」。
  - 在 (b) 之後追加 (c)，內容依 spec §5.1：`add_repo(owner: Jason930930, repo: econ-archipelago, access: push)` → clone → 閱讀並遵守 `docs/WEEKLY_DATA_GUIDE.md` → 產生週檔 → `npm ci && npm run validate` → 通過推 main、失敗依說明書處理 → SendUserMessage 結尾附「世界更新：成功（Pages 連結）／失敗（原因、分支名）」；並註明 (c) 失敗不影響 (a)(b)，且週報未產出時跳過 (c)。
  - 用 `update_trigger` 只更新 `prompt`。更新前把新舊 prompt 差異給使用者看並取得同意。
- [ ] **Step 6: 演練（不觸發排程，避免寄信）**：在本 session 依照新 prompt 的 (c) 與說明書，對 10/30 週報重新產生一份 JSON 到暫存分支，`npm run validate` 通過，與 Task 4 的 `2026-10-30.json` 比對結構差異（主線 id 一致、實體選擇合理），確認說明書足以讓另一個 session 照做。演練分支刪除，不合併。

---

## 執行後驗收（對照 spec §1 成功標準）

- [ ] Pages 網址可開，三週可切換，10/30 週可從第一則播放到「下週值得關注」。
- [ ] 每張事件卡可見數據、數據出入、對台灣的影響（有時）、來源連結。
- [ ] 時間軸拖換週時世界漸變；主線軌道可跳轉。
- [ ] CI 綠燈；故意推一份壞週檔到測試分支，`npm run validate` 失敗並列出原因。
- [ ] 排程 prompt 已更新；下一次 11/07（六）08:52 執行後檢查是否新增 `data/weeks/2026-11-06.json` 並自動部署。
