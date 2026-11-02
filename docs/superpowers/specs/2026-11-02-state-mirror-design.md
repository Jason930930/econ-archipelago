# 完整狀態鏡像 — 設計規格（總體金融數位孿生・子專案 3）

- 日期：2026-11-02
- 狀態：使用者已核可設計（分 5 節逐節確認），並指示直接實作
- 前置：常駐傳導網絡（`docs/superpowers/specs/2026-11-02-transmission-network-design.md`）
- 分支：`feat/state-mirror`

## 1. 目標與成功標準

傳導網絡的 36 個節點，每個都有一張**狀態卡**：目前水準（相對過去 5 年的高／中／低）、近期方向（↑ → ↓）、資料日期與來源。有可靠數字的節點由 GitHub Actions 每天從 FRED 抓取；沒有數字的節點由每週排程依週報填寫定性判斷。世界在兩次週報之間也會更新。子專案 4（情境推演）以這些狀態作為起始狀態。

成功標準：
1. 36 個節點都有狀態：16 個來自 FRED、2 個來自週報指標、18 個來自週報定性判斷；沒有資料的節點明確顯示「未知」。
2. 每天自動抓取 FRED、提交 `data/state/fred.json` 並觸發部署；抓取失敗時網站維持前一天的資料。
3. 世界中每個節點有狀態徽章（方向箭頭＋水準顏色），拉近或開網絡模式時顯示；點擊開出狀態卡。
4. 節點面板有狀態卡（數值、5 年區間條、方向、走勢、日期、來源）；「世界狀態」總覽列出全部 36 個；本週故事面板列出「本週狀態轉變」。
5. 三期舊週報依原文補上定性狀態（第 7 節）。
6. 建置與測試不依賴網路；v1、v2、子專案 2 的功能與測試都不退化。

非目標：預測或任何量化模型（子專案 4）、盤中資料、抓取證交所（會封鎖雲端 IP）、在網頁上編輯狀態、為新節點設計新儀表、沿管道傳播狀態（子專案 4）。

## 2. 狀態模型（`src/world/state.ts`，純邏輯）

```ts
type Level = 'high' | 'mid' | 'low';
type Direction = 1 | 0 | -1;
type Freshness = 'fresh' | 'aging' | 'stale' | 'unknown';

interface NodeState {
  node: string;                       // 節點 id，例 'us.long-yield'
  kind: 'numeric' | 'qualitative';
  level: Level | null;                // null = 無法判斷（未知或無歷史基準）
  percentile: number | null;          // 0–100，僅數值節點且有足夠歷史時
  direction: Direction | null;
  value: number | null;               // 原始數值（反向序列也存原始值）
  unit: string | null;
  asOf: string | null;                // 資料日期 YYYY-MM-DD
  source: StateSource | null;
  freshness: Freshness;
  basis: string | null;               // 定性：週報依據一句話
  carriedWeeks: number;               // 定性：沿用了幾週（本週填寫 = 0）
}
type StateSource =
  | { kind: 'fred'; series: string; url: string; label: string }
  | { kind: 'report'; weekId: string; evidence: string[] };
```

### 2.1 來源對照表（`src/world/stateSources.ts`）

36 個節點各對應一筆，且只有一筆（測試保證）：

```ts
type NodeSource =
  | { kind: 'fred'; series: string; transform: 'level' | 'yoy'; invert?: true; unit: string; cadence: 'daily' | 'monthly'; label: string; sane: [number, number] }
  | { kind: 'report-numeric'; indicator: IndicatorKey; unit: string }
  | { kind: 'report-qualitative' };
```

| 節點 | 來源 | 序列／指標 | 轉換 | 反向 | 頻率 | 單位 |
|---|---|---|---|---|---|---|
| gulf.oil-price | FRED | DCOILBRENTEU | level | | daily | 美元／桶 |
| us.inflation | FRED | CPIAUCSL | yoy | | monthly | % |
| us.policy-rate | FRED | DFEDTARU | level | | daily | % |
| us.long-yield | FRED | DGS10 | level | | daily | % |
| us.dollar | FRED | DTWEXBGS | level | | daily | 指數 |
| us.equity | FRED | SP500 | level | | daily | 點 |
| us.tech-valuation | FRED | NASDAQCOM（以 Nasdaq 綜合指數代理） | level | | daily | 點 |
| ez.inflation | FRED | CP0000EZ19M086NEST | yoy | | monthly | % |
| ez.policy-rate | FRED | ECBDFR | level | | daily | % |
| ez.energy-cost | FRED | PNGASEUUSDM（歐洲天然氣） | level | | monthly | 美元／百萬英熱 |
| jp.policy-rate | FRED | IRSTCI01JPM156N | level | | monthly | % |
| jp.yen | FRED | DEXJPUS（日圓兌美元） | level | ✓ | daily | 日圓／美元 |
| au.commodities | FRED | PIORECRUSDM（鐵礦砂） | level | | monthly | 美元／噸 |
| intl.bitcoin | FRED | CBBTCUSD | level | | daily | 美元 |
| intl.risk-appetite | FRED | VIXCLS（以 VIX 反向代理） | level | ✓ | daily | 點 |
| tw.twd | FRED | DEXTAUS（新台幣兌美元） | level | ✓ | daily | 新台幣／美元 |
| intl.gold | 週報指標 | gold | | | | 美元／盎司 |
| tw.equity | 週報指標 | taiex | | | | 點 |
| 其餘 18 個 | 週報定性 | | | | | |

`sane` 是合理範圍（例：DGS10 `[0, 20]`、DCOILBRENTEU `[5, 300]`），超出視為壞資料。
反向序列的意思：數值越高，節點變數越低（例：USD/JPY 上升 = 日圓走弱）。水準與方向在反向之後計算；顯示時保留原始數值並加註「數值越高日圓越弱」。

### 2.2 數值節點的計算

參考日 `ref`：某一週的狀態用該週五（weekId）；最新狀態用 `fred.json` 的 `fetchedAt` 日期。

- **取值**：序列中日期 ≤ `ref` 的最後一個點。`asOf` = 該點日期。找不到 → `freshness: 'unknown'`，其餘欄位為 null。
- **YoY 轉換**（月資料）：`v[t] / v[t−12 個月] − 1`（百分比，取兩位小數）；缺 12 個月前的點就跳過該月。
- **水準**：以 `ref` 往前 5 年內的點（含當點）計算百分位（≤ 當值的比例 × 100，取整數）。點數不足 26（週）或 24（月）時，`level`、`percentile` 為 null（顯示「無歷史基準」）。≥ 80 → 高、≤ 20 → 低、其餘中。反向序列用 `100 − 百分位`。
- **方向**：比較當值與回看點（日資料：`asOf` 往前 28 天內最接近 28 天前的點；月資料：3 個月前）。門檻 = 0.5 × 過去 5 年同間隔變化量的標準差；|變化| > 門檻才算 ↑／↓，否則 →。標準差為 0 時，任何非零變化都算。反向序列方向取反。回看點不存在 → `direction: null`。
- **新鮮度（FRED）**：`ref − asOf` ≤ 14 天（日資料）或 ≤ 100 天（月資料；月資料標在當月 1 日，下一筆常在 M+2 月中旬才發布）為 fresh，否則 stale。
- **週報指標（金價、台股）**：值取該週已補值的指標（`resolveIndicators`）；`asOf` = 指標實際來源週的週五；`freshness`：fresh／沿用上週 = stale／無 = unknown。水準以檔案庫中的週值計算，週數 < 26 時為 null。方向：與 4 週內最早的週值比較，變化幅度 ≥ 1% 才算 ↑／↓。

### 2.3 定性節點的計算

- 來源：週檔的 `nodeStates`（第 4 節）。
- 本週有填 → `freshness: 'fresh'`、`carriedWeeks: 0`。
- 本週沒填、較早週有填 → 沿用最近一次，`carriedWeeks` = 相隔週數（依檔案庫週次計），1–7 週為 `aging`，≥ 8 週為 `stale`。
- 從未填過 → `unknown`。
- `asOf` = 填寫該狀態那一週的 weekId。

### 2.4 索引（`ArchiveIndex.state`）

```ts
state: {
  byWeek: Record<weekId, Record<nodeId, NodeState>>;
  latest: Record<nodeId, NodeState>;      // FRED 用 fetchedAt；其他節點同最新一週
  latestRef: string | null;               // fetchedAt 日期
  series: Record<nodeId, [string, number][]>; // 數值節點：從「最新 − 2 年」與「最舊週 − 1 年」較早者起的樣本（已轉換，原始方向），供走勢圖
}
```

網頁看最新一週時用 `latest`，看較早的週用 `byWeek[weekId]`。

## 3. 資料管線

### 3.1 抓取腳本（`scripts/fetch-fred.ts`）

- 對來源表中每個 FRED 序列下載 `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<ID>&cosd=<起點>`（不需金鑰）；起點 = 今天與最舊週檔中較早者再往前 6 年，讓舊週的 5 年視窗不會隨時間縮短。
- 所有序列都和舊檔相同時沿用舊檔（含 `fetchedAt`），工作流程就不會提交。
- 解析 CSV，略過值為 `.` 的列；日資料每週只保留「該週五當天或之前的最後一個觀測值」（記錄觀測日），月資料保留全部月點；另記錄最新觀測值 `latest`。
- 寫入 `data/state/fred.json`：

```json
{ "fetchedAt": "2026-11-03T22:17:05Z",
  "series": { "DGS10": { "cadence": "daily", "latest": ["2026-10-29", 4.98], "samples": [["2020-11-06", 0.83], …] } } }
```

- 每個序列都要通過檢查：數值皆為有限數、日期遞增、全部落在 `sane` 範圍、至少 1 個點。不通過或下載失敗 → 沿用既有檔案中的該序列（若有），並在輸出列出警告。
- 全部序列都失敗 → 不寫檔，結束代碼非 0。
- 下載函式可注入（測試用替身），重試 2 次、逾時 30 秒。
- 只保留週樣本＋最新值（約 60 KB），不存完整日資料：部分序列（S&P 500、Nasdaq）有版權，網站僅作個人非商業展示並標註來源。

### 3.2 檔案驗證

- `schema/fred.schema.json` 定義上述格式；`npm run validate` 會在 `data/state/fred.json` 存在時一併驗證（schema + 檢查第 3.1 節的規則）。來源表需要但檔案裡沒有的序列只印出提醒（相關節點顯示「未知」），不擋建置，以免新增序列或某序列首次抓取失敗時卡住整個每日更新。檔案不存在時也只印出提醒。

### 3.3 每日工作流程（`.github/workflows/fred.yml`）

- 觸發：`schedule: '17 22 * * *'`（台北 06:17）與 `workflow_dispatch`。
- 權限：`contents: write`、`actions: write`。
- 週六排程推送前一定先 `git pull --rebase origin main`（說明書第 1 節）。
- 步驟：checkout main → `npm ci` → `npx tsx scripts/fetch-fred.ts` → `npm run validate` → `npm test` → 檔案有變動才提交（`data: FRED <日期>`，作者 github-actions[bot]）→ `git pull --rebase` 後推送，最多重試 3 次 → 推送成功後 `gh workflow run deploy.yml --ref main`（以 GITHUB_TOKEN 推送的提交不會觸發其他工作流程，workflow_dispatch 例外）。
- 沒有變動就不提交、不部署。
- 與週六排程共用 main：兩者修改不同檔案（`data/state/` 與 `data/weeks/`），rebase 不會衝突。

### 3.4 建置

`npm run index` 讀取 `data/state/fred.json`（可不存在）與所有週檔，算出 `ArchiveIndex.state`。不存在時 FRED 節點為「未知」，建置照常成功。建置與測試都不連網。

## 4. 週資料：`nodeStates`

```json
"nodeStates": [
  { "node": "tw.foreign-flow", "level": "low", "direction": -1, "basis": "外資賣超約 815.82 億元", "evidence": ["e4"] }
]
```

Schema：選填陣列；每筆 `additionalProperties: false`，`node` 字串、`level` ∈ {high, mid, low}、`direction` ∈ {1, 0, −1}、`basis` 字串、`evidence` 字串陣列（至少 1 個）。

驗證規則（`npm run validate`）：
1. `node` 必須是節點 id，且來源為「週報定性」；填了 FRED 或週報指標節點時拒絕，訊息說明該節點的資料來源（例：「us.long-yield 由 FRED DGS10 自動更新，不要填寫」）。
2. 同一週同一節點只能一筆。
3. `basis` 去空白後不可為空。
4. `evidence` 每個都是本週事件 id，且該事件的某個 place 碰到節點路徑（「碰到」同子專案 2）。

## 5. 畫面：狀態徽章（`src/render/layers/stateBadges.ts`）

- 每個節點一個 CSS2D 徽章，位置為 `graph.nearest(node.path)` 的落點。同一路徑多個節點（`us/tech`、`tw/equity`）在同一群組裡並排。地區層節點（`us`、`ez`、`intl`）放在島名下方。
- 內容：方向箭頭（↑ → ↓；方向未知時「·」）；底色依水準：低 `#4a90d9`、中 `#8a96a3`、高 `#e0a030`；水準未知時白底灰框。未知節點顯示「?」。stale 為虛線框、半透明；aging 不另外標示。
- 不使用紅綠：水準是「相對歷史的位置」，不是漲跌，避免和紅漲綠跌混淆。每個徽章有 `aria-label`（例：「美債長天期殖利率：高，上升」）。
- 顯示時機：鏡頭縮放 ≥ 1.8 或網絡模式開啟；地區層的 3 個節點永遠顯示。
- 滑過顯示提示（例：「美債長天期殖利率 4.98%・高（5 年第 92 百分位）・↑・10/29」）；點擊等同點擊該節點（`onPick` 回傳 `{ kind: 'node', path }`）。
- `WorldView.setNodeStates(states: Record<string, NodeState>)`；區塊或實體重建後重建徽章。
- 既有 9 個指標儀表不變。

## 6. UI

- **狀態卡**（`src/ui/stateCard.ts`）：節點面板列出路徑位於所點位置（含下層）的節點（`isWithin(node.path, path)`）；地區面板以精簡列呈現。卡片內容：名稱、數值＋單位（反向序列加註）、水準徽章與 5 年區間條（標出目前位置與百分位）、方向（「↑ 4 週前 4.61 → 4.98」；定性節點只顯示箭頭）、走勢圖（數值節點；FRED 用 `state.series` 截到參考日的最近 52 點；週報指標用檔案庫週值）、資料日期與新鮮度文字（「資料日期 10/29」「沿用 3 週前」「已 8 週未更新」「尚無資料」）、來源（「FRED DGS10」連到 `https://fred.stlouisfed.org/series/DGS10`；或「依 10/30 週報 e3：」＋ basis，事件可點）。
- **世界狀態總覽**（頂欄「世界狀態」按鈕，`data-action="state"`）：依地區分組列出 36 個節點（名稱、水準、箭頭、數值、日期）；頂部摘要「高 N・中 N・低 N・未知 N」；點一列 = 選取該節點。
- **本週狀態轉變**（本週故事面板）：和上一週比，水準或方向改變的節點，最多 5 個（先列水準改變，再列方向改變；依節點順序），例「日圓 中 → 低」「全球風險偏好 方向轉 ↓」。第一週不顯示。
- **管道面板**：兩端名稱旁加上該節點的水準＋箭頭小標。
- **文字模式**：新增「世界狀態」段落，內容同總覽。
- **固定說明**（狀態卡、總覽）：「高／中／低為相對過去 5 年的位置，不代表好壞，也不是預測。」
- **資料來源說明**（總覽、README）：「部分數據來自 FRED（聖路易聯邦準備銀行），各指數版權屬原提供者。」
- 所有來自週檔的文字（basis 等）一律以 textContent 寫入。

## 7. 舊資料回填（依週報原文）

| 週 | 節點 | 水準 | 方向 | 依據（evidence） |
|---|---|---|---|---|
| 10/16 | tw.foreign-flow | 低 | ↓ | 「外資連 8 個交易日賣超，10/16 賣超 461 億元」（e4） |
| 10/16 | tw.tsmc | 高 | ↑ | 「Q3 營收季增 16.2%、高於財測上緣，全年營收預估成長約 44%」（e4） |
| 10/23 | us.ai-capex | 高 | ↑ | 「Meta 把 2026 年資本支出下限上調至 1,350 億美元」（e1） |
| 10/23 | gulf.geopolitics | 高 | ↑ | 「川普稱未與伊朗談判；沙烏地 Shaybah 油田遭無人機攻擊」（e2） |
| 10/23 | seas.red-sea-risk | 高 | ↑ | 「紅海航運風險上升」（e2） |
| 10/23 | tw.foreign-flow | 低 | ↓ | 「外資賣超約 815.82 億元」（e4） |
| 10/30 | seas.hormuz-risk | 高 | ↑ | 「一艘油輪在荷莫茲海峽被附著爆裂物攻擊」（e3） |

10/23 e2 的原文明確提到沙烏地油田遇襲與紅海航運，但 places 只有 `gulf/energy`；回填時補上 `gulf/government` 與 `seas/shipping-lane/red-sea`，否則碰不到節點。其他候選（10/16 中東、10/30 AI 資本支出與台灣半導體）原文只描述情緒或沒有明確水準，不標。

## 8. 排程說明書與合成週

- 說明書新增第 12 節「節點狀態（nodeStates）」：用途；只在週報明確陳述時填；不要手動沿用上週（網站會自動沿用）；18 個定性節點的「高／低」意義表（例：外資買賣超 高 = 大幅買超、低 = 大幅賣超；台海緊張 高 = 緊張升高）；FRED 與週報指標節點不要填；evidence 的「碰到」規則；範例。
- 第 2 節的檔案結構加上 `nodeStates`。
- 合成週：rank 1 事件碰得到的第一個定性節點，加一筆 `{ level: 'mid', direction: 0, basis: '演練用狀態', evidence: [rank1] }`；碰不到就略過。
- 排程本身的提示不需修改（它照說明書做）。

## 9. 測試

- **單元**：來源表涵蓋 36 個節點各一次；百分位與 80／20 切點；方向門檻（含標準差為 0）；YoY 轉換；反向序列；週五取樣；新鮮度；定性沿用、aging、8 週 stale、未知；驗證器每條規則；`fred.json` schema 與合理性檢查；抓取腳本（注入替身：單一序列失敗沿用舊值、全部失敗不寫檔、壞資料被擋）；索引包含 `state`。
- **UI（jsdom）**：狀態卡（數值、反向註記、來源連結、定性 basis）、總覽摘要數字與 36 列、本週狀態轉變、管道面板端點小標、文字模式段落、XSS（basis 含 HTML 時以文字呈現）。
- **E2E**：拉近後徽章出現、點徽章開出狀態卡；總覽 36 列、點一列飛到節點；文字模式有「世界狀態」；合成週的演練狀態出現（只在演練時）。
- 測試用一份小型 `tests/fixtures/fred.json`；E2E 使用 repo 中實際的 `data/state/fred.json`（實作時第一次抓取後提交）。
- 每日工作流程無法在 CI 測試中執行；合併後手動觸發一次並確認結果。

## 10. 留給子專案 4 的介面

- `NodeState.level`、`direction`、`percentile`：推演的起始狀態。
- `stateSources.ts`：哪些節點有可驗證的數字（推演結果可以和日後實際數字對照）。
