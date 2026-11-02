# 世界骨架 v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把經濟群島改成以真實地理位置與 GDP 比例排列的 17 個地區，採用「地區 → 部門 → 實體」三層路徑模型與 6 層繪圖元件，資料格式升級到 v2，並讓排程能自行新增實體。

**Architecture:** 純邏輯放在 `src/world/`（地區、部門、路徑、投影、版面、實體清單、指標綁定）與 `src/data/`（v2 schema、驗證、遷移、索引），全部用 Vitest 以 TDD 開發。`src/render/` 改成以 `WorldGraph` 為中心的節點樹，`layers/`、`landmarks/`、`gauges/` 各自只負責一層。UI 與特效一律用路徑定位。

**Tech Stack:** 沿用現有：TypeScript、Vite、Three.js 0.186.1、ajv、Vitest 5.0.5、@playwright/test 1.63.0。不新增依賴。

**Spec:** `docs/superpowers/specs/2026-11-02-world-skeleton-v2-design.md`（v1 規格：`docs/superpowers/specs/2026-11-02-econ-archipelago-design.md`）

## Global Constraints

- 不新增任何 npm 依賴。
- 介面文字一律繁體中文；免責聲明文字不變：`僅為資訊整理，不構成任何買賣或個人化投資建議。`
- 資料中的文字（包含排程新增的實體名稱）一律以 `textContent` 寫入 DOM 或 CSS2D 標籤。
- 路徑格式：1 到 3 段，以 `/` 分隔，每段符合 `^[a-z0-9]+(-[a-z0-9]+)*$`。
- 地區 17 個、部門 18 種，清單與錨點、GDP 以規格 §2.2、§3.2 為準；GDP 只用來決定比例，畫面上一律標示「約略值」。
- 人物不設實體。
- 全圖說明文字固定為：`島嶼大小約與 GDP 成正比（約略值）；為避免重疊，相鄰島嶼位置略有偏移。`
- 版面計算必須是確定性的（不使用 `Math.random`）；同樣的輸入每次產生相同的位置與外觀。
- 驗證器（`npm run validate`）是排程與 CI 唯一的資料閘門；CI 不得有驗證器以外的資料規則。
- v1 已有的功能（播放、時間軸、主線、分享連結、文字模式、手機版、配色切換、驗證與 CI）不得退化：v1 的 E2E 全部繼續通過（可以調整選擇器）。
- 程式、schema、資料、種子清單、說明書在同一次合併中切換到 v2。

## Review Focus

1. **事件指到一個「沒有被畫出來」的實體**（區塊超過 4 棟時被省略的實體）→ 鏡頭、脈衝、粒子要落在它所屬的區塊，不可報錯或飛到原點（Task 7 測試 `nearest falls back to the district for an unrendered entity`）。
2. **排程新增的實體和既有實體只差大小寫或空白**（例如 `"TSMC "` 對上別名 `tsmc`）→ 驗證失敗並指出衝突對象（Task 3 測試 `rejects alias collision ignoring case and spaces`）。
3. **小島被引用很多部門**（例如台灣的島在最小半徑下要放 10 個區塊）→ 區塊不重疊、不超出島緣（Task 2 測試 `slots never overlap or leave the island`）。
4. **排程新增的實體名稱含 HTML**（`<img onerror>`）→ 世界標籤、面板、麵包屑都以文字顯示（Task 10 測試 `entity label renders name as text`、Task 11 測試 `breadcrumb renders names as text`）。
5. **事件只寫到地區層**（`primary: "us"`）→ 鏡頭飛到整座島、脈衝畫在島中心、面板顯示地區資訊（Task 7 測試 `nearest returns the region node for a region path`、Task 12 E2E `region-level event plays`）。

---

## File Structure

```
src/world/
  regions.ts          地區清單（第 1 層）           新增
  sectors.ts          部門清單與允許表（第 2 層）    新增
  paths.ts            路徑工具                       新增
  geo.ts              投影                           新增
  layout.ts           島嶼大小與鬆弛版面             新增
  districts.ts        區塊集合、格位、實體挑選        新增
  registry.ts         實體清單合併、名稱正規化、標籤   新增
  indicators.ts       指標綁定表與世界參數            新增（取代 entityIndicators.ts、visualParams.ts）
  entities.ts / entityIndicators.ts / visualParams.ts   刪除
src/data/
  types.ts            v2 型別                        修改
  validate.ts         v2 驗證                        修改
  buildIndex.ts       加入 entities、mentions、districts   修改
schema/week.schema.json   v2                         修改
data/world/entities.json  種子實體                    新增
data/weeks/*.json         遷移成 v2                   修改
scripts/migrate-v1-to-v2.ts                          新增
scripts/build-index.ts / validate.ts / synthetic-week.ts   修改
src/render/
  graph.ts            WorldGraph 與 WorldNode 介面    新增
  layers/{ocean,islandTerrain,districtPlot,district,labels,shipping}.ts   新增
  landmarks/{index,bank,exchange,bonds,tech,fab,memory,oil,industry,crypto,sea,board,government,trade,fx,finance,commodities,realEstate,consumer}.ts   新增（前 11 種由 islands.ts 拆出）
  entityBuilding.ts   實體建築自動生成                 新增
  gauges/{index,flame,beam,stack,lightBand,halo,flicker,flag,haze}.ts   新增
  effects.ts          改用路徑                        修改
  scene.ts            世界尺寸、鏡頭範圍              修改
  world.ts            改用 WorldGraph                 修改
  islands.ts          刪除
src/ui/
  nodePanel.ts        取代 entityPanel.ts，含麵包屑   新增
  eventCard.ts / textMode.ts / app.ts / styles.css   修改
docs/WEEKLY_DATA_GUIDE.md   改寫成 v2                 修改
```

---

### Task 1: 世界模型——地區、部門、路徑、投影

**Files:**
- Create: `src/world/regions.ts`, `src/world/sectors.ts`, `src/world/paths.ts`, `src/world/geo.ts`
- Test: `tests/unit/worldModel.test.ts`

**Interfaces:**
- Produces:
  - `REGION_IDS`（17 個，順序同規格 §2.2）、`type RegionId`、`ECONOMY_IDS`（15 個非虛擬地區）
  - `interface RegionDef { id: RegionId; name: string; anchor: { lat: number; lon: number } | null; gdp: number | null; virtual: boolean; defaultSectors: SectorId[] }`
  - `REGIONS: readonly RegionDef[]`、`getRegion(id: RegionId): RegionDef`、`isRegionId(s: string): s is RegionId`
  - `GDP_NOTE: string`，內容為「IMF《世界經濟展望》<年月> 名目 GDP 估計，約略值」，其中年月填實際查證的版本
  - `SECTOR_IDS`（18 個，順序同規格 §3.2）、`type SectorId`、`type Archetype`（18 種，名稱同部門 id）
  - `interface SectorDef { id: SectorId; name: string; archetype: Archetype; allowed: 'economy' | 'economy+intl' | 'seas' | 'intl' }`
  - `SECTORS`、`getSector(id)`、`isSectorId(s)`、`isSectorAllowed(region: RegionId, sector: SectorId): boolean`
  - `interface ParsedPath { region: string; sector?: string; entity?: string; depth: 1 | 2 | 3 }`
  - `parsePath(s: string): ParsedPath | null`（只檢查格式，不檢查是否存在）、`formatPath(p: { region: string; sector?: string; entity?: string }): string`
  - `parentOf(path: string): string | null`、`ancestorsOf(path: string): string[]`（由近到遠，不含自己）、`isWithin(path: string, root: string): boolean`（包含相等）
  - `WORLD_SCALE = 0.29`、`CENTER_LON = 150`、`project(lat: number, lon: number): [x: number, z: number]`

- [ ] **Step 1：查證 GDP。** 用 WebSearch 查 IMF WEO 最新一版的 2025 年名目 GDP（美、中、歐元區合計、日、印、英、加、巴、俄、韓、澳、墨、東協合計、海灣合作理事會合計、台灣）。四捨五入到 0.1 兆美元。若與規格 §2.2 差超過 15%，以查證值為準，並在 ledger 記一條 Ruling。
- [ ] **Step 2：寫失敗測試** `worldModel.test.ts`：
  ```ts
  test('17 regions incl. seas and intl', () => expect(REGION_IDS).toHaveLength(17));
  test('15 economies have anchor and gdp', () => ECONOMY_IDS.forEach((id) => { const r = getRegion(id); expect(r.anchor).not.toBeNull(); expect(r.gdp!).toBeGreaterThan(0); }));
  test('russia anchored near Moscow', () => expect(getRegion('ru').anchor).toEqual({ lat: 55.7, lon: 37.6 }));
  test('18 sectors', () => expect(SECTOR_IDS).toHaveLength(18));
  test('sector permissions', () => {
    expect(isSectorAllowed('seas', 'shipping-lane')).toBe(true);
    expect(isSectorAllowed('us', 'shipping-lane')).toBe(false);
    expect(isSectorAllowed('intl', 'organization')).toBe(true);
    expect(isSectorAllowed('intl', 'commodities')).toBe(true);
    expect(isSectorAllowed('intl', 'equity')).toBe(false);
    expect(isSectorAllowed('jp', 'real-estate')).toBe(true);
    expect(isSectorAllowed('tw', 'organization')).toBe(false);
  });
  test('default sectors are allowed for their region', ...); // 每個地區的 defaultSectors 都通過 isSectorAllowed
  test('parsePath', () => {
    expect(parsePath('tw/semiconductor/tsmc')).toEqual({ region: 'tw', sector: 'semiconductor', entity: 'tsmc', depth: 3 });
    expect(parsePath('us')).toEqual({ region: 'us', depth: 1 });
    for (const bad of ['', 'US', 'a//b', 'a/b/c/d', 'tw/semi_conductor', '/tw', 'tw/']) expect(parsePath(bad)).toBeNull();
  });
  test('ancestors and within', () => {
    expect(ancestorsOf('tw/semiconductor/tsmc')).toEqual(['tw/semiconductor', 'tw']);
    expect(parentOf('tw')).toBeNull();
    expect(isWithin('tw/semiconductor/tsmc', 'tw')).toBe(true);
    expect(isWithin('tw', 'tw')).toBe(true);
    expect(isWithin('twx/a', 'tw')).toBe(false);
  });
  test('projection centres the pacific', () => {
    expect(project(0, 150)).toEqual([0, -0]);
    const [ukX] = project(54, -2); const [brX] = project(-10, -52); const [twX] = project(23.7, 121);
    expect(ukX).toBeLessThan(twX); expect(twX).toBeLessThan(brX);
    expect(project(10, 0)[1]).toBeCloseTo(-2.9);   // 北緯為負 z
    expect(Math.abs(project(0, -30.0001)[0])).toBeCloseTo(180 * 0.29, 1); // 換日邊界
  });
  ```
- [ ] **Step 3：** `npm test -- worldModel` → FAIL（模組不存在）。
- [ ] **Step 4：** 實作四個檔案。資料照規格 §2.2、§3.2（GDP 用 Step 1 的值）。`project` 中 `wrap(d) = ((d + 180) % 360 + 360) % 360 - 180`。
- [ ] **Step 5：** `npm test -- worldModel` → PASS；`npx tsc --noEmit` 無錯。
- [ ] **Step 6：** Commit `feat(world): regions, sectors, paths and projection`。

---

### Task 2: 島嶼版面與區塊格位

**Files:**
- Create: `src/world/layout.ts`, `src/world/districts.ts`
- Test: `tests/unit/layout.test.ts`

**Interfaces:**
- Consumes: `REGIONS`、`project`、`SECTOR_IDS`、`SectorId`、`RegionId`
- Produces:
  - `ISLAND_K = 1.7`、`ISLAND_R_MIN = 2.0`、`ISLAND_GAP = 0.8`
  - `interface IslandLayout { center: [number, number]; radius: number; enlarged: boolean; anchor: [number, number] }`
  - `layoutIslands(): Map<RegionId, IslandLayout>`（不含 `seas`；結果在模組內快取）
  - `districtsFor(region: RegionId, referenced: Iterable<SectorId>): SectorId[]`：預設部門加上被引用的合法部門，依 `SECTOR_IDS` 順序排列並去重
  - `districtSlots(radius: number, n: number): { offsets: [number, number][]; plot: number }`
  - `pickVisibleEntities(candidates: { id: string; mentioned: number }[], inWeek: Set<string>, max = 4): string[]`：先選本週被提到的，再依歷史提及次數由多到少，最後依 id 字母序

鬆弛演算法：在單元測試確定結果之前，實作者需要這段：
```
pos = anchor（project 的結果）；strength = 1，台灣為 4
重複 300 次：
  依 REGION_IDS 順序檢查每一對 (i, j)：
    重疊量 = ri + rj + GAP − 距離；若 > 0，沿兩者連線推開，
    i 移動 重疊量 × sj/(si+sj)，j 移動 重疊量 × si/(si+sj)
    （距離為 0 時，沿 +x 方向推開）
  每座島朝自己的錨點拉回 0.04 × strength × (anchor − pos)
```

- [ ] **Step 1：寫失敗測試** `layout.test.ts`：
  ```ts
  const L = layoutIslands(); const c = (id: RegionId) => L.get(id)!.center;
  test('radius follows sqrt(gdp) with a minimum', () => {
    expect(L.get('us')!.radius).toBeCloseTo(1.7 * Math.sqrt(getRegion('us').gdp!));
    expect(L.get('tw')!.radius).toBe(2.0); expect(L.get('tw')!.enlarged).toBe(true);
    expect(L.get('us')!.enlarged).toBe(false);
  });
  test('no two islands overlap', ...); // 每一對：距離 ≥ ri + rj + 0.8 − 1e-6
  test('deterministic', () => expect([...layoutIslands()]).toEqual([...L]));
  test('compass relations survive relaxation', () => {
    expect(c('jp')[0]).toBeGreaterThan(c('kr')[0]);                                       // 日本在韓國東方
    expect(c('tw')[0]).toBeGreaterThan(c('cn')[0]); expect(c('tw')[1]).toBeGreaterThan(c('cn')[1]); // 台灣在中國東南
    expect(c('au')[1]).toBeGreaterThan(c('asean')[1]);                                    // 澳洲在東南亞南方
    expect(c('ca')[1]).toBeLessThan(c('us')[1]); expect(c('mx')[1]).toBeGreaterThan(c('us')[1]);
    expect(c('ru')[0]).toBeGreaterThan(c('ez')[0]); expect(c('ez')[0]).toBeGreaterThan(c('uk')[0]);
    expect(c('in')[0]).toBeLessThan(c('cn')[0]); expect(c('br')[1]).toBeGreaterThan(c('us')[1]);
  });
  test('taiwan stays close to its real position', () => {
    const tw = L.get('tw')!; expect(Math.hypot(tw.center[0] - tw.anchor[0], tw.center[1] - tw.anchor[1])).toBeLessThanOrEqual(3.5);
  });
  test('districtsFor adds referenced sectors in canonical order', () => {
    expect(districtsFor('jp', ['real-estate', 'central-bank'])).toEqual(['central-bank', 'equity', 'bonds', 'fx', 'industry', 'real-estate']);
    expect(districtsFor('tw', ['shipping-lane' as SectorId])).not.toContain('shipping-lane'); // 不合法的忽略
  });
  test('slots never overlap or leave the island', () => {
    for (const r of [2.0, 3.3, 9.3]) for (let n = 1; n <= 18; n++) {
      const { offsets, plot } = districtSlots(r, n);
      expect(offsets).toHaveLength(n);
      offsets.forEach(([x, z]) => expect(Math.hypot(x, z) + plot / 2).toBeLessThanOrEqual(r * 0.92));
      // 任兩個 offset 的距離 ≥ plot * 1.05
    }
  });
  test('pickVisibleEntities priority', () => {
    expect(pickVisibleEntities([{ id: 'b', mentioned: 9 }, { id: 'a', mentioned: 1 }, { id: 'z', mentioned: 0 }, { id: 'c', mentioned: 9 }, { id: 'd', mentioned: 5 }], new Set(['z']))).toEqual(['z', 'b', 'c', 'd']);
  });
  ```
- [ ] **Step 2：** `npm test -- layout` → FAIL。
- [ ] **Step 3：** 實作。`districtSlots`：n = 1 時放中心；其餘依序填入同心圓（第 k 圈容量為 `floor(2π·ringRadius / (plot·1.05))`），`plot = min(1.6, 能讓 n 個格位放進 0.92r 的最大值)`，用二分搜尋求得。
- [ ] **Step 4：** `npm test -- layout` → PASS。若「台灣 ≤ 3.5」或方位測試失敗，只能調整強度、迭代次數、GAP，不可放寬斷言；在 ledger 記錄最後採用的常數。
- [ ] **Step 5：** Commit `feat(world): GDP-scaled island layout and district slots`。

---

### Task 3: 實體清單（種子、合併、名稱衝突、標籤）

**Files:**
- Create: `src/world/registry.ts`, `data/world/entities.json`
- Test: `tests/unit/registry.test.ts`

**Interfaces:**
- Consumes: `parsePath`、`isRegionId`、`isSectorId`、`isSectorAllowed`、`getRegion`、`getSector`
- Produces:
  - `interface EntityRecord { id: string; name: string; region: RegionId; sector: SectorId; aliases: string[]; addedIn: string; geo?: { lat: number; lon: number } }`
  - `type NewEntity = Omit<EntityRecord, 'addedIn'>`
  - `normalizeName(s: string): string`（NFKC 正規化 → 轉小寫 → 移除所有空白）
  - `interface EntityIssue { index: number; field: 'id' | 'name' | 'aliases' | 'region' | 'sector' | 'geo'; message: string }`
  - `checkNewEntities(existing: EntityRecord[], added: NewEntity[]): EntityIssue[]`
  - `mergeRegistry(seed: EntityRecord[], weeks: { weekId: string; newEntities?: NewEntity[] }[]): EntityRecord[]`（週次升冪；週檔新增的實體 `addedIn = weekId`）
  - `resolvePath(path: string, entities: EntityRecord[]): { ok: true } | { ok: false; reason: string }`：檢查地區、部門的允許表；第 3 段必須是 region 與 sector 都相符的實體
  - `labelOf(path: string, entities: EntityRecord[]): string[]`：例如 `['台灣', '半導體', '台積電']`；查不到的段落直接用原字串

- [ ] **Step 1：寫種子** `data/world/entities.json`，內容依規格 §3.3：
  - 公司：台積電 `tw/semiconductor/tsmc`（aliases `["TSMC","2330"]`）、Intel `us/semiconductor/intel`、Nvidia `us/semiconductor/nvidia`、AMD `us/semiconductor/amd`、Qualcomm `us/semiconductor/qualcomm`、Meta `us/tech/meta`、Alphabet `us/tech/alphabet`（aliases `["Google"]`）、Amazon `us/tech/amazon`、Apple `us/tech/apple`、Palantir `us/tech/palantir`、CoreWeave `us/tech/coreweave`、Arm `uk/tech/arm`、波克夏 `us/finance/berkshire`（aliases `["Berkshire Hathaway"]`）、Samsung `kr/memory/samsung`（aliases `["三星"]`）、SK Hynix `kr/memory/sk-hynix`（aliases `["SK 海力士"]`）
  - 組織與資產：幣安 `intl/crypto/binance`、比特幣 `intl/crypto/bitcoin`（aliases `["BTC"]`）、OPEC `intl/organization/opec`（aliases `["OPEC+"]`）、黃金 `intl/commodities/gold`
  - 航道（都要附 `geo`）：荷莫茲海峽 `hormuz`（26.5, 56.3）、麻六甲海峽 `malacca`（2.5, 101.5）、紅海與蘇伊士 `red-sea`（20, 38.5）、巴拿馬運河 `panama`（9, −79.6）、台灣海峽 `taiwan-strait`（24, 119.5）、太平洋航線 `pacific`（25, −170）
  - 所有種子的 `addedIn` 為 `"seed"`。
- [ ] **Step 2：寫失敗測試** `registry.test.ts`：
  ```ts
  const seed = JSON.parse(readFileSync('data/world/entities.json', 'utf8')) as EntityRecord[];
  test('seed passes its own checks', () => expect(checkNewEntities([], seed)).toEqual([]));
  test('seas entities need geo', () => expect(checkNewEntities(seed, [{ id: 'bosporus', name: '博斯普魯斯', region: 'seas', sector: 'shipping-lane', aliases: [] }])[0]!.field).toBe('geo'));
  test('rejects duplicate id', ...);
  test('rejects alias collision ignoring case and spaces', () => {
    const issues = checkNewEntities(seed, [{ id: 'tsmc-2', name: 'T S M C ', region: 'tw', sector: 'semiconductor', aliases: [] }]);
    expect(issues[0]).toMatchObject({ field: 'name' }); expect(issues[0]!.message).toContain('台積電');
  });
  test('rejects disallowed region/sector', () => expect(checkNewEntities(seed, [{ id: 'x', name: 'X', region: 'tw', sector: 'organization', aliases: [] }])[0]!.field).toBe('sector'));
  test('rejects bad id slug', ...); // 'Foo_Bar'
  test('collisions inside the same batch are caught', ...);
  test('mergeRegistry stamps addedIn and keeps order', ...);
  test('resolvePath', () => {
    expect(resolvePath('tw/semiconductor/tsmc', seed)).toEqual({ ok: true });
    expect(resolvePath('us/semiconductor/tsmc', seed).ok).toBe(false);   // 實體所屬地區不符
    expect(resolvePath('jp/real-estate', seed)).toEqual({ ok: true });
    expect(resolvePath('tw/shipping-lane', seed).ok).toBe(false);
    expect(resolvePath('xx', seed).ok).toBe(false);
  });
  test('labelOf', () => expect(labelOf('tw/semiconductor/tsmc', seed)).toEqual(['台灣', '半導體', '台積電']));
  ```
- [ ] **Step 3：** `npm test -- registry` → FAIL。
- [ ] **Step 4：** 實作。每筆 issue 的 message 要指名衝突對象，例如 `名稱「T S M C」與既有實體「台積電」(tsmc) 的別名重複`。
- [ ] **Step 5：** PASS 後 commit `feat(world): entity registry with seed and collision checks`。

---

### Task 4: v2 型別、schema 與驗證器

**Files:**
- Modify: `src/data/types.ts`, `schema/week.schema.json`, `src/data/validate.ts`, `tests/fixtures/valid-week.json`（改成 v2）
- Test: `tests/unit/validate.test.ts`（改寫）

**Interfaces:**
- Consumes: `EntityRecord`、`NewEntity`、`checkNewEntities`、`resolvePath`、`REGION_IDS`
- Produces:
  - `WeekEvent`：移除 `primaryEntity`、`entities`；新增 `primary: string`、`places: string[]`
  - `WatchItem`：`entities` 改名為 `places: string[]`
  - `WeekData`：`schemaVersion: 2`；新增 `newEntities?: NewEntity[]`
  - `validateWeek(raw: unknown, fileName: string, ctx: { knownStorylines: ReadonlySet<string>; entities: EntityRecord[] }): ValidationError[]`
  - `validateArchive(files, seed: EntityRecord[]): ValidationError[]`：依週次升冪；每週以「種子 + 較早週的 newEntities + 本週的 newEntities」作為 `ctx.entities`
  - CLI `scripts/validate.ts` 讀取 `data/world/entities.json` 作為種子；種子本身有問題時，以檔名 `entities.json` 回報

- [ ] **Step 1：改寫 fixture** 為 v2：`primary: "us/tech/meta"`、`places: ["us/tech/meta", "us/equity", "tw/semiconductor"]`；第二則 `primary: "seas/shipping-lane/hormuz"`；`watchlist[0].places: ["us/equity"]`；`newEntities: [{ "id": "example-co", "name": "範例公司", "region": "jp", "sector": "tech", "aliases": [] }]`，並讓某則事件的 `places` 引用 `jp/tech/example-co`。
- [ ] **Step 2：寫失敗測試**（保留 v1 所有規則的測試，把欄位改名；另外新增）：
  ```ts
  test('v1 file rejected with guide hint', () => { const w = base(); w.schemaVersion = 1;
    expect(validateWeek(w, FILE, ctx).some((e) => e.message.includes('schemaVersion 2'))).toBe(true); });
  test('malformed path', () => expectError((w) => { w.events[0].places.push('TW/Semi'); }, '/events/0/places'));
  test('unknown region', () => expectError((w) => { w.events[0].places.push('xx/equity'); }, '/events/0/places/3'));
  test('sector not allowed in region', () => expectError((w) => { w.events[0].places.push('tw/shipping-lane'); }, '/events/0/places/3'));
  test('entity must match path', () => expectError((w) => { w.events[0].places.push('jp/semiconductor/tsmc'); }, '/events/0/places/3'));
  test('primary must be in places', () => expectError((w) => { w.events[0].primary = 'us/bonds'; }, '/events/0/primary'));
  test('entity introduced this week can be referenced', () => expect(validateWeek(base(), FILE, ctx)).toEqual([]));
  test('entity introduced in a later week cannot be referenced earlier', ...); // validateArchive 兩檔
  test('newEntities collision reported at its index', () => expectError((w) => { w.newEntities.push({ id: 'tsmc-x', name: 'tsmc', region: 'tw', sector: 'semiconductor', aliases: [] }); }, '/newEntities/1/name'));
  test('same entity added in two weeks rejected', ...);
  test('watchlist places validated', () => expectError((w) => { w.watchlist[0].places = ['zz']; }, '/watchlist/0/places/0'));
  test('region-only primary is fine', () => { const w = base(); w.events[0].primary = 'us'; w.events[0].places.push('us'); expect(validateWeek(w, FILE, ctx)).toEqual([]); });
  ```
  `ctx = { knownStorylines: new Set(), entities: seed }`；`schema stays in sync` 測試改成檢查 `$defs.path.pattern` 等於 Global Constraints 中的路徑格式。
- [ ] **Step 3：** `npm test -- validate` → FAIL。
- [ ] **Step 4：** 更新 schema（`schemaVersion: { const: 2 }`；路徑用 `$defs.path`；新增 `newEntity` 定義，`geo` 為選填）。`validate.ts`：先判斷 `schemaVersion`，不是 2 就只回報一條錯誤：`請使用 schemaVersion 2（見 docs/WEEKLY_DATA_GUIDE.md）`；接著跑 schema 與 v1 的語意規則；再對每個路徑呼叫 `resolvePath`；最後用 `checkNewEntities` 檢查新實體，issue 的 index 和 field 轉成 `/newEntities/<i>/<field>`。
- [ ] **Step 5：** `npm test -- validate` → PASS。此時 `realData`、`guide` 測試會因舊資料仍是 v1 而失敗，屬預期，由 Task 5、12 修復；在 commit 訊息中註明。
- [ ] **Step 6：** Commit `feat(data): schema v2 with paths and newEntities`。

---

### Task 5: 遷移、人工細修與索引

**Files:**
- Create: `scripts/migrate-v1-to-v2.ts`, `tests/unit/migrate.test.ts`, `tests/fixtures/v1/2026-10-30.json`（移入遷移前的原檔做為快照輸入）
- Modify: `data/weeks/*.json`, `src/data/buildIndex.ts`, `scripts/build-index.ts`, `tests/unit/buildIndex.test.ts`, `tests/unit/realData.test.ts`, `.gitignore`（加入 `data/world/registry.json`）

**Interfaces:**
- Consumes: Task 3、4 的全部
- Produces:
  - `V1_TO_V2: Record<string, string>`（規格 §5.3 的 17 列對照）
  - `migrateWeek(v1: unknown): WeekData`：純函式，不做細修
  - `ArchiveIndex` 新增：`entities: EntityRecord[]`、`mentions: Record<string, number>`（每個路徑及其所有祖先，各週被 `places` 引用的次數總和）、`districts: Record<RegionId, SectorId[]>`（`districtsFor` 的結果）
  - `buildIndex(weeks: WeekData[], seed: EntityRecord[]): ArchiveIndex`
  - `scripts/build-index.ts` 另外寫出 `data/world/registry.json` 與 `public/data/registry.json`

- [ ] **Step 1：** 把現在的 `data/weeks/2026-10-30.json` 複製到 `tests/fixtures/v1/`。
- [ ] **Step 2：寫失敗測試** `migrate.test.ts`：
  - `migrateWeek` 的輸出 `toMatchSnapshot()`；
  - 輸出要通過 `validateWeek`；
  - 對照表涵蓋每個 v1 id（以 v1 種類的 17 個 id 為準）；
  - 遇到未知的 v1 id 時丟出錯誤，訊息中包含該 id。
- [ ] **Step 3：** FAIL → 實作 → PASS。
- [ ] **Step 4：** 執行 `npx tsx scripts/migrate-v1-to-v2.ts`，原地轉換三期週檔。
- [ ] **Step 5：人工細修**（只能依週報原文；以 `rank` 標示，不以 id 標示）：
  - 2026-10-16：
    - rank 4 台積電法說：`primary` 改為 `tw/semiconductor/tsmc`，`places` 加入 `tw/equity`；
    - rank 5 新台幣：`primary` 改為 `tw/fx`，`places` 保留 `tw/central-bank`、`tw/equity`、`intl/commodities/gold`；
    - rank 3：`places` 加入 `us/tech/coreweave`。
  - 2026-10-23：rank 1：`primary` 改為 `us/tech/meta`，`places` 加入 `us/tech/coreweave`；rank 4：`places` 加入 `tw/fx`。
  - 2026-10-30：
    - rank 1：`places` 加入 `us/semiconductor/intel`、`us/tech/alphabet`、`us/tech/amazon`；
    - rank 5：`places` 中的 `intl/crypto/bitcoin` 旁再加 `intl/crypto/binance`；
    - watchlist：Apple/Palantir 改為 `us/tech/apple`、`us/tech/palantir`；AMD 加 `us/semiconductor/amd`；Arm 加 `uk/tech/arm`；Qualcomm 加 `us/semiconductor/qualcomm`；波克夏改為 `us/finance/berkshire`；選舉改為 `us/government`。
  - 每處改動都列進 commit 訊息。
- [ ] **Step 6：寫失敗測試** `buildIndex.test.ts` 新增：
  - `mentions counts ancestors`：一則事件的 `places` 有 `tw/semiconductor/tsmc` → `mentions['tw/semiconductor/tsmc'] === 1`、`mentions['tw/semiconductor'] >= 1`、`mentions['tw'] >= 1`；
  - `districts include referenced non-default sector`：週檔引用 `jp/real-estate` → `districts.jp` 包含 `real-estate`；
  - `entities merge seed and newEntities`。

  `realData.test.ts` 改成：以種子檔呼叫 `validateArchive(files, seed)`，結果必須是 `[]`。
- [ ] **Step 7：** FAIL → 實作 → `npm test` 全綠（`guide.test` 除外，留給 Task 12）；`npm run validate` 輸出 `✓ 3 週資料驗證通過`。
- [ ] **Step 8：** Commit `data: migrate weeks to schema v2 with source-based refinements`。

---

### Task 6: 指標綁定與世界參數

**Files:**
- Create: `src/world/indicators.ts`, `tests/unit/worldParams.test.ts`
- Delete: `src/world/visualParams.ts`, `src/world/entityIndicators.ts`, `src/world/entities.ts`, `tests/unit/visualParams.test.ts`, `tests/unit/entities.test.ts`
- Modify: `tests/unit/world-api.test.ts`（移除 entity → indicator 的對照測試）

**Interfaces:**
- Consumes: `ResolvedIndicators`、`IndicatorKey`、`WeekEvent`
- Produces:
  - `type GaugeKind = 'flame' | 'beam' | 'stack' | 'lightBand' | 'halo' | 'flicker' | 'flag' | 'haze'`
  - `interface IndicatorBinding { path: string; gauge: GaugeKind; keys: IndicatorKey[]; mode: 'level' | 'change'; range: [number, number]; neutral: number; source?: string }`（`keys[0]` 為主要指標，其餘依序為後備）
  - `INDICATOR_BINDINGS: readonly IndicatorBinding[]`，共 9 列：
    - `gulf/energy` flame：brent，level，範圍 60–140，中性值 0.5
    - `us/central-bank` beam：fedFunds，0–6，0.5
    - `us/bonds` stack：us10y，2–6，中性值使樓層數為 7
    - `us/equity` lightBand：nasdaq 後備 sp500，change，範圍 0–3，0
    - `tw/equity` lightBand：taiex，change，0–3，0
    - `tw/fx` flag：usdtwd，28–34，0.5
    - `intl/commodities/gold` halo：gold，2000–5000，0.5
    - `intl/crypto/bitcoin` flicker：btc，change，0–10，0
    - `us` haze：cpiYoY，1–6，0
  - `interface GaugeReading { level: number; trend: -1 | 0 | 1; status: 'fresh' | 'stale' | 'missing'; key: IndicatorKey | null }`
  - `interface WorldParams { gauges: Record<string, GaugeReading>; tankers: number; weather: Weather; sentimentScore: number }`
  - `computeWorldParams(ind: ResolvedIndicators, events: WeekEvent[]): WorldParams`、`lerpWorldParams(a, b, t): WorldParams`
  - `sentimentScore`、`sentimentToWeather`、`type Weather` 從 visualParams 原樣搬過來
  - `bindingFor(path: string): IndicatorBinding | undefined`、`stackFloors(level: number): number`（`round(3 + 9·level)`）

- [ ] **Step 1：寫失敗測試**：把 v1 `visualParams.test.ts` 的每個案例改寫成新 API，數值完全相同：
  - brent 113 → `gauges['gulf/energy'].level ≈ 0.6625`、`tankers === 6`；brent 200 → level 1；
  - us10y 5.05 → `stackFloors(gauges['us/bonds'].level) === 10`；
  - nasdaq −2.86 → `us/equity` 的 `{ trend: -1, level ≈ 0.9533, key: 'nasdaq' }`；只有 sp500 +1.5 時 → `key: 'sp500'`、trend 1、level 0.5；
  - 全部 missing → 各 level 等於中性值、status 為 missing；
  - stale → status stale，數值仍照算；
  - 天氣與情緒的 6 個邊界值；
  - lerp：t=0 等於 a、t=1 等於 b、t=0.5 時 level 取平均、離散欄位改用 b。

  另加：`every binding path resolves`（每一列的 `path` 用種子呼叫 `resolvePath` 都通過）。
- [ ] **Step 2：** FAIL → 實作 → PASS。
- [ ] **Step 3：** 刪除舊檔與舊測試。`npx tsc --noEmit` 會在 `src/render`、`src/ui` 報錯，屬預期，由 Task 7–11 修復；本 task 的驗收以 `npm test` 為準。
- [ ] **Step 4：** Commit `refactor(world): path-based indicator bindings and world params`。

---

### Task 7: 繪圖核心——WorldGraph、L0 地形、L1 區塊、鏡頭

**Files:**
- Create: `src/render/graph.ts`, `src/render/layers/{ocean,islandTerrain,districtPlot,district}.ts`, `tests/unit/graph.test.ts`
- Modify: `src/render/scene.ts`（世界尺寸、鏡頭範圍、陰影範圍、霧）、`src/render/world.ts`（改用 graph）
- Delete: `src/render/islands.ts`（11 種外型暫時移到 `landmarks/legacy.ts`，Task 8 再拆）

**Interfaces:**
- Consumes: `layoutIslands`、`districtsFor`、`districtSlots`、`REGIONS`、`getSector`、`EntityRecord`、`WorldParams`
- Produces:
  - `interface WorldNode { readonly path: string; readonly kind: 'region' | 'district' | 'entity'; readonly object: THREE.Object3D; anchor(): THREE.Vector3; setState(s: 'normal' | 'dim' | 'highlight'): void; update(dt: number, t: number): void; dispose(): void }`
  - `class WorldGraph { add(n: WorldNode): void; get(path: string): WorldNode | undefined; nearest(path: string): WorldNode | undefined; children(path: string): WorldNode[]; all(): WorldNode[] }`。`nearest` 依序查：自己 → 父節點 → 祖父節點；`graph.ts` 不 import three（型別用 `import type`），所以可以在 Node 中測試。
  - `interface WorldBuildInput { entities: EntityRecord[]; districts: Record<RegionId, SectorId[]>; mentions: Record<string, number> }`
  - `WorldView`：
    - 移除 `setParams`、`tweenTo` 的 VisualParams 版本，改為 `setParams(p: WorldParams)`、`tweenTo(p: WorldParams, ms)`；
    - 新增 `build(input: WorldBuildInput): void`（重建區塊與實體節點，地形保留）；
    - `setWeekFocus(paths: string[])`（交給 L2 用來挑選可見實體）；
    - `flyTo(path: string, ms?)`：依 `nearest(path).kind` 套用縮放 1.6、2.4、3.2；
    - `highlight(paths: string[])`；
    - `onPick(cb: (path: string | null) => void)`、`onHover(cb: (path: string | null, screen) => void)`：皆回傳最深一層的路徑；
    - `focusAsiaPacific(ms?)`；
    - `cameraTarget(): [number, number]`（目前鏡頭目標的 x、z，供 E2E 使用）。
  - `scene.ts`：`HOME` 改由 `layoutIslands()` 的外框計算（框住全圖）；`ASIA_PACIFIC` 為台灣中心、縮放 2.2；`controls.minZoom = 0.6`、`maxZoom = 6`

- [ ] **Step 1：寫失敗測試** `graph.test.ts`（用不依賴 three 的假節點）：
  - `get and children`；
  - `nearest falls back to the district for an unrendered entity`：graph 只有 `tw`、`tw/semiconductor` → `nearest('tw/semiconductor/tsmc')!.path === 'tw/semiconductor'`；
  - `nearest returns the region node for a region path`；
  - `nearest returns undefined for unknown region`。
- [ ] **Step 2：** FAIL → 實作 `graph.ts` → PASS。
- [ ] **Step 3：** 實作 L0、L1：
  - 島嶼形狀沿用 v1 的雜訊多邊形，種子改由 region id 的雜湊決定；
  - 區塊地皮的顏色依部門分組：總經藍、市場綠、產業橙、全球紫；
  - 看板（CSS2D）文字為部門中文名；
  - `seas` 不建島，只在每個航道實體的位置建一個區塊大小的海上節點；
  - `world.ts` 依 `WorldBuildInput` 建立節點；拾取時沿 `object.userData.path` 往上找到第一個有 path 的物件。
- [ ] **Step 4：目視驗證**：`npm run dev`，用 Playwright 截桌機全圖到 scratchpad。確認 15 座島與國際港的方位符合地圖直覺、島不重疊、台灣靠近中國東南；點擊台灣島的 console 輸出為 `tw`，點擊區塊為 `tw/semiconductor`。
- [ ] **Step 5：** Commit `feat(render): world graph, geographic islands and districts`。

---

### Task 8: L2 建築——18 種部門原型與自動生成的實體建築

**Files:**
- Create: `src/render/landmarks/*.ts`（18 個原型加 `index.ts`）、`src/render/entityBuilding.ts`, `tests/unit/entityBuilding.test.ts`
- Delete: `src/render/landmarks/legacy.ts`

**Interfaces:**
- Consumes: `Archetype`、`WorldNode`、`pickVisibleEntities`
- Produces:
  - `type LandmarkBuilder = (opts: { plot: number }) => { group: THREE.Group; top: number; update?(dt: number, t: number): void }`
  - `LANDMARKS: Record<Archetype, LandmarkBuilder>`（`index.ts`）
  - `entityLook(id: string): { heightScale: number; hueShift: number; roof: 0 | 1 | 2 }`：純函式，以 FNV-1a 雜湊計算，heightScale 落在 [0.7, 1.4]，hueShift 落在 [−0.08, 0.08]
  - `buildEntityBuilding(archetype: Archetype, id: string, plot: number): { group: THREE.Group; top: number }`：原型縮小到 0.45 倍，再套用 `entityLook`
  - 區塊內的實體位置：4 個角落格位 `[±0.3·plot, ±0.3·plot]`，主建築在中央

- [ ] **Step 1：寫失敗測試** `entityBuilding.test.ts`：
  - `entityLook is deterministic`；
  - `entityLook ranges`：對 200 個隨機 id 斷言值都落在範圍內；
  - `different ids usually look different`：`tsmc` 與 `intel` 至少有一個值不同。
- [ ] **Step 2：** FAIL → 實作 `entityLook` → PASS。
- [ ] **Step 3：** 把 v1 的 11 種外型拆成獨立檔案（只改輸入參數，外觀不變）；新增 7 種原型：
  - 政府：圓頂議事堂；
  - 貿易：貨櫃碼頭，堆疊彩色貨櫃加吊臂；
  - 匯市：兌換亭加旗桿（掛 `flag` 儀表）；
  - 金融：銀行塔，窄高、頂端有尖頂；
  - 原物料：礦坑，台階式坑口加料堆；
  - 房地產：住宅群加吊車；
  - 消費：商場，低矮寬建築加彩色雨遮。
- [ ] **Step 4：** 區塊節點依 `pickVisibleEntities` 建立最多 4 棟實體節點（`kind: 'entity'`）。`setWeekFocus` 改變時，只重建受影響的區塊。
- [ ] **Step 5：目視驗證**：截亞太特寫，確認台灣半導體區有台積電建築、美國科技區有實體建築，而且外觀彼此不同。
- [ ] **Step 6：** Commit `feat(render): 18 sector archetypes and generated entity buildings`。

---

### Task 9: L3 儀表與航線

**Files:**
- Create: `src/render/gauges/*.ts`、`src/render/layers/shipping.ts`

**Interfaces:**
- Consumes: `INDICATOR_BINDINGS`、`GaugeReading`、`WorldGraph`、`stackFloors`
- Produces:
  - `interface Gauge { attach(node: WorldNode): void; set(r: GaugeReading, mode: ColorMode): void; update(dt: number, t: number): void; dispose(): void }`
  - `createGauge(kind: GaugeKind): Gauge`（`gauges/index.ts`）
  - `world.ts` 依 `INDICATOR_BINDINGS` 為每個路徑掛上儀表；`setParams` 把 `gauges[path]` 交給對應的儀表；status 為 stale 或 missing 時，對節點呼叫 `setState('dim')`
  - `SHIPPING_ROUTE = ['gulf/energy', 'seas/shipping-lane/hormuz', 'seas/shipping-lane/malacca', 'seas/shipping-lane/taiwan-strait', 'seas/shipping-lane/pacific', 'us']`；油輪數量 = `WorldParams.tankers`

- [ ] **Step 1：** 把 v1 各地標內建的動態效果（火焰、光柱、樓層、燈帶、光暈、閃爍、旗幟、熱霧）抽成 8 個儀表；數值對應與 v1 相同，lightBand 的漲跌配色沿用 `UP_DOWN`。
- [ ] **Step 2：** 實作航線：沿 `SHIPPING_ROUTE` 各節點的 `anchor()` 建 Catmull-Rom 曲線，跨越換日線的點要接在同一側（以 x 差 > 半個世界寬判斷，再平移 ±世界寬）。
- [ ] **Step 3：目視驗證**：10/30 週全圖截圖，確認中東火焰明顯、美國熱霧可見、美債塔約 10 層、油輪從中東經麻六甲往太平洋。切到 10/16 週，確認沒有 btc 的加密區塊會變暗。
- [ ] **Step 4：** `npm test` 全綠；commit `feat(render): indicator gauges and shipping route`。

---

### Task 10: L4 特效、L5 標籤分級與全圖說明

**Files:**
- Create: `src/render/layers/labels.ts`, `tests/unit/labels.test.ts`（`// @vitest-environment jsdom`）
- Modify: `src/render/effects.ts`、`src/render/world.ts`

**Interfaces:**
- Consumes: `WorldGraph.nearest`、`labelOf`
- Produces:
  - `Effects` 的參數一律改成路徑：`pulse(path, sentiment)`、`flow(fromPath, toPath, label)`、`ripple(direction, summary)`（目標固定為 `tw`）、`showFlags(items: { path: string; text: string; confirmed: boolean }[])`；落點一律用 `graph.nearest(path)?.anchor()`，查不到時靜默略過
  - `makeLabel(text: string, cls: string): HTMLDivElement`：只用 textContent
  - `labelVisibility(kind: 'region' | 'district' | 'entity' | 'entity-name', zoom: number): boolean`：地區永遠顯示；部門 ≥ 1.8；實體建築 ≥ 1.8；實體名 ≥ 3.0
  - 旗幟標籤改成依地區合併（同 v1 的規則）
  - hover 提示資料：`hoverInfo(path, index): { title: string; lines: string[] }`，地區節點顯示 `約略 GDP x.x 兆美元`，放大過的島另加 `（為可讀性放大）`

- [ ] **Step 1：寫失敗測試** `labels.test.ts`：
  - `entity label renders name as text`：`makeLabel('<img src=x onerror=alert(1)>', 'x').querySelector('img') === null`；
  - `labelVisibility thresholds`：四種 kind 的上下界；
  - `hoverInfo for enlarged island`：`hoverInfo('tw', index).lines` 包含 `為可讀性放大`；
  - `hoverInfo for indicator node includes note`。
- [ ] **Step 2：** FAIL → 實作 → PASS。
- [ ] **Step 3：** 改寫 effects，並把 v1 特效的世代計數、漣漪標籤清除等修正全部保留。
- [ ] **Step 4：** 畫面左下角（底部列上方）放全圖說明，文字依 Global Constraints。
- [ ] **Step 5：** Commit `feat(render): path-based effects, label LOD and legend`。

---

### Task 11: UI——節點面板、麵包屑、事件卡與 App 串接

**Files:**
- Create: `src/ui/nodePanel.ts`
- Delete: `src/ui/entityPanel.ts`
- Modify: `src/ui/eventCard.ts`、`src/ui/textMode.ts`、`src/ui/app.ts`、`src/ui/styles.css`、`tests/unit/eventCard.test.ts`

**Interfaces:**
- Consumes: `ArchiveIndex`（含 entities、mentions、districts）、`labelOf`、`isWithin`、`bindingFor`、`WorldView`（Task 7 版）
- Produces:
  - `renderNodePanel(path: string, week: WeekData, index: ArchiveIndex): HTMLElement`：
    - 麵包屑：每一層都是按鈕，點擊時發出 `CustomEvent('select-node', { detail: { path } })`；
    - 實體或部門的說明；
    - 地區顯示約略 GDP；
    - 若 `bindingFor(path)` 有值，顯示指標、註記、近 12 週走勢圖（沿用 v1 的 sparkline）；
    - 本週相關事件：`places` 中任一路徑 `isWithin(該路徑, path)` 的事件；
    - 部門節點另外列出所有實體，包含沒有畫出來的。
  - `renderEventCard(ev, opts, entities: EntityRecord[])`：地點列改為 `labelOf` 用 `›` 串接，以 `、` 分隔
  - `app.ts`：
    - 改用 `computeWorldParams`；
    - 每週呼叫 `world.setWeekFocus(本週所有 places)`；
    - 播放時用 `ev.primary`；
    - 終幕旗幟用 `watchlist[].places[0]`；
    - 主線高亮取該主線事件的 `places`；
    - 手機版初始呼叫 `world.focusAsiaPacific(0)`；
    - 載入 `index.json` 後呼叫一次 `world.build(...)`；
    - 新增 `selectNode(path: string): void`，點擊世界與點擊麵包屑都走這裡；
    - 只在網址帶 `?test=1` 時暴露測試鉤子 `window.__econ = { pick: (path: string) => selectNode(path), cameraTarget: () => world?.cameraTarget() ?? null }`。

- [ ] **Step 1：寫失敗測試**（jsdom），改寫 v1 的 entityPanel 測試並新增：
  - `breadcrumb levels`：`tw/semiconductor/tsmc` 的麵包屑文字為 `['台灣', '半導體', '台積電']`；
  - `breadcrumb renders names as text`：實體名稱為 `<b>x</b>` 時，`querySelector('b') === null`；
  - `region panel lists descendant events`：`tw` 的面板列出 `primary` 為 `tw/semiconductor/tsmc` 的事件；
  - `district panel lists all entities incl. hidden`：美國科技區列出 6 個以上的實體；
  - `region panel shows approximate GDP`：文字包含 `約略`；
  - `event card shows place labels`：包含 `台灣 › 半導體 › 台積電`；
  - v1 eventCard 的 XSS、taiwanImpact、discrepancy、來源連結測試全部保留。
- [ ] **Step 2：** FAIL → 實作 → PASS；`npx tsc --noEmit` 無錯。
- [ ] **Step 3：目視驗證**：桌機播放 10/30 週到終幕、點台積電、點台灣島、點麵包屑「台灣」；手機 375×812 初始畫面（亞太）。截圖存到 scratchpad 並檢視。
- [ ] **Step 4：** Commit `feat(ui): node panel with breadcrumbs and path-based app wiring`。

---

### Task 12: 說明書 v2、合成週、E2E 與 README

**Files:**
- Modify: `docs/WEEKLY_DATA_GUIDE.md`、`tests/unit/guide.test.ts`、`scripts/synthetic-week.ts`、`tests/e2e/*.spec.ts`、`README.md`
- Create: `tests/e2e/skeleton-v2.spec.ts`

**Interfaces:**
- Consumes: 全部
- Produces: 排程照做即可產出 v2 週檔的說明書；CI 演練涵蓋新實體與新區塊

- [ ] **Step 1：改寫 guide 測試**：
  - 說明書中出現每個 `REGION_IDS`、`SECTOR_IDS`、`INDICATOR_KEYS`（皆以反引號包住）；
  - 逐字嵌入 v2 的 `2026-10-30.json`；
  - 包含字串 `data/world/registry.json`、`newEntities`、`人物不新增`。
- [ ] **Step 2：** FAIL → 依規格 §6 改寫說明書 → PASS。說明書要包含：
  - 地區表、部門表（附允許的地區）；
  - 先執行 `npm run index` 再查 `data/world/registry.json`；
  - 新增實體的 4 條規則；
  - 路徑對應原則；
  - 航道實體必須附 `geo`。
- [ ] **Step 3：** `synthetic-week.ts` 改成產生 v2 週檔，並且：
  - `newEntities` 新增 `{ id: 'synthetic-co', name: '演練公司', region: 'in', sector: 'tech', aliases: [] }`，並讓 rank 1 事件的 `places` 引用 `in/tech/synthetic-co`；
  - rank 2 事件的 `places` 加入 `jp/real-estate`（日本預設沒有這個部門）。
- [ ] **Step 4：寫 E2E** `skeleton-v2.spec.ts`：
  - `clicking TSMC selects its path`：開 `#/2026-10-30`，以 `page.evaluate` 呼叫測試鉤子 `window.__econ.pick('tw/semiconductor/tsmc')`（只在 `?test=1` 時暴露）→ 面板的麵包屑為 `台灣 › 半導體 › 台積電`；
  - `region panel lists TSMC event`：`pick('tw')` → 面板包含 10/16 台積電事件的標題（在 10/16 週）；
  - `region-level event plays`：用 `page.route` 把 10/30 rank 1 的 `primary` 改成 `us`、`places` 加 `us` → 播放第一則不報錯，面板顯示該事件；
  - `legend is visible`：全圖說明文字可見；
  - `mobile starts on Asia-Pacific`：375×812 → `window.__econ.cameraTarget()` 的 x 落在台灣錨點 ±6 以內；
  - `synthetic entity appears`（只在 `data/weeks` 含 `synthetic-co` 時執行，否則 `test.skip`）：`pick('in/tech/synthetic-co')` → 麵包屑包含 `演練公司`；`pick('jp/real-estate')` 回傳非 null。
- [ ] **Step 5：** 調整 v1 E2E 的選擇器（例如面板 class 改名），所有測試都必須通過：
  - `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e` 全綠；
  - 再產生合成週跑一次，全綠後刪除合成週檔；
  - 在負載下（`--repeat-each 3 --workers 4`）全綠。
- [ ] **Step 6：** README 更新：
  - 截圖換成新的全圖、亞太特寫、手機版；
  - 「功能」加上三層路徑、自動新增實體、真實地理與 GDP 比例；
  - 「架構」改成新的目錄結構。
- [ ] **Step 7：** `npm run validate && npm test && npm run build` 全綠；commit `docs: weekly guide v2, synthetic v2 week, e2e and README`；推送分支並確認 CI 的 build 與 rehearsal 兩個 job 都綠燈。

---

## 執行後驗收（對照規格 §1）

- [ ] 全圖一眼看得出世界地圖方位；島的大小關係為美 > 中 > 歐元區 > 日、印 > 其他；台灣在中國東南方。
- [ ] 任一週的任一事件都能播放；地區層、部門層、實體層的事件都能正確飛到與脈衝。
- [ ] 合成週的新實體與新區塊在 CI 演練中出現，而且不需要修改程式。
- [ ] 三期舊週報的內容（文字、數字、來源）與 v1 完全相同，只有地點欄位改成路徑。
- [ ] v1 的所有 E2E 都通過；排程 prompt 沒有修改。
- [ ] 合併到 main 之前：檢查 main 上是否已有排程推入的 v1 新週檔，有的話先用遷移腳本轉換並人工細修（規格 §5.4）。
- [ ] 合併到 main 之前：請使用者確認；合併後 CI 部署成功，線上版以 Playwright 開啟確認。
