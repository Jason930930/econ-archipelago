# 週資料說明書 v2（給「每週財金五大事」排程）

這份說明書告訴每週六的排程：怎麼把剛寫好的《財金週報》轉成經濟群島的週資料，並安全地推上 GitHub。**照做即可，不需要改任何程式碼。**

> 原則：週資料只能根據**本週週報的內容**填寫，不得自行推測或補上週報沒寫的數字、因果或地點。

## 1. 流程

1. 在 repo 根目錄執行 `npm ci`，再執行 `npm run index`（產生 `data/index.json` 與 `data/world/registry.json`）。
2. 讀 `data/index.json` 的 `storylines`（既有主線）與 `data/world/registry.json`（既有實體，含別名）。
3. 依本說明書新增 `data/weeks/<本週五日期 YYYY-MM-DD>.json`。**只新增這一個檔案，不改其他檔案**（新實體也寫在這個檔案的 `newEntities` 裡）。
4. 執行 `npm run validate`。
   - 通過（印出 `✓ N 週資料驗證通過`）：
     `git add data/weeks/<日期>.json && git commit -m "data: week <日期>" && git push origin main`
   - 失敗：依錯誤訊息（格式為 `檔名 JSON路徑: 原因`）修正後重跑，**最多重試 2 次**。仍失敗時：
     `git checkout -b data/week-<日期> && git add data/weeks/<日期>.json && git commit -m "data: week <日期> (validation failed)" && git push origin data/week-<日期>`
     **不要推到 main。**
5. 推到 main 後，GitHub Actions 會再驗證、測試，約 2–3 分鐘後自動部署網站：https://jason930930.github.io/econ-archipelago/
6. 另送一則簡短 SendUserMessage：「世界更新：已推送，部署中（網址）」或「世界更新：失敗（原因；分支 data/week-<日期>）」。
   `npm run validate` 與 CI 的資料檢查規則相同；通過驗證的週檔不會因資料問題卡住部署。

## 2. 檔案結構

格式版本為 v2（`schemaVersion: 2`）；v1 檔案會被驗證直接拒絕。

```jsonc
{
  "schemaVersion": 2,                           // 必須是 2
  "weekId": "2026-10-30",                       // 本週五日期，必須等於檔名
  "period": { "start": "2026-10-24", "end": "2026-10-30" },  // 上週六～本週五
  "title": "財金週報（2026/10/24–2026/10/30）",   // 與信件主旨相同
  "indicators": { … },                          // 見第 5 節
  "events": [ … ],                              // 5 則，見第 6 節
  "links": [ … ],                               // 因果連線，見第 7 節
  "storylines": [ … ],                          // 本週「新出現」的主線定義，見第 8 節
  "watchlist": [ … ],                           // 下週值得關注，見第 9 節
  "newEntities": [ … ],                         // 本週第一次出現的實體（可省略），見第 4 節
  "proposedChannels": [ … ],                    // 提議新的傳導管道（可省略），見第 11 節
  "nodeStates": [ … ]                           // 週報明確陳述的節點狀態（可省略），見第 12 節
}
```

## 3. 地點：三層路徑

世界裡每個位置都用**路徑**表示，深淺都可以：

| 深度 | 格式 | 例子 |
|---|---|---|
| 地區 | `地區` | `us`（整個美國，例如「美國經濟衰退疑慮」） |
| 部門 | `地區/部門` | `us/central-bank`、`jp/real-estate` |
| 實體 | `地區/部門/實體` | `tw/semiconductor/tsmc`、`seas/shipping-lane/hormuz` |

### 3.1 地區（第 1 層，固定）

| id | 名稱 | 說明 |
|---|---|---|
| `us` | 美國 | |
| `cn` | 中國 | |
| `ez` | 歐元區 | 德、法、義、西等歐元國；ECB |
| `jp` | 日本 | |
| `in` | 印度 | |
| `uk` | 英國 | 英格蘭銀行 |
| `asean` | 東南亞 | 東協各國合併 |
| `ca` | 加拿大 | |
| `br` | 巴西 | 拉美事件以巴西為主 |
| `ru` | 俄羅斯 | |
| `mx` | 墨西哥 | |
| `kr` | 韓國 | |
| `au` | 澳洲 | |
| `gulf` | 中東／海灣 | 沙烏地、阿聯、卡達等；中東地緣政治 |
| `tw` | 台灣 | |
| `seas` | 海域 | 只能用 `shipping-lane` 部門 |
| `intl` | 國際 | 跨國組織、國際商品與加密資產 |

### 3.2 部門（第 2 層，固定）

| id | 名稱 | 可用地區 |
|---|---|---|
| `central-bank` | 央行 | 15 個經濟體 |
| `government` | 政府與財政（含選舉、財政、產業政策） | 經濟體 |
| `trade` | 貿易與關稅 | 經濟體 |
| `equity` | 股市 | 經濟體 |
| `bonds` | 債市 | 經濟體 |
| `fx` | 匯市 | 經濟體 |
| `finance` | 銀行與金融 | 經濟體 |
| `energy` | 能源 | 經濟體（油價、OPEC 減產等中東事件用 `gulf/energy`） |
| `commodities` | 原物料 | 經濟體、`intl` |
| `industry` | 製造與工業 | 經濟體 |
| `tech` | 科技 | 經濟體 |
| `semiconductor` | 半導體 | 經濟體 |
| `memory` | 記憶體 | 經濟體 |
| `real-estate` | 房地產 | 經濟體 |
| `consumer` | 消費 | 經濟體 |
| `crypto` | 加密 | 經濟體、`intl` |
| `shipping-lane` | 航道 | 只有 `seas` |
| `organization` | 國際組織 | 只有 `intl` |

島上原本沒有的部門也可以用（例如 `jp/real-estate`），網站會自動長出那個區塊。

### 3.3 對應原則

- `primary`：最直接受衝擊、故事主角所在的**最深一層**路徑。必須同時出現在 `places`。
- `places`：事件中明確提到的位置都列進來（例如 AI 財報牽動台灣供應鏈 → `["us/tech", "us/equity", "tw/semiconductor"]`）。
- 週報點名的公司若已在 `registry.json`（比對名稱與別名），就用它的實體路徑；拿不準部門時，只寫到部門層（連部門都拿不準就寫到地區層）。
- `places` 不可重複：同一個路徑只列一次。

## 4. 新增實體（newEntities）

週報點名了某家公司、組織、商品或航道，而它是**事件主角或重要相關方**，但 `data/world/registry.json` 裡還沒有（名稱與別名都比對過）時，才新增：

```json
"newEntities": [
  { "id": "micron", "name": "美光", "region": "us", "sector": "memory", "aliases": ["Micron"] }
]
```

規則：
1. **人物不新增**（Powell、川普等寫在事件文字裡就好）。
2. `id` 用小寫英文、數字與連字號；`name` 用中文通用名或原文。常見的另一種寫法放進 `aliases`（例如中文名與英文名互為別名）。`aliases` 必填，沒有別名就寫 `[]`。
   只填 `id`、`name`、`region`、`sector`、`aliases`（航道另加 `geo`）。`registry.json` 裡看到的 `addedIn` 由系統自動產生，**不要填 `addedIn`**（填了會驗證失敗）。
3. `region`、`sector` 必須符合第 3 節的表；已存在（名稱或別名相同，不分大小寫、忽略空白）就**沿用，不要重建**。
4. 拿不準該放哪個部門時，就只寫到部門層，不新增實體。
5. 航道（`seas/shipping-lane`）實體必須附 `"geo": { "lat": 緯度, "lon": 經度 }`。

新增的實體可以在同一週的 `places` 直接引用。

## 5. 指標（indicators）

每個鍵都可省略；**週報沒寫到的指標就不要填**（網站會自動沿用上週並標示「沿用上週」）。

| 鍵 | 意義 | value 取法 |
|---|---|---|
| `brent` | Brent 原油（美元/桶） | 週五收盤；只有區間時見下方規則 |
| `wti` | WTI 原油（美元/桶） | 同上 |
| `fedFunds` | Fed 利率 | 區間**上緣**（3.75%–4.00% → 4.0），`range` 填 `[3.75, 4.0]` |
| `us10y` | 美 10 年期殖利率（%） | 週報最後提到的數值 |
| `sp500` | S&P 500 | 收盤點數 |
| `nasdaq` | 那斯達克 | 收盤點數 |
| `dow` | 道瓊 | 收盤點數 |
| `taiex` | 台股加權指數 | 收盤點數 |
| `cpiYoY` | 美國 CPI 年增率（%） | 最新公布值 |
| `gold` | 黃金（美元/盎司） | 收盤或週報採用值 |
| `btc` | 比特幣（美元） | 週報提到的價格 |
| `usdtwd` | 美元兌新台幣 | 收盤匯率（新台幣貶值 → 數字變大） |

欄位：`value`（必填，數字）、`range`（`[最低, 最高]`）、`unit`、`changePct`（數字或 `null`）、`note`。

- **changePct**：填週報寫的漲跌幅；有「週漲跌」就用週漲跌，只有單日就用單日，並在 `note` 註明口徑（例：`"10/30 單日漲跌"`）。新台幣貶值 1.43% → `usdtwd.changePct = 1.43`。
- **來源不一致**：週報有寫明採用哪個數字就用它；沒寫明時 `value` 取區間中點，`range` 填區間，`note` 寫「各來源報價時點不同，取區間中點」。
- 自行換算的數字（例如由點數換算週跌幅）一定要在 `note` 寫「自行換算」。

## 6. 事件（events，5 則）

| 欄位 | 規則 |
|---|---|
| `id` | `e1`～`e5`，依週報順序 |
| `rank` | 1～5，依週報順序（週報第 1 則 = 1） |
| `date` | 事件主要發生日 `YYYY-MM-DD`；跨多日或不明確時用 `null` |
| `title` | 週報標題原文 |
| `what` | 週報「發生了什麼」原文 |
| `why` | 週報「為什麼重要」原文；週報沒有時寫「週報未另述影響。」 |
| `discrepancy` | 週報「數據出入」「備註」原文；沒有則 `null` |
| `taiwanImpact` | 週報「對台灣的影響」；寫「無直接影響」或沒寫時 **必須是 `null`** |
| `primary` / `places` | 路徑，見第 3 節 |
| `sentiment` | 整數 -3～+3（見下表） |
| `storylines` | 主線 id 陣列，可為空 |
| `metrics` | `[{ "label", "value", "change"? }]`，關鍵數字，皆為字串 |
| `sources` | `[{ "title", "url" }]`，至少 1 個；url 必須是 `https://` 原始網址 |
| `channels` | 選填：本則事件內點亮的精選管道 id（見第 11 節）；和 `taiwanImpact.channels` 不同，不可填中文 |

`taiwanImpact` 格式：`{ "summary": "一句話改寫週報的台灣影響", "direction": -1 | 0 | 1, "channels": ["半導體", "台股", "匯率", …] }`；direction：對台灣市場偏負面 -1、中性 0、偏正面 +1。

`sentiment` 判準（對整體市場的影響）：

| 值 | 意義 |
|---|---|
| -3 | 重大利空（指數單日大跌 2.5% 以上、危機級事件） |
| -2 | 明顯利空 |
| -1 | 輕微利空 |
| 0 | 中性或好壞參半 |
| +1 / +2 / +3 | 對應程度的利多 |

**來源網址**：Gmail 會把連結包成 `https://www.google.com/url?q=<原始網址>&...`，一律改存 `<原始網址>`（驗證會擋下轉址網址）。

## 7. 因果連線（links）

`{ "from": "e3", "to": "e5", "label": "能源價格推升通膨" }`

- **只連週報有明寫的因果**（例如「能源價格推升通膨與升息預期」→ 油價事件 → 通膨事件）。
- `label` 10 字左右，用週報的說法。
- 不可自己連到自己，不可形成循環（循環時網站會退回依 rank 播放）。
- 沒有明確因果的週，`links` 可以是空陣列。
- 這條因果正好走某條精選傳導管道時，加上 `"channel": "<管道 id>"`（見第 11 節）。

## 8. 主線（storylines）

主線把跨週的同一件事串起來。先看 `data/index.json` 的 `storylines`，**能沿用就沿用**既有 id：

- 沿用既有主線：只在事件的 `storylines` 填 id，週檔的 `storylines` 不用重複定義。
- 真的是新主線：在週檔的 `storylines` 加 `{ "id": "小寫英文-連字號", "name": "中文名稱" }`，再在事件中引用。

## 9. 下週值得關注（watchlist）

`{ "date": "2026-11-06" | null, "text": "…", "places": ["us/central-bank"], "confirmed": true | false }`

- 週報寫「未確認」「依慣例」「日期可能調整」→ `confirmed: false`。
- 「持續關注」類沒有日期的項目 → `date: null`。

## 10. 完整範例（2026-10-30）


```json
{
  "schemaVersion": 2,
  "weekId": "2026-10-30",
  "period": {
    "start": "2026-10-24",
    "end": "2026-10-30"
  },
  "title": "財金週報（2026/10/24–2026/10/30）",
  "indicators": {
    "brent": {
      "value": 113.5,
      "range": [
        112,
        115
      ],
      "unit": "USD/bbl",
      "changePct": null,
      "note": "各來源報價時點不同（Yahoo 內文 112、另一段摘要約 115），取區間中點"
    },
    "wti": {
      "value": 103.5,
      "range": [
        103,
        104
      ],
      "unit": "USD/bbl",
      "changePct": null,
      "note": "約 103–104 美元，取區間中點"
    },
    "fedFunds": {
      "value": 4,
      "range": [
        3.75,
        4
      ],
      "unit": "%",
      "note": "10/28 維持 3.75%–4.00%，取上緣"
    },
    "us10y": {
      "value": 4.93,
      "unit": "%",
      "changePct": null,
      "note": "10/30 報價；10/28 約 5.05%"
    },
    "sp500": {
      "value": 7580.07,
      "changePct": -1.82,
      "note": "10/30 單日漲跌（Yahoo 收盤報價）；10 月約 -1.2%"
    },
    "nasdaq": {
      "value": 25437,
      "changePct": -2.86,
      "note": "10/30 單日漲跌（Yahoo 收盤報價）；10 月累計約 -5.2% 至 -5.3%"
    },
    "dow": {
      "value": 51770.31,
      "changePct": -1.09,
      "note": "10/30 單日漲跌（Yahoo 收盤報價）；TheStreet 為 51,785.82"
    },
    "taiex": {
      "value": 45211.83,
      "changePct": -2.49,
      "note": "10/30 單日漲跌"
    },
    "cpiYoY": {
      "value": 3.7,
      "unit": "%",
      "note": "9 月 CPI"
    },
    "gold": {
      "value": 3936,
      "range": [
        3886,
        3986
      ],
      "unit": "USD/oz",
      "changePct": null,
      "note": "12 月期貨，報價 3,886–3,986 美元不等，取區間中點"
    },
    "btc": {
      "value": 76700,
      "unit": "USD",
      "changePct": -2.7,
      "note": "Yahoo 報導"
    }
  },
  "events": [
    {
      "id": "e1",
      "rank": 1,
      "date": "2026-10-30",
      "title": "大型科技財報引爆 AI 支出疑慮，那斯達克單日重挫、10 月跌逾 5%",
      "what": "Alphabet、Amazon 財報被報導低於預期，Intel 因第四季財測遠弱於預期，10/30 股價收跌約 29%。10/30 美股收盤：道瓊 51,770.31（-1.09%）、S&P 500 7,580.07（-1.82%）、那斯達克 25,437.00（-2.86%）。那斯達克 10 月累計約 -5.2% 至 -5.3%，為 2025 年 3 月以來最差單月；S&P 500 10 月約 -1.2%。費半 ETF 單日約 -7.9%。",
      "why": "市場焦點從 AI 需求轉向巨額資本支出能否換來獲利，並牽動半導體與台灣供應鏈情緒。",
      "discrepancy": "Yahoo 內文與收盤報價框的道瓊跌點、S&P 跌幅略有不同；TheStreet 收盤數字為道瓊 51,785.82、S&P 7,578.97、那斯達克 25,442.31，此處採 Yahoo 收盤報價。「Intel 為 1974 年以來最差單日」僅見於單一來源，未能獨立查證。",
      "taiwanImpact": {
        "summary": "AI 資本支出疑慮牽動半導體與台灣供應鏈情緒。",
        "direction": -1,
        "channels": [
          "半導體",
          "供應鏈"
        ]
      },
      "primary": "us/tech",
      "places": [
        "us/tech",
        "us/equity",
        "tw/semiconductor",
        "us/semiconductor/intel",
        "us/tech/alphabet",
        "us/tech/amazon"
      ],
      "sentiment": -3,
      "storylines": [
        "ai-capex"
      ],
      "metrics": [
        {
          "label": "那斯達克",
          "value": "25,437.00",
          "change": "-2.86%"
        },
        {
          "label": "S&P 500",
          "value": "7,580.07",
          "change": "-1.82%"
        },
        {
          "label": "道瓊",
          "value": "51,770.31",
          "change": "-1.09%"
        },
        {
          "label": "Intel",
          "value": "單日約 -29%"
        },
        {
          "label": "費半 ETF",
          "value": "單日約 -7.9%"
        },
        {
          "label": "那斯達克 10 月",
          "value": "約 -5.2% 至 -5.3%"
        }
      ],
      "sources": [
        {
          "title": "Yahoo Finance",
          "url": "https://finance.yahoo.com/markets/live/stock-market-today-friday-october-30-dow-sp-500-nasdaq-amazon-intel-ai-sell-off-191429143.html"
        },
        {
          "title": "TheStreet",
          "url": "https://www.thestreet.com/stock-market-today/stock-market-today-dow-jones-sp-500-nasdaq-updates-oct-30-2026"
        }
      ],
      "channels": [
        "ai-capex-to-tw-semis"
      ]
    },
    {
      "id": "e2",
      "rank": 2,
      "date": "2026-10-28",
      "title": "Fed 10/28 維持利率 3.75%–4.00%，兩位官員主張再升息",
      "what": "Fed 以 10 比 2 決議按兵不動，理事 Cook 與克里夫蘭聯銀總裁 Hammack 持異議，主張升息 25 bp。此區間是 9 月升息 25 bp（三年來首度）後的水準。聲明將經濟成長形容為「strong pace」；9 月非農僅增 2.9 萬人、失業率 4.2%。會後 Musalem、Barkin 等官員也表示利率需要上調。",
      "why": "降息預期已轉為升息預期；會前 CME FedWatch 顯示 12 月升息機率約 73%（會前數據，會後未查得更新）。下次會議為 12/8–9。",
      "discrepancy": "會前 FedWatch 同時顯示 10 月維持不變機率約 90.6%，與 12 月升息機率屬不同會議。",
      "taiwanImpact": null,
      "primary": "us/central-bank",
      "places": [
        "us/central-bank"
      ],
      "sentiment": -2,
      "storylines": [
        "fed-hiking-cycle"
      ],
      "metrics": [
        {
          "label": "聯邦基金利率",
          "value": "3.75%–4.00%",
          "change": "維持不變"
        },
        {
          "label": "投票",
          "value": "10 比 2"
        },
        {
          "label": "12 月升息機率（會前）",
          "value": "約 73%"
        },
        {
          "label": "9 月非農",
          "value": "+2.9 萬人",
          "change": "失業率 4.2%"
        }
      ],
      "sources": [
        {
          "title": "INDmoney",
          "url": "https://www.indmoney.com/blog/us-stocks/fed-rate-decision-october-inflation-stock-market-impact"
        },
        {
          "title": "Kiplinger",
          "url": "https://www.kiplinger.com/investing/live/fed-meeting-updates-and-commentary-october-2026"
        },
        {
          "title": "CNBC",
          "url": "https://www.cnbc.com/2026/10/28/fed-interest-rate-decision-october-2026.html"
        }
      ]
    },
    {
      "id": "e3",
      "rank": 3,
      "date": "2026-10-30",
      "title": "荷莫茲海峽緊張，油價維持高檔、黃金跌破 4,000 美元",
      "what": "10/30 一艘油輪在荷莫茲海峽被附著爆裂物攻擊（據 UKMTO，攻擊者不明）。Brent 約 112–115 美元、WTI 約 103–104 美元，油價 10 月可能連續第四個月上漲。黃金 12 月期貨一度跌破 4,000 美元，報價 3,886–3,986 美元不等（-2% 至 -3.6%）。",
      "why": "能源價格推升通膨與升息預期，並壓抑風險資產；市場也在關注美國期中選舉後的中東局勢。",
      "discrepancy": "各來源油價與金價報價時點不同（Yahoo 內文 Brent 112、另一段摘要約 115；金價 3,934–3,986），未能取得一致的收盤價。「美伊緊張」主要來自標題與二手摘要，Yahoo 黃金文章內文未點名伊朗。",
      "taiwanImpact": null,
      "primary": "seas/shipping-lane/hormuz",
      "places": [
        "seas/shipping-lane/hormuz",
        "gulf/energy",
        "intl/commodities/gold"
      ],
      "sentiment": -2,
      "storylines": [
        "mideast-energy"
      ],
      "metrics": [
        {
          "label": "Brent",
          "value": "約 112–115 美元"
        },
        {
          "label": "WTI",
          "value": "約 103–104 美元"
        },
        {
          "label": "黃金 12 月期貨",
          "value": "3,886–3,986 美元",
          "change": "-2% 至 -3.6%"
        }
      ],
      "sources": [
        {
          "title": "Yahoo Finance（黃金）",
          "url": "https://finance.yahoo.com/personal-finance/investing/article/gold-price-today-friday-october-30-2026-gold-slips-below-4000-as-mid-east-concerns-mount-111451238.html"
        },
        {
          "title": "Yahoo Finance（即時盤勢）",
          "url": "https://finance.yahoo.com/markets/live/stock-market-today-friday-october-30-dow-sp-500-nasdaq-amazon-intel-ai-sell-off-191429143.html"
        }
      ],
      "channels": [
        "hormuz-to-oil"
      ]
    },
    {
      "id": "e4",
      "rank": 4,
      "date": "2026-10-30",
      "title": "台股連兩日走跌，加權指數 10/30 收 45,211.83（-2.49%）",
      "what": "加權指數 10/29 收 46,368.33（-1.42%），10/30 開 46,139.79、盤中低 44,726.26，收 45,211.83，下跌 1,156.50 點；櫃買指數收 370.26（-4.42%）；成交量約 879 億元（單一部落格數字）。多數電子權值股遭賣超。",
      "why": "台股對 AI 與美科技股連動度高，美股大跌後修正；10/28 收盤約 47,035（由 10/29 數字回推）。",
      "discrepancy": "本週完整週漲跌幅、外資買賣超與新台幣匯率未能從可讀來源查得；本段主要依單一財經部落格，另有鉅亨網盤中速報提到 3.42% 跌幅（44,782 點），日期未能確認，未採用。",
      "taiwanImpact": {
        "summary": "台股與 AI、美科技股連動度高，美股大跌後加權指數連兩日走跌，電子權值股遭賣超。",
        "direction": -1,
        "channels": [
          "台股",
          "電子權值股"
        ]
      },
      "primary": "tw/equity",
      "places": [
        "tw/equity",
        "tw/semiconductor"
      ],
      "sentiment": -2,
      "storylines": [],
      "metrics": [
        {
          "label": "加權指數",
          "value": "45,211.83",
          "change": "-2.49%"
        },
        {
          "label": "櫃買指數",
          "value": "370.26",
          "change": "-4.42%"
        },
        {
          "label": "成交量",
          "value": "約 879 億元",
          "change": "單一來源"
        }
      ],
      "sources": [
        {
          "title": "方格子 vocus",
          "url": "https://vocus.cc/article/6ae4abbafd89780001a8550c"
        }
      ]
    },
    {
      "id": "e5",
      "rank": 5,
      "date": null,
      "title": "美國通膨與殖利率仍高，升息壓力延續",
      "what": "9 月 CPI 年增 3.7%（月增 0.6%），汽油月漲 9.1%，核心 CPI 月增 0.3%、年增 2.6%，高於預期。10 年期殖利率 10/28 約 5.05%，10/30 報價約 4.93%。Yahoo 報導 9 月 PCE 偏熱，推升 12 月升息預期，但未查得具體 PCE 數字。另：Yahoo 提到幣安發生約 63 億美元駭客事件，比特幣約 76,700 美元（-2.7%）。",
      "why": "利率高檔與升息預期壓縮高估值科技股，也影響匯率與新興市場資金。",
      "discrepancy": null,
      "taiwanImpact": null,
      "primary": "us/bonds",
      "places": [
        "us/bonds",
        "us/central-bank",
        "intl/crypto/bitcoin",
        "intl/crypto/binance"
      ],
      "sentiment": -2,
      "storylines": [
        "fed-hiking-cycle"
      ],
      "metrics": [
        {
          "label": "CPI 年增",
          "value": "3.7%",
          "change": "月增 0.6%"
        },
        {
          "label": "核心 CPI",
          "value": "年增 2.6%",
          "change": "月增 0.3%"
        },
        {
          "label": "10 年期殖利率",
          "value": "約 4.93%",
          "change": "10/28 約 5.05%"
        },
        {
          "label": "幣安駭客事件",
          "value": "約 63 億美元"
        },
        {
          "label": "比特幣",
          "value": "約 76,700 美元",
          "change": "-2.7%"
        }
      ],
      "sources": [
        {
          "title": "Kiplinger",
          "url": "https://www.kiplinger.com/investing/live/fed-meeting-updates-and-commentary-october-2026"
        },
        {
          "title": "INDmoney",
          "url": "https://www.indmoney.com/blog/us-stocks/fed-rate-decision-october-inflation-stock-market-impact"
        }
      ]
    }
  ],
  "links": [
    {
      "from": "e3",
      "to": "e5",
      "label": "能源價格推升通膨",
      "channel": "oil-to-us-inflation"
    },
    {
      "from": "e5",
      "to": "e2",
      "label": "通膨強化升息預期",
      "channel": "us-inflation-to-fed"
    },
    {
      "from": "e5",
      "to": "e1",
      "label": "高利率壓縮科技股估值",
      "channel": "us-yield-to-tech"
    },
    {
      "from": "e1",
      "to": "e4",
      "label": "美科技股大跌拖累台股",
      "channel": "us-equity-to-tw-equity"
    }
  ],
  "storylines": [],
  "watchlist": [
    {
      "date": "2026-11-02",
      "text": "Apple（新任 CEO Ternus 首次財報）、Palantir 盤後財報",
      "places": [
        "us/tech/apple",
        "us/tech/palantir"
      ],
      "confirmed": true
    },
    {
      "date": "2026-11-03",
      "text": "美國期中選舉；AMD 盤後財報",
      "places": [
        "us/government",
        "us/semiconductor/amd"
      ],
      "confirmed": true
    },
    {
      "date": "2026-11-04",
      "text": "Arm、AppLovin 等盤後財報",
      "places": [
        "uk/tech/arm",
        "us/tech"
      ],
      "confirmed": true
    },
    {
      "date": "2026-11-05",
      "text": "Qualcomm、Airbnb 等盤後財報",
      "places": [
        "us/semiconductor/qualcomm",
        "us/tech"
      ],
      "confirmed": true
    },
    {
      "date": "2026-11-06",
      "text": "美國 10 月就業報告（依慣例應為第一個週五）",
      "places": [
        "us/central-bank"
      ],
      "confirmed": false
    },
    {
      "date": "2026-11-07",
      "text": "波克夏財報（巴菲特卸任董事長後首次）",
      "places": [
        "us/finance/berkshire"
      ],
      "confirmed": true
    },
    {
      "date": null,
      "text": "持續追蹤荷莫茲海峽與中東局勢、油價、10 年期殖利率",
      "places": [
        "seas/shipping-lane/hormuz",
        "gulf/energy",
        "us/bonds"
      ],
      "confirmed": true
    },
    {
      "date": "2026-12-08",
      "text": "Fed 下次會議 12/8–9",
      "places": [
        "us/central-bank"
      ],
      "confirmed": true
    }
  ],
  "nodeStates": [
    {
      "node": "seas.hormuz-risk",
      "level": "high",
      "direction": 1,
      "basis": "一艘油輪在荷莫茲海峽被附著爆裂物攻擊",
      "evidence": [
        "e3"
      ]
    }
  ]
}
```

## 11. 傳導管道（channel、channels、proposedChannels）

網站上有一張常駐的「傳導網絡」：精選的管道（例如油價 → 美國通膨）一直都在，週資料負責標出**本週哪些管道被點亮**。管道清單由人工審閱，排程**不可以自己新增精選管道**，只能標註或提議。

### 11.1 標註規則
- **只在週報原文明寫了這條因果時才標註**，不要因為「理論上會影響」就標。
- 優先標在因果連線上：`links[]` 加 `"channel": "<管道 id>"`。
- 只有單一事件內的傳導（例如「台積電法說後股價收黑、台股週跌」）才標在事件上：`events[].channels: ["<管道 id>"]`，同一則事件不可重複。
- **`events[].channels` 只能填精選管道 id**（下表第一欄，例如 `tsmc-to-tw-equity`）。`taiwanImpact.channels` 才是「半導體」「台股」這類中文描述，兩者不要混用。
- 「碰到」的定義：事件的某個 place `p` 與管道節點路徑 `n` 滿足「`p` 在 `n` 之下」或「`n` 在 `p` 之下」（含相等）。例：`us/tech/meta` 碰到 `us/tech`，`us/central-bank` 碰到 `us`。
- 連線上的 `channel`：起點事件必須有 place 碰到管道起點，終點事件必須有 place 碰到管道終點。
- 事件上的 `channels`：事件必須有 place 碰到管道的起點或終點。
- 碰不到時**不要硬標**（驗證會失敗），也不要為了標註去改 places。

### 11.2 精選管道總表

| 管道 id | 起點 | 終點 | 方向 |
|---|---|---|---|
| `mideast-to-hormuz` | 中東地緣衝突（`gulf/government`） | 荷莫茲航運風險（`seas/shipping-lane/hormuz`） | 同向 |
| `hormuz-to-oil` | 荷莫茲航運風險（`seas/shipping-lane/hormuz`） | 油價（`gulf/energy`） | 同向 |
| `opec-to-oil` | OPEC+ 供給（`intl/organization/opec`） | 油價（`gulf/energy`） | 反向 |
| `red-sea-to-us-inflation` | 紅海航運風險（`seas/shipping-lane/red-sea`） | 美國通膨（`us`） | 同向 |
| `mideast-to-gold` | 中東地緣衝突（`gulf/government`） | 金價（`intl/commodities/gold`） | 同向 |
| `russia-to-eu-energy` | 俄羅斯能源供給（`ru/energy`） | 歐洲能源成本（`ez/energy`） | 反向 |
| `oil-to-us-inflation` | 油價（`gulf/energy`） | 美國通膨（`us`） | 同向 |
| `oil-to-eu-energy` | 油價（`gulf/energy`） | 歐洲能源成本（`ez/energy`） | 同向 |
| `eu-energy-to-ez-inflation` | 歐洲能源成本（`ez/energy`） | 歐元區通膨（`ez`） | 同向 |
| `us-inflation-to-fed` | 美國通膨（`us`） | Fed 政策利率（`us/central-bank`） | 同向 |
| `fed-to-us-yield` | Fed 政策利率（`us/central-bank`） | 美債長天期殖利率（`us/bonds`） | 同向 |
| `fed-to-dollar` | Fed 政策利率（`us/central-bank`） | 美元強弱（`us/fx`） | 同向 |
| `fiscal-to-us-yield` | 美國財政赤字（`us/government`） | 美債長天期殖利率（`us/bonds`） | 同向 |
| `ez-inflation-to-ecb` | 歐元區通膨（`ez`） | ECB 政策利率（`ez/central-bank`） | 同向 |
| `boj-to-yen` | 日銀政策利率（`jp/central-bank`） | 日圓強弱（`jp/fx`） | 同向 |
| `us-yield-to-yen` | 美債長天期殖利率（`us/bonds`） | 日圓強弱（`jp/fx`） | 反向 |
| `fed-to-tw-policy-rate` | Fed 政策利率（`us/central-bank`） | 台灣央行利率（`tw/central-bank`） | 同向 |
| `us-yield-to-tech` | 美債長天期殖利率（`us/bonds`） | 美國科技股估值（`us/tech`） | 反向 |
| `us-yield-to-gold` | 美債長天期殖利率（`us/bonds`） | 金價（`intl/commodities/gold`） | 反向 |
| `tech-to-us-equity` | 美國科技股估值（`us/tech`） | 美股大盤（`us/equity`） | 同向 |
| `us-equity-to-tw-equity` | 美股大盤（`us/equity`） | 台股（`tw/equity`） | 同向 |
| `us-equity-to-kr-equity` | 美股大盤（`us/equity`） | 韓股（`kr/equity`） | 同向 |
| `us-equity-to-risk` | 美股大盤（`us/equity`） | 全球風險偏好（`intl`） | 同向 |
| `risk-to-bitcoin` | 全球風險偏好（`intl`） | 比特幣（`intl/crypto/bitcoin`） | 同向 |
| `dollar-to-twd` | 美元強弱（`us/fx`） | 新台幣強弱（`tw/fx`） | 反向 |
| `dollar-to-gold` | 美元強弱（`us/fx`） | 金價（`intl/commodities/gold`） | 反向 |
| `us-yield-to-foreign-flow` | 美債長天期殖利率（`us/bonds`） | 外資買賣超（`tw/equity`） | 反向 |
| `foreign-flow-to-tw-equity` | 外資買賣超（`tw/equity`） | 台股（`tw/equity`） | 同向 |
| `foreign-flow-to-twd` | 外資買賣超（`tw/equity`） | 新台幣強弱（`tw/fx`） | 同向 |
| `ai-capex-to-tw-semis` | AI 資本支出（`us/tech`） | 台灣半導體景氣（`tw/semiconductor`） | 同向 |
| `ai-capex-to-kr-memory` | AI 資本支出（`us/tech`） | 韓國記憶體景氣（`kr/memory`） | 同向 |
| `tw-semis-to-tw-equity` | 台灣半導體景氣（`tw/semiconductor`） | 台股（`tw/equity`） | 同向 |
| `tsmc-to-tw-equity` | 台積電營運（`tw/semiconductor/tsmc`） | 台股（`tw/equity`） | 同向 |
| `tw-semis-to-exports` | 台灣半導體景氣（`tw/semiconductor`） | 台灣出口（`tw/trade`） | 同向 |
| `kr-memory-to-kr-equity` | 韓國記憶體景氣（`kr/memory`） | 韓股（`kr/equity`） | 同向 |
| `cn-industry-to-au` | 中國製造業（`cn/industry`） | 澳洲原物料出口（`au/commodities`） | 同向 |
| `cn-property-to-industry` | 中國房地產（`cn/real-estate`） | 中國製造業（`cn/industry`） | 同向 |
| `strait-to-tw-equity` | 台海緊張（`seas/shipping-lane/taiwan-strait`） | 台股（`tw/equity`） | 反向 |
| `tariff-to-cn-industry` | 美國關稅（`us/trade`） | 中國製造業（`cn/industry`） | 反向 |
| `tariff-to-us-inflation` | 美國關稅（`us/trade`） | 美國通膨（`us`） | 同向 |

方向「同向」：起點上升 → 終點上升；「反向」：起點上升 → 終點下降。

### 11.3 提議新管道（proposedChannels）
只在**精選清單沒有**、而且**週報原文確實寫出因果**時才提議。提議只會以灰色虛線顯示為「待審提議」，不參與任何推演；**不填強度**。

```json
"proposedChannels": [
  {
    "id": "jp-rate-to-tw-equity",
    "fromPath": "jp/central-bank",
    "toPath": "tw/equity",
    "fromVar": "日本政策利率",
    "toVar": "台股",
    "sign": -1,
    "mechanism": "日銀升息引發日圓套利交易平倉，資金撤出亞股。",
    "evidence": ["e3"]
  }
]
```

- `id`：小寫英文、數字與連字號；不可與精選管道 id 相同；同一週不可重複。之後的週再提議同一個 id 時，`fromPath`、`toPath`、`sign` 必須和第一次一致。
- `fromPath`、`toPath`：第 3 節的路徑，必須可以解析，兩者不同；若正好等於某條精選管道的兩端，請改用那條管道標註。
- `fromVar`、`toVar`：兩端的變數名稱（例：「日本政策利率」「台股」），不可為空。
- `sign`：`1` 同向、`-1` 反向。
- `mechanism`：一句話說明機制，用週報的說法，不可為空。
- `evidence`：本週的事件 id（至少一個），每個事件的 place 都要碰到 `fromPath` 或 `toPath`。
- 提議被收錄後（精選清單會用同一個 id 與兩端），舊週檔裡的提議保持原樣即可；之後的週直接用該管道標註，不要再提議。

## 12. 節點狀態（nodeStates）

網站上每個傳導節點都有一張「狀態卡」（目前水準：高／中／低，近期方向：↑ → ↓）。其中有數字的節點由系統自動更新，**排程只負責下表 18 個定性節點**，而且只在週報**明確陳述**時才填。

```json
"nodeStates": [
  { "node": "tw.foreign-flow", "level": "low", "direction": -1, "basis": "外資賣超約 815.82 億元", "evidence": ["e4"] }
]
```

- `node`：下表的節點 id。
- `level`：`"high"`、`"mid"`、`"low"`，意義見下表（高／低是節點變數本身的水準，不是好壞）。
- `direction`：`1` 上升、`0` 持平、`-1` 下降；週報沒寫方向時，依它描述的變化判斷，真的看不出就用 `0`。
- `basis`：一句話，盡量引用週報原文，不可為空。
- `evidence`：本週的事件 id（至少一個），事件的某個 place 必須碰到節點路徑（「碰到」的定義見第 11.1 節）。碰不到時**不要硬填**。
- 同一週同一節點只能一筆。
- **不要手動沿用上週的狀態**：週報沒提到的節點就不要寫，網站會自動沿用最近一次並標示「沿用 N 週前」。
- 以下節點的狀態來自數字，**不要填**（驗證會失敗）：由 FRED 每日更新的 16 個（油價、美國與歐元區通膨、Fed／ECB／日銀利率、美債殖利率、美元、美股、科技股估值、歐洲能源成本、日圓、澳洲原物料、比特幣、全球風險偏好、新台幣），以及由 `indicators` 決定的 `intl.gold`、`tw.equity`。

| 節點 id | 名稱 | 路徑 | `high` 代表 | `low` 代表 |
|---|---|---|---|---|
| `gulf.geopolitics` | 中東地緣衝突 | `gulf/government` | 衝突升高、攻擊或談判破裂 | 緩和、停火、談判進展 |
| `intl.opec-supply` | OPEC+ 供給 | `intl/organization/opec` | 增產、供給充裕 | 減產、供給緊縮 |
| `seas.hormuz-risk` | 荷莫茲航運風險 | `seas/shipping-lane/hormuz` | 船隻遇襲、封鎖威脅 | 航運恢復正常 |
| `seas.red-sea-risk` | 紅海航運風險 | `seas/shipping-lane/red-sea` | 攻擊、繞道、運費飆升 | 航運恢復正常 |
| `us.ai-capex` | AI 資本支出 | `us/tech` | 大型科技公司上調資本支出 | 削減或延後資本支出 |
| `us.tariff` | 美國關稅 | `us/trade` | 加徵、擴大關稅 | 降稅、豁免、協議 |
| `us.fiscal` | 美國財政赤字 | `us/government` | 赤字擴大、大規模支出或減稅 | 赤字縮小、撙節 |
| `ru.energy-supply` | 俄羅斯能源供給 | `ru/energy` | 出口增加、制裁放寬 | 煉油廠或管線受襲、制裁收緊 |
| `cn.industry` | 中國製造業 | `cn/industry` | PMI 擴張、生產強勁 | PMI 收縮、生產疲弱 |
| `cn.real-estate` | 中國房地產 | `cn/real-estate` | 銷售回溫、房價止跌 | 房企違約、銷售下滑 |
| `kr.memory` | 韓國記憶體景氣 | `kr/memory` | 記憶體價格上漲、出貨強 | 價格下跌、庫存升高 |
| `kr.equity` | 韓股 | `kr/equity` | 韓股大漲 | 韓股大跌 |
| `tw.semis` | 台灣半導體景氣 | `tw/semiconductor` | 訂單、產能利用率、出口強勁 | 訂單下修、景氣轉弱 |
| `tw.tsmc` | 台積電營運 | `tw/semiconductor/tsmc` | 營收、財測優於預期 | 營收、財測低於預期 |
| `tw.foreign-flow` | 外資買賣超 | `tw/equity` | 大幅買超 | 大幅賣超 |
| `tw.policy-rate` | 台灣央行利率 | `tw/central-bank` | 升息或釋出緊縮訊號 | 降息或釋出寬鬆訊號 |
| `tw.exports` | 台灣出口 | `tw/trade` | 出口年增強勁 | 出口衰退 |
| `tw.strait-risk` | 台海緊張 | `seas/shipping-lane/taiwan-strait` | 軍演、緊張升高 | 緩和 |
