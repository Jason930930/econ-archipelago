# 世界骨架 v2 — 設計規格（總體金融數位孿生・子專案 1）

- 日期：2026-11-02
- 狀態：待審閱
- 前一版規格：`docs/superpowers/specs/2026-11-02-econ-archipelago-design.md`（以下稱 v1）
- 分支：`feat/world-skeleton-v2`

## 0. 背景與定位

經濟群島 v1 已上線：15 個抽象地標分布在 10 座位置任意的小島上，資料是排程每週產生的週檔。

使用者把目標重新定位為**總體金融世界的數位孿生**，拆成四個依序進行的子專案：

| # | 子專案 | 依賴 |
|---|---|---|
| **1** | **世界骨架 v2（本規格）**：真實地理與 GDP 比例的島嶼、三層實體模型、6 層繪圖元件、資料格式 v2 | — |
| 2 | 常駐傳導網絡：經濟傳導管道圖，事件點亮管道 | 1 |
| 3 | 完整狀態鏡像：每個部門都有狀態值，指標擴充，可選每日外部資料 | 1 |
| 4 | 情境推演 what-if：施加衝擊、沿網絡顯示方向性影響（定性） | 2（3 可提供起點） |

本規格只涵蓋子專案 1。第 9 節列出子專案 2–4 需要骨架預先提供的介面，以免日後重做。

## 1. 目標與成功標準

1. **親切的真實地理**：島嶼依真實經緯度相對位置排列，大小反映經濟規模，一眼看得出是世界地圖。
2. **能應付不同週報內容**：任何週報事件都能對應到世界裡的某個位置，深淺都可以：國家、國家的某個部門、或具體的公司／組織／商品／航道。週報出現沒見過的公司時，排程可以自行新增，世界自動長出對應建築，不需要人工介入或修改程式。
3. **元件化與分層**：資料上是「地區 → 部門 → 實體」三層樹，繪圖上分 6 層；每個元件可獨立測試、重用。
4. **無痛切換**：三期既有週報遷移到 v2 後內容不變；排程 prompt 不必修改；v1 的所有功能（播放、時間軸、主線、分享連結、文字模式、手機版、驗證與 CI）照常運作。

非目標（留給後續子專案）：傳導管道圖、部門狀態向量、外部資料源、情境推演、各區不同天氣、真實海岸線、人物實體。

## 2. 地圖投影與島嶼版面

### 2.1 投影
- 等距圓柱投影，**以東經 150° 為中心**（太平洋置中：亞洲在中、美洲在右、歐洲／中東／俄羅斯在左）。
- 世界座標：`x = s · wrap(lon − 150°)`、`z = −s · lat`，其中 `wrap` 把經度差折到 [−180°, 180°)，`s` 為固定比例常數（實作時決定，使整張地圖寬約 90 個世界單位）。
- 投影是純函式 `project(lat, lon) → [x, z]`，位於 `src/world/geo.ts`，可單元測試。

### 2.2 地區（第 1 層）

| id | 名稱 | 錨點（緯, 經） | 約略 GDP（兆美元） | 預設部門 |
|---|---|---|---|---|
| `us` | 美國 | 39, −98 | 30 | central-bank, equity, bonds, tech, semiconductor, energy, finance, government |
| `cn` | 中國 | 34, 104 | 19 | central-bank, equity, industry, real-estate, trade, government |
| `ez` | 歐元區 | 49, 9 | 16 | central-bank, equity, bonds, industry, energy |
| `jp` | 日本 | 36, 139 | 4.2 | central-bank, equity, bonds, fx, industry |
| `in` | 印度 | 22, 79 | 4.2 | central-bank, equity, tech, consumer |
| `uk` | 英國 | 54, −2 | 3.8 | central-bank, equity, finance |
| `asean` | 東南亞 | 5, 110 | 4.0 | trade, industry, consumer |
| `ca` | 加拿大 | 56, −106 | 2.2 | central-bank, energy, commodities |
| `br` | 巴西 | −10, −52 | 2.3 | central-bank, commodities, equity |
| `ru` | 俄羅斯 | 55.7, 37.6 | 2.1 | central-bank, energy, government |
| `mx` | 墨西哥 | 23, −102 | 1.9 | trade, industry |
| `kr` | 韓國 | 36.5, 128 | 1.8 | central-bank, equity, memory, industry |
| `au` | 澳洲 | −25, 134 | 1.8 | central-bank, commodities |
| `gulf` | 中東／海灣 | 24, 47 | 2.2 | energy, finance, government |
| `tw` | 台灣 | 23.7, 121 | 0.8 | central-bank, equity, fx, semiconductor, government |
| `seas` | 海域（虛擬） | — | — | shipping-lane |
| `intl` | 國際（虛擬） | −5, −165 | — | organization, commodities, crypto |

- GDP 為**約略值**，取 IMF《世界經濟展望》2025 年名目 GDP 估計的數量級，只用來決定比例。實作時要對照 IMF 最新公布值修正並註明年份。歐元區、東南亞、海灣為成員國合計。
- 地區清單與錨點寫在程式中（`src/world/regions.ts`），屬於需要審查的變更，排程不能新增地區。
- `seas` 沒有島，它的實體各自位於真實經緯度。`intl` 是一座小型「國際港」，位於太平洋中央的空白處。

### 2.3 島嶼大小
- 島的面積與 GDP 成正比：`r = max(rMin, k · √GDP)`。`rMin` 要讓島至少放得下 5 個部門區塊。
- 套用 `rMin` 的島，在 hover 提示中註明「為可讀性放大」。

### 2.4 避免重疊（確定性鬆弛）
- 以錨點為起點，迭代固定次數（例如 200 次）：島與島之間有排斥力，島與自己的錨點之間有彈簧力。演算法不使用亂數，因此每次結果相同。
- 台灣的錨點彈簧強度是其他島的 4 倍，盡量留在真實位置附近。
- 結果必須維持主要方位關係：日本在韓國東方、台灣在中國東南方、澳洲在東南亞南方、加拿大在美國北方、墨西哥在美國南方。以單元測試鎖定。
- 版面計算是純函式 `layoutIslands(regions) → Map<RegionId, {center, radius}>`，結果可快取。
- 畫面角落常駐說明：「島嶼大小約與 GDP 成正比（約略值）；為避免重疊，相鄰島嶼位置略有偏移。」

### 2.5 鏡頭
- 桌機預設框住整個世界（約 3:1）。手機預設對準亞太地區，以台灣為中心。
- 飛到不同層級時的縮放倍率：地區 1.6、部門 2.4、實體 3.2（相對於全圖）。

## 3. 三層實體模型

### 3.1 路徑
- 世界中每個位置都有唯一的**路徑**：`region`、`region/sector` 或 `region/sector/entity`，例如 `us`、`us/central-bank`、`tw/semiconductor/tsmc`。
- 路徑是事件、觀察清單、指標、拾取結果以及後續傳導網絡節點**共用的 id**。
- `src/world/paths.ts` 提供：`parsePath`、`formatPath`、`parentOf`、`ancestorsOf`、`isDescendant`（皆為純函式）。

### 3.2 部門（第 2 層，寫在程式中）

| id | 名稱 | 主建築原型 | 允許的地區 |
|---|---|---|---|
| `central-bank` | 央行 | 柱廊建築 | 經濟體 |
| `government` | 政府與財政 | 圓頂議事堂 | 經濟體 |
| `trade` | 貿易與關稅 | 貨櫃碼頭 | 經濟體 |
| `equity` | 股市 | 交易所大樓 | 經濟體 |
| `bonds` | 債市 | 疊層塔 | 經濟體 |
| `fx` | 匯市 | 兌換亭與旗桿 | 經濟體 |
| `finance` | 銀行與金融 | 銀行塔 | 經濟體 |
| `energy` | 能源 | 油井與儲槽 | 經濟體 |
| `commodities` | 原物料 | 礦坑與料堆 | 經濟體、`intl` |
| `industry` | 製造與工業 | 廠房與煙囪 | 經濟體 |
| `tech` | 科技 | 玻璃園區 | 經濟體 |
| `semiconductor` | 半導體 | 晶圓廠 | 經濟體 |
| `memory` | 記憶體 | 紫色廠房與晶片 | 經濟體 |
| `real-estate` | 房地產 | 住宅群與吊車 | 經濟體 |
| `consumer` | 消費 | 商場 | 經濟體 |
| `crypto` | 加密 | 懸浮晶體 | 經濟體、`intl` |
| `shipping-lane` | 航道 | 浮標與航線 | 僅 `seas` |
| `organization` | 國際組織 | 國際港旗陣 | 僅 `intl` |

「經濟體」指 15 個非虛擬地區。表中共 18 種：17 種一般部門，加上只屬於 `intl` 的 `organization`。

- 每座島先放它的預設部門。**週報引用某島沒有的合法部門時，該島會自動多一個區塊**，例如事件提到 `jp/real-estate`。區塊集合 = 預設部門 ∪ 歷來週檔引用過的部門。

### 3.3 實體（第 3 層，資料檔）
- 合法實體清單 = `data/world/entities.json`（人工維護的種子）加上歷來所有週檔的 `newEntities`，由建置腳本合併成 `data/world/registry.json`（git-ignore，也會複製到 `public/`）。
- 實體欄位：`id`（小寫英文加連字號）、`name`（中文或通用名）、`region`、`sector`、`aliases`（字串陣列）、`addedIn`（種子為 `"seed"`，週檔新增的為該週 weekId）。
- **人物不設實體**，只寫在事件文字中。
- 種子清單：
  - 舊週報點名過的公司：台積電、Intel、Meta、Alphabet、Amazon、CoreWeave、Apple、Palantir、AMD、Arm、Qualcomm、波克夏、幣安。
  - 常見關鍵實體：Nvidia、Samsung、SK Hynix、OPEC（`intl/organization`）、黃金（`intl/commodities`）、比特幣（`intl/crypto`）。油價不設實體，Brent 和 WTI 指標掛在 `gulf/energy`。
  - 航道：荷莫茲、麻六甲、紅海與蘇伊士、巴拿馬運河、台灣海峽、太平洋航線（皆為 `seas/shipping-lane`，附真實經緯度）。

### 3.4 指標對照表
- 原有 12 個指標維持不變，改為掛在路徑上，對照表只放在 `src/world/indicators.ts` 一個地方。
- 每一列包含：指標鍵、路徑、儀表類型（見 4.4）、對應範圍、中性值。
- 映射規則：
  - `fedFunds` → `us/central-bank`（光柱）
  - `us10y` → `us/bonds`（樓層）
  - `sp500`、`nasdaq`、`dow` → `us/equity`（燈帶）
  - `taiex` → `tw/equity`（燈帶）
  - `usdtwd` → `tw/fx`（旗幟）
  - `brent`、`wti` → `gulf/energy`（火焰）
  - `gold` → `intl/commodities/gold`（光暈）
  - `btc` → `intl/crypto/bitcoin`（閃爍）
  - `cpiYoY` → `us`（熱霧）
- v1 的 `computeVisualParams` 改為依這張表產生 `Map<path, GaugeReading>`。天氣與情緒的計算不變。

## 4. 繪圖元件分層

### 4.1 元件介面
場景樹與資料樹一一對應：`RegionNode → DistrictNode → EntityNode`。三者實作同一個介面：

```ts
interface WorldNode {
  readonly path: string;
  readonly object: THREE.Object3D;
  anchor(): THREE.Vector3;                   // 鏡頭、粒子、旗子、漣漪的落點
  setState(s: 'normal' | 'dim' | 'highlight'): void;
  update(dt: number, t: number): void;
  dispose(): void;
}
```

`WorldGraph`（`src/render/graph.ts`）負責建立和查詢節點：`get(path)`、`nearest(path)`（找不到時退回最近的祖先）、`children(path)`、`all()`。

### 4.2 六層

| 層 | 內容 | 元件（`src/render/layers/`） |
|---|---|---|
| L0 地形 | 海面、島嶼、區塊地皮 | `ocean.ts`、`islandTerrain.ts`、`districtPlot.ts` |
| L1 部門區塊 | 每個部門一塊有顏色的地皮與看板，依固定順序排在島上的格位 | `district.ts`、`districtSlots.ts`（格位計算為純函式） |
| L2 建築 | 部門主建築（18 種原型）；實體建築依部門原型自動生成 | `landmarks/*.ts`、`entityBuilding.ts` |
| L3 指標儀表 | 掛在節點錨點上，與建築分離 | `gauges/{flame,beam,stack,lightBand,halo,flicker,flag,haze}.ts` |
| L4 特效 | 脈衝、因果粒子、台灣漣漪、終幕旗幟 | 沿用 `effects.ts`，落點改用 `WorldGraph.nearest(path).anchor()` |
| L5 標籤 | 島名、部門名、實體名、特效標籤 | `labels.ts`（依縮放程度顯示或隱藏） |

- **自動生成的實體建築**：由部門原型縮小而成，高度、色相偏移、屋頂樣式由 id 的雜湊值決定，所以同一個 id 每次外觀都相同。第一版不做任何公司的專屬外型。
- 18 種部門原型的來源：
  - 沿用 v1 的 11 種外型，從 `islands.ts` 拆進 `landmarks/`：央行、交易所、債市、科技、晶圓廠、記憶體、油田、工業、加密、航道、公告板。
  - 新增 7 種：政府、貿易、匯市、金融、原物料、房地產、消費。
  - v1 的金庫外型退役。黃金改成 `intl/commodities/gold` 實體建築，再掛上光暈儀表。

### 4.3 縮放細節分級
- 全圖縮放：顯示島名與部門主建築。
- 中等縮放：再加上部門名稱與實體建築。
- 近距離：再加上實體名稱。
- 每個區塊最多顯示 4 棟實體建築。挑選順序：本週事件提到的 → 歷來被提到最多次的 → id 字母序。其餘的在區塊面板中列出。

### 4.4 指標儀表
8 種儀表都實作 `Gauge { attach(node), set(reading: { level: 0..1, trend?: -1|0|1, status }) }`。

stale 或 missing 的指標，其掛載節點會變暗（沿用 v1 的規則與文字）。

### 4.5 互動
- 拾取一律回傳**最深一層**的路徑。
- 面板顯示麵包屑（例如「台灣 › 半導體 › 台積電」），以及**此節點與其所有子孫**在本週的相關事件。
- 點擊麵包屑可以往上一層。
- hover 提示顯示名稱；地區節點加上約略 GDP（以及是否為可讀性放大）；有指標的節點顯示指標數值與註記。
- 天氣維持全世界一種。

## 5. 資料格式 v2

### 5.1 週檔變動（`schemaVersion: 2`）
- `events[].primaryEntity` 改為 `events[].primary`（路徑），`events[].entities` 改為 `events[].places`（路徑陣列，必須包含 `primary`）。
- `watchlist[].entities` 改為 `watchlist[].places`（路徑陣列）。
- 新增選填欄位 `newEntities`：`[{ id, name, region, sector, aliases }]`。`addedIn` 由建置時自動補為該週 weekId。
- 其他欄位與規則（indicators、links、storylines、taiwanImpact、sources、日期與週五檢查等）與 v1 相同。

### 5.2 驗證新增的規則（`npm run validate`，排程與 CI 共用）
1. 路徑格式：1 到 3 段，每段為小寫英文、數字與連字號。
2. 地區必須是 17 個之一；部門必須是 18 種之一，而且地區允許該部門（見 3.2 表）。
3. 第 3 層實體必須存在於「種子清單 + 本週及較早週的 `newEntities`」中，而且它的 `region` 和 `sector` 要與路徑一致。
4. `newEntities`：
   - id 不得與既有實體重複；
   - `name` 和 `aliases` 與既有實體的名稱、別名比對時不分大小寫、忽略空白，不得重複；
   - `region` 和 `sector` 要合法，且符合部門的地區限制；
   - 同一個 id 不能在兩週重複新增。
5. `schemaVersion` 不是 2 的檔案直接拒絕，並提示「請使用 schemaVersion 2（見 docs/WEEKLY_DATA_GUIDE.md）」。
6. 種子檔 `data/world/entities.json` 也要通過同一套實體規則。

### 5.3 遷移
- 一次性腳本 `scripts/migrate-v1-to-v2.ts`，依固定對照表轉換：

| v1 id | v2 路徑 |
|---|---|
| `us-fed` | `us/central-bank` |
| `us-wallst` | `us/equity` |
| `us-bonds` | `us/bonds` |
| `us-tech` | `us/tech` |
| `tw-cbc` | `tw/central-bank` |
| `tw-twse` | `tw/equity` |
| `tw-fab` | `tw/semiconductor` |
| `kr-memory` | `kr/memory` |
| `me-oil` | `gulf/energy` |
| `eu-ecb` | `ez/central-bank` |
| `jp-boj` | `jp/central-bank` |
| `cn-industry` | `cn/industry` |
| `gold-vault` | `intl/commodities/gold` |
| `crypto` | `intl/crypto/bitcoin` |
| `sea-hormuz` | `seas/shipping-lane/hormuz` |
| `sea-pacific` | `seas/shipping-lane/pacific` |
| `global` | `intl/organization` |

- **人工細修**：依週報原文，把明確點名公司或匯率的事件路徑補深。例如：
  - 10/16 台積電法說 → `tw/semiconductor/tsmc`
  - 10/16 新台幣貶值 → `tw/fx`
  - 10/30 Intel、Alphabet、Amazon → 加入 `places`
  - 10/23 Meta、CoreWeave → 加入 `places`
- 細修只能依原文，不可推測。每一處都在遷移的 commit 訊息中列出。
- 腳本對三期資料的輸出要有快照測試；細修後的結果也要通過驗證。

### 5.4 切換方式
程式、schema、三期資料、種子清單、說明書在**同一次合併**中一起切到 v2。合併前執行的排程照 v1 說明書產出；合併後執行的照 v2 產出，不會有新舊格式混在一起的週。

排程 prompt 不需要修改（它只寫「照說明書做」）。若合併時已經有 v1 格式的新週檔進入 main，就在合併前用遷移腳本一併轉換。

## 6. 排程說明書（`docs/WEEKLY_DATA_GUIDE.md`）更新
- 實體表改為三層：地區表、部門表（附允許的地區），以及「先查 `data/world/registry.json` 確認實體是否存在」。
- 新增「何時新增實體」的規則：
  - 週報明確點名、而且是事件主角或重要相關方的公司、組織、商品或航道，才新增。
  - 人物不新增。
  - 已存在（含別名比對）就沿用。
  - 拿不準該放哪個部門時，就只寫到部門層，不新增實體。
- 路徑對應原則：`primary` 選最直接受衝擊的最深一層；`places` 列出事件中明確提到的其他位置。
- 完整範例改用 v2 格式的 `2026-10-30.json`（由測試確保逐字嵌入）。

## 7. 測試
- **單元測試**：
  - 投影：已知經緯度轉換結果、wrap 邊界。
  - 版面：結果確定、各島不重疊、方位關係維持、台灣偏移量上限。
  - 路徑工具：parse、format、祖先、子孫判斷。
  - 部門允許表、實體清單合併、v2 驗證器（每條新規則都要有一個正例和至少一個反例）。
  - 遷移腳本：三期資料的快照。
  - 指標對照表：指標轉儀表讀數的邊界值。
  - 區塊格位計算、實體建築外觀的雜湊（同一個 id 結果相同）。
  - 「最多 4 棟」的挑選順序。
- **E2E**：
  - 沿用 v1 全部 20 項（必要時調整選擇器）。
  - 新增：
    - 點擊台積電，得到 `tw/semiconductor/tsmc` 和正確的麵包屑；
    - 點擊台灣島，面板列出台積電的事件；
    - 合成週帶一個新實體時，它會出現在世界與面板中；
    - 引用某島原本沒有的部門時，會自動長出區塊；
    - 手機版預設對準亞太；
    - 全圖說明文字可見。
- **CI 演練**：合成週腳本改產生 v2 格式，並包含一個 `newEntities` 和一個新區塊引用。
- **目視驗證**：桌機全圖、亞太特寫、手機版各截一張圖，確認方位與比例符合預期。

## 8. 風險與對策
| 風險 | 對策 |
|---|---|
| 物件變多造成手機效能不足 | 縮放分級；每個區塊最多 4 棟實體；低效能模式關閉陰影並減少粒子；以 E2E 確認手機版可載入 |
| 排程濫建實體或建錯部門 | 驗證器檢查重名與別名；說明書規定只有明確點名時才新增；拿不準就停在部門層 |
| 鬆弛後的位置讓方位看起來不對 | 方位關係以測試鎖定；台灣彈簧加強；畫面附說明 |
| 切換過程中排程剛好執行 | 同一次合併原子切換；必要時先遷移已進入 main 的 v1 新週 |
| GDP 數字不準 | 註明為約略值與年份；實作時對照 IMF 最新值 |

## 9. 後續子專案需要的骨架介面（本子專案要預留）
- **路徑即節點 id**：子專案 2 的傳導管道會以路徑為端點，例如 `gulf/energy → us → us/central-bank → us/bonds → us/equity → tw/equity`。`WorldGraph.nearest(path).anchor()` 會用來決定海底管線的端點。
- **指標對照表可擴充**：子專案 3 會把每列擴充成部門狀態向量，並加入每日資料源欄位（來源、時間戳記）。對照表的型別要預留選填欄位 `source?`。
- **儀表與建築分離**：子專案 3、4 可以在任何節點掛上新的儀表（例如情境推演的「預估方向」箭頭），不需要改建築。
- **事件連結**：v2 的 `links` 維持事件到事件。子專案 2 會新增選填欄位 `links[].channel`（管道 id），屆時以向下相容的方式擴充 schema。
