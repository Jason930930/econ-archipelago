# 經濟群島 econ-archipelago — 設計規格

- 日期：2026-11-02
- 狀態：待審閱
- Repo：`Jason930930/econ-archipelago`（公開，GitHub Pages 部署）

## 1. 目標與成功標準

把每週由排程「每週財金五大事」產出的《財金週報》，自動演成一個可互動的 3D 經濟群島世界。

使用情境（已確認）：
1. **自己用**：每週複習，看懂事件之間的因果傳導，累積市場直覺。
2. **作品集／展示**：放上 GitHub 與 Pages，推甄或面試時展示，第一眼要有說服力。

成功標準：
- 打開任一週，可依因果順序「播放」該週 5 件大事；每則事件都能看到原文的數據、數據出入、對台灣的影響與來源連結。
- 世界狀態（油價、利率、殖利率、指數、黃金、比特幣、情緒）跨週持續演化，可用時間軸拖曳比較。
- 每週六排程跑完後，世界自動更新，不需要人工介入；資料有問題時網站不會壞，最差只是該週沒更新，並會通知使用者。
- 上線時即包含已存在的 3 期週報（10/10 測試期、10/17、10/24）。

非目標（第一版不做）：音效／音樂、多語系、登入與個人筆記、行動 App、即時行情串接。

## 2. 世界組成

### 2.1 實體清單（固定，事件只能對應這些 id）

| 島嶼 | 實體 id | 名稱 | 涵蓋 |
|---|---|---|---|
| 美國島 | `us-fed` | Fed 大樓 | 美國貨幣政策 |
| | `us-wallst` | 華爾街交易所 | 美股大盤 |
| | `us-bonds` | 美債塔 | 美債殖利率 |
| | `us-tech` | 科技園區 | Big Tech、AI 財報與資本支出 |
| 台灣島 | `tw-cbc` | 台灣央行 | 台灣貨幣政策、新台幣 |
| | `tw-twse` | 證交所 | 台股 |
| | `tw-fab` | 晶圓廠 | 半導體供應鏈 |
| 韓國島 | `kr-memory` | 記憶體廠 | Samsung、SK Hynix、HBM、記憶體價格 |
| 中東島 | `me-oil` | 油田 | 原油供給、中東地緣政治 |
| 歐洲島 | `eu-ecb` | ECB | 歐洲貨幣政策與經濟 |
| 日本島 | `jp-boj` | 日銀 | 日本貨幣政策、日圓 |
| 中國島 | `cn-industry` | 工業區 | 中國經濟、貿易 |
| 金庫礁 | `gold-vault` | 金庫 | 黃金 |
| 加密小島 | `crypto` | 加密島 | 比特幣、加密交易所 |
| 航道 | `sea-hormuz` | 荷莫茲海峽 | 能源運輸 |
| | `sea-pacific` | 太平洋航線 | 供應鏈、貿易、資金流 |
| 港口 | `global` | 公告板 | 無法對應上述實體的事件（兜底，不丟資料） |

實體清單在程式中只有一份來源（`src/world/entities.ts`），schema 的 enum 與說明書都由它產生或檢查，確保三者一致。

### 2.2 指標與視覺對應

| 指標鍵 | 意義 | 視覺 |
|---|---|---|
| `brent` | Brent 油價 | 油田火焰大小、航道油輪數 |
| `wti` | WTI 油價 | （僅資料卡顯示） |
| `fedFunds` | Fed 利率區間上緣 | Fed 大樓頂端光柱高度 |
| `us10y` | 美 10 年期殖利率 | 美債塔樓層高度 |
| `sp500` / `nasdaq` / `dow` | 美股指數 | 華爾街燈光顏色（漲跌）與亮度（幅度） |
| `taiex` | 加權指數 | 證交所燈光 |
| `cpiYoY` | 美國 CPI 年增率 | 美國島熱浪霧氣濃度 |
| `gold` | 黃金 | 金庫光暈 |
| `btc` | 比特幣 | 加密島閃爍強度 |
| `usdtwd` | 美元兌新台幣 | 台灣央行旗幟高度 |
| （計算）`sentiment` | 整體市場情緒 | 全世界天氣：晴／多雲／陰／暴風雨 |

- 情緒 = 當週事件 `sentiment` 依 `rank` 加權平均（rank 1 權重最高），映射到四段天氣。
- 漲跌配色預設**台股慣例紅漲綠跌**，可切換國際慣例；偏好存在 localStorage（讀寫皆 try/catch）。
- 指標→視覺參數的轉換是純函式，各自定義上下限並 clamp，超出範圍不會產生荒謬畫面。

### 2.3 主線（跨週）

事件可標記 `storylines`（slug，如 `fed-hiking-cycle`、`hormuz-tension`、`ai-capex`）。同一主線的事件跨週串連，在時間軸上方以軌道呈現。

## 3. 資料格式

### 3.1 檔案

- 每週一檔：`data/weeks/<週五日期 YYYY-MM-DD>.json`
- `data/index.json`：build 時由程式從所有週檔產生（週次清單、主線彙總、指標時間序列），**不由排程手寫**，避免衝突。

### 3.2 週檔結構（schemaVersion 1）

```jsonc
{
  "schemaVersion": 1,
  "weekId": "2026-10-30",                        // 必須等於檔名
  "period": { "start": "2026-10-24", "end": "2026-10-30" },
  "title": "財金週報（2026/10/24–2026/10/30）",
  "indicators": {                                // 所有鍵皆可省略
    "brent": { "value": 113, "range": [112, 115], "unit": "USD/bbl", "changePct": null, "note": "各來源報價時點不同" }
  },
  "events": [{
    "id": "e1",                                  // 週內唯一
    "rank": 1,                                   // 1..N，不重複
    "date": "2026-10-30",                        // 可為 null（跨多日事件）
    "title": "…",
    "what": "…",
    "why": "…",
    "discrepancy": "…",                          // 或 null
    "taiwanImpact": {                            // 或 null（週報未提及時必須為 null，不得推測）
      "summary": "…",
      "direction": -1,                           // -1 / 0 / +1
      "channels": ["半導體", "台股"]
    },
    "primaryEntity": "us-tech",                  // 必須在 entities 中
    "entities": ["us-tech", "us-wallst", "tw-fab"],
    "sentiment": -2,                             // 整數 -3..+3
    "storylines": ["ai-capex"],
    "metrics": [{ "label": "那斯達克", "value": "25,437.00", "change": "-2.86%" }],
    "sources": [{ "title": "Yahoo Finance", "url": "https://…" }]
  }],
  "links": [{ "from": "e3", "to": "e5", "label": "油價推升通膨" }],
  "storylines": [{ "id": "ai-capex", "name": "AI 資本支出疑慮" }],
  "watchlist": [{ "date": "2026-11-03", "text": "美國期中選舉", "entities": ["us-wallst"], "confirmed": true }]
}
```

指標物件欄位：`value`（number，必填）、`range`（[min,max]，選填）、`unit`、`changePct`（number 或 null）、`note`（選填）。

### 3.3 資料規則

- **照實記錄**：來源有出入時保留 `range`、`note` 與 `discrepancy` 原文；畫面上以虛線外框標示「數據有出入」。
- **缺值不補造**：某週缺的指標沿用上一週的值，標記為 stale，畫面變暗並顯示「沿用上週」。第一週就缺的指標以中性預設值呈現並標示「無資料」。
- **主線命名**：新主線首次出現時必須在 `storylines` 提供中文名稱；排程應先查 `data/index.json` 既有主線並盡量沿用。同 id 多週名稱不同時，以最早出現者為準。
- **來源網址**：存原始網址；Gmail 的 `https://www.google.com/url?q=…` 包裝必須拆除。只允許 https。

### 3.4 驗證（`npm run validate`，排程與 CI 共用）

1. JSON Schema（ajv）結構檢查。
2. 語意檢查：
   - `weekId` 等於檔名，`period.end` 等於 `weekId`，`start` ≤ `end`
   - 實體 id 皆在清單中；`primaryEntity` ∈ `entities`
   - `events[].id` 唯一；`rank` 為 1..N 且不重複
   - `links` 的 from/to 指向存在的事件，且 from ≠ to
   - 事件引用的主線，在本週 `storylines` 或既有 index 中有定義
   - 所有 URL 為 https 且不含 `google.com/url?q=`
3. 輸出人類可讀的錯誤清單（檔案、JSON 路徑、原因），任何錯誤 → exit code 非 0。

## 4. 互動與播放

### 4.1 畫面配置
- 全螢幕 3D 群島（Three.js，正交攝影機斜上方視角，低多邊形程式生成幾何體，無外部美術素材）。
- 頂部：週次標題、常駐免責聲明「僅為資訊整理，不構成任何買賣或個人化投資建議」。
- 右側：事件卡面板（手機寬度改為底部 sheet）。
- 底部：時間軸＋主線軌道＋播放控制。

### 4.2 模式
1. **自由探索**：拖曳平移、滾輪／雙指縮放；hover 地標顯示名稱與目前數值；點擊地標 → 面板列出本週相關事件與相關指標近 12 週迷你走勢圖。
2. **故事播放**：
   - 順序：依 `links` 做拓撲排序，同層依 `rank`；若有循環或無 links，退回純 `rank` 順序。
   - 每則事件：鏡頭飛到 `primaryEntity` → 地標動畫（依實體類型：火焰竄高、光柱升起、燈號轉色、樓層增減、船隻改道）→ 事件卡顯示完整內容 → 粒子沿 link 流向下一則事件地標並顯示 label。
   - 有 `taiwanImpact` 時，額外一道漣漪傳到台灣島並顯示摘要（顏色依 direction）。
   - 終幕：`watchlist` 以旗幟插在對應地標；未確認的項目標示「未確認」。
   - 控制：上一則／下一則／暫停／1×、2×。
3. **時間軸**：切換週次時世界狀態約 2 秒補間漸變；點擊主線 → 高亮跨週事件並可跳轉。

### 4.3 其他
- **深層連結**：`#/<weekId>` 與 `#/<weekId>/<eventId>`；無效連結回到最新一週並提示。
- **文字模式**：同內容的清單版；WebGL 不可用時自動切換，也可手動切換。
- **效能**：偵測行動裝置或低效能時關閉陰影、減少粒子；版面在手機寬度（16px 邊距）不產生水平捲動。
- 介面語言：繁體中文。

## 5. 自動化流程

### 5.1 排程「每週財金五大事」修改（trig_016gUrfm4KMeX7SJcUDzL9zb）

保留原步驟 (a) SendUserMessage、(b) Gmail 寄信，並：
- 週報每則事件新增「對台灣的影響」（無明確影響時寫「無直接影響」）。
- 新增步驟 (c)：
  1. `add_repo(owner: Jason930930, repo: econ-archipelago, access: push)`，依回傳指示 clone。
  2. 閱讀 `docs/WEEKLY_DATA_GUIDE.md`（schema、實體清單、對應原則、範例）與 `data/index.json`（既有主線）。
  3. 將同一份週報轉成 `data/weeks/<週五>.json`。
  4. `npm ci && npm run validate`。
     - 通過 → commit 並 `git push origin main`。
     - 失敗 → 依錯誤修正並重跑，最多 2 次；仍失敗 → 推到分支 `data/week-<日期>`，不動 main。
  5. 在 SendUserMessage 結尾附上世界更新狀態（成功＋Pages 連結，或失敗原因與分支名）。
- (c) 放最後且與 (a)(b) 獨立：(c) 失敗不影響週報傳送與寄信。

### 5.2 GitHub Actions（`.github/workflows/deploy.yml`）
- 觸發：push 到 main、手動觸發。
- 步驟：`npm ci` → `npm run validate` → `npm test` → `npm run build`（含產生 index.json）→ 部署 GitHub Pages。
- 任一步驟失敗 → 不部署，網站維持上一版。

### 5.3 回填
- 一次性：由開發時將 Gmail 中現有 3 期週報轉成週檔，`taiwanImpact` 僅依週報原文填寫，原文未提及者為 null。
- 10/10 那期主旨含「【測試寄送】」，仍納入，`title` 保留原主旨。

### 5.4 失敗情境
| 情境 | 結果 |
|---|---|
| 週報未產出（搜尋失敗） | 跳過 (c)，世界不更新 |
| 寄信失敗 | 依原排程處理；週報已產出時 (c) 照常執行 |
| add_repo / clone / push 失敗 | 世界不更新；SendUserMessage 註明原因 |
| 驗證失敗 | 推到 data 分支；main 與網站不受影響 |
| CI 驗證或測試失敗 | 不部署；網站維持上一版 |
| 某週缺指標 | 沿用上週並標示 stale |
| 事件無法對應實體 | 使用 `global` 公告板 |

## 6. 技術架構

- Vite + TypeScript + Three.js；UI 層用原生 TS + CSS（不引入 React）。
- 依賴版本全部鎖定（package-lock.json）。

```
econ-archipelago/
├─ data/weeks/*.json
├─ schema/week.schema.json
├─ src/
│  ├─ data/      載入、驗證、補值、index 產生（純邏輯）
│  ├─ world/     實體清單、指標→視覺參數、情緒→天氣（純邏輯）
│  ├─ story/     拓撲排序、播放狀態機（純邏輯）
│  ├─ render/    Three.js 場景：島嶼、地標、粒子、天氣、鏡頭
│  ├─ ui/        事件卡、時間軸、控制列、文字模式、深層連結
│  └─ main.ts
├─ scripts/validate.ts
├─ scripts/build-index.ts
├─ docs/WEEKLY_DATA_GUIDE.md
└─ .github/workflows/deploy.yml
```

關鍵邊界：`render/` 只接收已計算好的視覺參數（如 `{ oilFlame: 0.8, weather: 'storm' }`），不讀原始資料；`data/`、`world/`、`story/` 不依賴 Three.js 或 DOM，可在 Node 中單元測試。

## 7. 測試

- **Vitest 單元測試（TDD）**：驗證器（合法／各類不合法樣本）、補值與 stale 標記、拓撲排序（含循環、斷鏈、無 links）、指標→視覺參數邊界、情緒→天氣、深層連結解析、index 產生、Gmail 轉址拆除。
- **Playwright 煙霧測試**（環境內建 Chromium）：頁面載入且 canvas 有渲染、週次切換、播放從第一則走到終幕、深層連結開到指定事件、文字模式可用、手機寬度無水平捲動。
- **真實資料**：3 期回填週檔作為測試資料，CI 每次驗證。

## 8. 待使用者處理

- 在 GitHub 建立空的公開 repo `Jason930930/econ-archipelago`（本開發 session 無建立 repo 權限），並確保 Claude GitHub App 有該 repo 的存取權（排程推送需要）。
- 在 repo Settings → Pages 將 Source 設為「GitHub Actions」（若首次部署時 workflow 無法自動啟用）。
