# 週資料說明書（給「每週財金五大事」排程）

這份說明書告訴每週六的排程：怎麼把剛寫好的《財金週報》轉成經濟群島的週資料，並安全地推上 GitHub。**照做即可，不需要改任何程式碼。**

> 原則：週資料只能根據**本週週報的內容**填寫，不得自行推測或補上週報沒寫的數字與因果。

## 1. 流程

1. 在 repo 根目錄執行 `npm ci`，再執行 `npm run index`（產生 `data/index.json`）。
2. 閱讀 `data/index.json` 的 `storylines`，記下既有主線的 id 與名稱。
3. 依本說明書，新增 `data/weeks/<本週五日期 YYYY-MM-DD>.json`。**只新增這一個檔案，不改其他檔案。**
4. 執行 `npm run validate`。
   - 通過（印出 `✓ N 週資料驗證通過`）：
     `git add data/weeks/<日期>.json && git commit -m "data: week <日期>" && git push origin main`
   - 失敗：依錯誤訊息（格式為 `檔名 JSON路徑: 原因`）修正後重跑，**最多重試 2 次**。仍失敗時：
     `git checkout -b data/week-<日期> && git add data/weeks/<日期>.json && git commit -m "data: week <日期> (validation failed)" && git push origin data/week-<日期>`
     **不要推到 main。**
5. 推到 main 後，GitHub Actions 會再驗證一次並自動部署網站：https://jason930930.github.io/econ-archipelago/
6. 在 SendUserMessage 結尾加一行「世界更新：成功（網址）」或「世界更新：失敗（原因；分支 data/week-<日期>）」。

## 2. 檔案結構

```jsonc
{
  "schemaVersion": 1,
  "weekId": "2026-10-30",                       // 本週五日期，必須等於檔名
  "period": { "start": "2026-10-24", "end": "2026-10-30" },  // 上週六～本週五；end 必須等於 weekId
  "title": "財金週報（2026/10/24–2026/10/30）",   // 與信件主旨相同
  "indicators": { … },                          // 見第 4 節，只填週報裡有的
  "events": [ … ],                              // 5 則，見第 5 節
  "links": [ … ],                               // 因果連線，見第 6 節
  "storylines": [ … ],                          // 本週「新出現」的主線定義，見第 7 節
  "watchlist": [ … ]                            // 下週值得關注，見第 8 節
}
```

## 3. 實體清單（events[].entities、primaryEntity、watchlist[].entities 只能用這些 id）

| id | 名稱 | 涵蓋範圍 |
|---|---|---|
| `us-fed` | Fed 大樓 | 美國貨幣政策、美國總經數據（CPI、就業、GDP、PCE） |
| `us-wallst` | 華爾街交易所 | 美股大盤、美國期中選舉等影響大盤的事件 |
| `us-bonds` | 美債塔 | 美債殖利率 |
| `us-tech` | 科技園區 | Big Tech、AI 財報與資本支出、美國科技公司財報 |
| `tw-cbc` | 台灣央行 | 台灣貨幣政策、新台幣匯率 |
| `tw-twse` | 證交所 | 台股、外資買賣超 |
| `tw-fab` | 晶圓廠 | 台積電與台灣半導體供應鏈 |
| `kr-memory` | 記憶體廠 | Samsung、SK Hynix、HBM、記憶體價格 |
| `me-oil` | 油田 | 原油供給、OPEC、中東地緣政治 |
| `eu-ecb` | ECB | 歐洲貨幣政策與經濟 |
| `jp-boj` | 日銀 | 日本貨幣政策、日圓 |
| `cn-industry` | 工業區 | 中國經濟、貿易 |
| `gold-vault` | 金庫 | 黃金、白銀 |
| `crypto` | 加密島 | 比特幣、加密交易所 |
| `sea-hormuz` | 荷莫茲海峽 | 能源運輸、航運攻擊 |
| `sea-pacific` | 太平洋航線 | 供應鏈、貿易、跨境資金流 |
| `global` | 港口公告板 | 真的對應不到上述任何實體時才用（例如加拿大央行） |

**對應原則**
- `primaryEntity`：最直接受衝擊、故事的「主角」所在地。必須同時出現在 `entities`。
- `entities`：事件中明確提到的其他地點都放進來（例如 AI 財報牽動台灣供應鏈 → `["us-tech", "us-wallst", "tw-fab"]`）。
- 週報的旁註（例如「另：幣安駭客事件」）併入最相關的事件，把對應實體（`crypto`）加進 `entities`，數字放進 `metrics`。

## 4. 指標（indicators）

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

## 5. 事件（events，5 則）

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
| `primaryEntity` / `entities` | 見第 3 節 |
| `sentiment` | 整數 -3～+3（見下表） |
| `storylines` | 主線 id 陣列，可為空 |
| `metrics` | `[{ "label", "value", "change"? }]`，關鍵數字，皆為字串 |
| `sources` | `[{ "title", "url" }]`，至少 1 個；url 必須是 `https://` 原始網址 |

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

## 6. 因果連線（links）

`{ "from": "e3", "to": "e5", "label": "能源價格推升通膨" }`

- **只連週報有明寫的因果**（例如「能源價格推升通膨與升息預期」→ 油價事件 → 通膨事件）。
- `label` 10 字左右，用週報的說法。
- 不可自己連到自己，不可形成循環（循環時網站會退回依 rank 播放）。
- 沒有明確因果的週，`links` 可以是空陣列。

## 7. 主線（storylines）

主線把跨週的同一件事串起來。先看 `data/index.json` 的 `storylines`，**能沿用就沿用**既有 id：

- 沿用既有主線：只在事件的 `storylines` 填 id，週檔的 `storylines` 不用重複定義。
- 真的是新主線：在週檔的 `storylines` 加 `{ "id": "小寫英文-連字號", "name": "中文名稱" }`，再在事件中引用。

## 8. 下週值得關注（watchlist）

`{ "date": "2026-11-06" | null, "text": "…", "entities": ["us-fed"], "confirmed": true | false }`

- 週報寫「未確認」「依慣例」「日期可能調整」→ `confirmed: false`。
- 「持續關注」類沒有日期的項目 → `date: null`。

## 9. 完整範例（2026-10-30）

```json
{
  "schemaVersion": 1,
  "weekId": "2026-10-30",
  "period": { "start": "2026-10-24", "end": "2026-10-30" },
  "title": "財金週報（2026/10/24–2026/10/30）",
  "indicators": {
    "brent": { "value": 113.5, "range": [112, 115], "unit": "USD/bbl", "changePct": null, "note": "各來源報價時點不同（Yahoo 內文 112、另一段摘要約 115），取區間中點" },
    "wti": { "value": 103.5, "range": [103, 104], "unit": "USD/bbl", "changePct": null, "note": "約 103–104 美元，取區間中點" },
    "fedFunds": { "value": 4.0, "range": [3.75, 4.0], "unit": "%", "note": "10/28 維持 3.75%–4.00%，取上緣" },
    "us10y": { "value": 4.93, "unit": "%", "changePct": null, "note": "10/30 報價；10/28 約 5.05%" },
    "sp500": { "value": 7580.07, "changePct": -1.82, "note": "10/30 單日漲跌（Yahoo 收盤報價）；10 月約 -1.2%" },
    "nasdaq": { "value": 25437.0, "changePct": -2.86, "note": "10/30 單日漲跌（Yahoo 收盤報價）；10 月累計約 -5.2% 至 -5.3%" },
    "dow": { "value": 51770.31, "changePct": -1.09, "note": "10/30 單日漲跌（Yahoo 收盤報價）；TheStreet 為 51,785.82" },
    "taiex": { "value": 45211.83, "changePct": -2.49, "note": "10/30 單日漲跌" },
    "cpiYoY": { "value": 3.7, "unit": "%", "note": "9 月 CPI" },
    "gold": { "value": 3936, "range": [3886, 3986], "unit": "USD/oz", "changePct": null, "note": "12 月期貨，報價 3,886–3,986 美元不等，取區間中點" },
    "btc": { "value": 76700, "unit": "USD", "changePct": -2.7, "note": "Yahoo 報導" }
  },
  "events": [
    {
      "id": "e1", "rank": 1, "date": "2026-10-30",
      "title": "大型科技財報引爆 AI 支出疑慮，那斯達克單日重挫、10 月跌逾 5%",
      "what": "Alphabet、Amazon 財報被報導低於預期，Intel 因第四季財測遠弱於預期，10/30 股價收跌約 29%。10/30 美股收盤：道瓊 51,770.31（-1.09%）、S&P 500 7,580.07（-1.82%）、那斯達克 25,437.00（-2.86%）。那斯達克 10 月累計約 -5.2% 至 -5.3%，為 2025 年 3 月以來最差單月；S&P 500 10 月約 -1.2%。費半 ETF 單日約 -7.9%。",
      "why": "市場焦點從 AI 需求轉向巨額資本支出能否換來獲利，並牽動半導體與台灣供應鏈情緒。",
      "discrepancy": "Yahoo 內文與收盤報價框的道瓊跌點、S&P 跌幅略有不同；TheStreet 收盤數字為道瓊 51,785.82、S&P 7,578.97、那斯達克 25,442.31，此處採 Yahoo 收盤報價。「Intel 為 1974 年以來最差單日」僅見於單一來源，未能獨立查證。",
      "taiwanImpact": {
        "summary": "AI 資本支出疑慮牽動半導體與台灣供應鏈情緒。",
        "direction": -1,
        "channels": ["半導體", "供應鏈"]
      },
      "primaryEntity": "us-tech", "entities": ["us-tech", "us-wallst", "tw-fab"],
      "sentiment": -3, "storylines": ["ai-capex"],
      "metrics": [
        { "label": "那斯達克", "value": "25,437.00", "change": "-2.86%" },
        { "label": "S&P 500", "value": "7,580.07", "change": "-1.82%" },
        { "label": "道瓊", "value": "51,770.31", "change": "-1.09%" },
        { "label": "Intel", "value": "單日約 -29%" },
        { "label": "費半 ETF", "value": "單日約 -7.9%" },
        { "label": "那斯達克 10 月", "value": "約 -5.2% 至 -5.3%" }
      ],
      "sources": [
        { "title": "Yahoo Finance", "url": "https://finance.yahoo.com/markets/live/stock-market-today-friday-october-30-dow-sp-500-nasdaq-amazon-intel-ai-sell-off-191429143.html" },
        { "title": "TheStreet", "url": "https://www.thestreet.com/stock-market-today/stock-market-today-dow-jones-sp-500-nasdaq-updates-oct-30-2026" }
      ]
    },
    {
      "id": "e2", "rank": 2, "date": "2026-10-28",
      "title": "Fed 10/28 維持利率 3.75%–4.00%，兩位官員主張再升息",
      "what": "Fed 以 10 比 2 決議按兵不動，理事 Cook 與克里夫蘭聯銀總裁 Hammack 持異議，主張升息 25 bp。此區間是 9 月升息 25 bp（三年來首度）後的水準。聲明將經濟成長形容為「strong pace」；9 月非農僅增 2.9 萬人、失業率 4.2%。會後 Musalem、Barkin 等官員也表示利率需要上調。",
      "why": "降息預期已轉為升息預期；會前 CME FedWatch 顯示 12 月升息機率約 73%（會前數據，會後未查得更新）。下次會議為 12/8–9。",
      "discrepancy": "會前 FedWatch 同時顯示 10 月維持不變機率約 90.6%，與 12 月升息機率屬不同會議。",
      "taiwanImpact": null,
      "primaryEntity": "us-fed", "entities": ["us-fed"],
      "sentiment": -2, "storylines": ["fed-hiking-cycle"],
      "metrics": [
        { "label": "聯邦基金利率", "value": "3.75%–4.00%", "change": "維持不變" },
        { "label": "投票", "value": "10 比 2" },
        { "label": "12 月升息機率（會前）", "value": "約 73%" },
        { "label": "9 月非農", "value": "+2.9 萬人", "change": "失業率 4.2%" }
      ],
      "sources": [
        { "title": "INDmoney", "url": "https://www.indmoney.com/blog/us-stocks/fed-rate-decision-october-inflation-stock-market-impact" },
        { "title": "Kiplinger", "url": "https://www.kiplinger.com/investing/live/fed-meeting-updates-and-commentary-october-2026" },
        { "title": "CNBC", "url": "https://www.cnbc.com/2026/10/28/fed-interest-rate-decision-october-2026.html" }
      ]
    },
    {
      "id": "e3", "rank": 3, "date": "2026-10-30",
      "title": "荷莫茲海峽緊張，油價維持高檔、黃金跌破 4,000 美元",
      "what": "10/30 一艘油輪在荷莫茲海峽被附著爆裂物攻擊（據 UKMTO，攻擊者不明）。Brent 約 112–115 美元、WTI 約 103–104 美元，油價 10 月可能連續第四個月上漲。黃金 12 月期貨一度跌破 4,000 美元，報價 3,886–3,986 美元不等（-2% 至 -3.6%）。",
      "why": "能源價格推升通膨與升息預期，並壓抑風險資產；市場也在關注美國期中選舉後的中東局勢。",
      "discrepancy": "各來源油價與金價報價時點不同（Yahoo 內文 Brent 112、另一段摘要約 115；金價 3,934–3,986），未能取得一致的收盤價。「美伊緊張」主要來自標題與二手摘要，Yahoo 黃金文章內文未點名伊朗。",
      "taiwanImpact": null,
      "primaryEntity": "sea-hormuz", "entities": ["sea-hormuz", "me-oil", "gold-vault"],
      "sentiment": -2, "storylines": ["mideast-energy"],
      "metrics": [
        { "label": "Brent", "value": "約 112–115 美元" },
        { "label": "WTI", "value": "約 103–104 美元" },
        { "label": "黃金 12 月期貨", "value": "3,886–3,986 美元", "change": "-2% 至 -3.6%" }
      ],
      "sources": [
        { "title": "Yahoo Finance（黃金）", "url": "https://finance.yahoo.com/personal-finance/investing/article/gold-price-today-friday-october-30-2026-gold-slips-below-4000-as-mid-east-concerns-mount-111451238.html" },
        { "title": "Yahoo Finance（即時盤勢）", "url": "https://finance.yahoo.com/markets/live/stock-market-today-friday-october-30-dow-sp-500-nasdaq-amazon-intel-ai-sell-off-191429143.html" }
      ]
    },
    {
      "id": "e4", "rank": 4, "date": "2026-10-30",
      "title": "台股連兩日走跌，加權指數 10/30 收 45,211.83（-2.49%）",
      "what": "加權指數 10/29 收 46,368.33（-1.42%），10/30 開 46,139.79、盤中低 44,726.26，收 45,211.83，下跌 1,156.50 點；櫃買指數收 370.26（-4.42%）；成交量約 879 億元（單一部落格數字）。多數電子權值股遭賣超。",
      "why": "台股對 AI 與美科技股連動度高，美股大跌後修正；10/28 收盤約 47,035（由 10/29 數字回推）。",
      "discrepancy": "本週完整週漲跌幅、外資買賣超與新台幣匯率未能從可讀來源查得；本段主要依單一財經部落格，另有鉅亨網盤中速報提到 3.42% 跌幅（44,782 點），日期未能確認，未採用。",
      "taiwanImpact": {
        "summary": "台股與 AI、美科技股連動度高，美股大跌後加權指數連兩日走跌，電子權值股遭賣超。",
        "direction": -1,
        "channels": ["台股", "電子權值股"]
      },
      "primaryEntity": "tw-twse", "entities": ["tw-twse", "tw-fab"],
      "sentiment": -2, "storylines": [],
      "metrics": [
        { "label": "加權指數", "value": "45,211.83", "change": "-2.49%" },
        { "label": "櫃買指數", "value": "370.26", "change": "-4.42%" },
        { "label": "成交量", "value": "約 879 億元", "change": "單一來源" }
      ],
      "sources": [
        { "title": "方格子 vocus", "url": "https://vocus.cc/article/6ae4abbafd89780001a8550c" }
      ]
    },
    {
      "id": "e5", "rank": 5, "date": null,
      "title": "美國通膨與殖利率仍高，升息壓力延續",
      "what": "9 月 CPI 年增 3.7%（月增 0.6%），汽油月漲 9.1%，核心 CPI 月增 0.3%、年增 2.6%，高於預期。10 年期殖利率 10/28 約 5.05%，10/30 報價約 4.93%。Yahoo 報導 9 月 PCE 偏熱，推升 12 月升息預期，但未查得具體 PCE 數字。另：Yahoo 提到幣安發生約 63 億美元駭客事件，比特幣約 76,700 美元（-2.7%）。",
      "why": "利率高檔與升息預期壓縮高估值科技股，也影響匯率與新興市場資金。",
      "discrepancy": null,
      "taiwanImpact": null,
      "primaryEntity": "us-bonds", "entities": ["us-bonds", "us-fed", "crypto"],
      "sentiment": -2, "storylines": ["fed-hiking-cycle"],
      "metrics": [
        { "label": "CPI 年增", "value": "3.7%", "change": "月增 0.6%" },
        { "label": "核心 CPI", "value": "年增 2.6%", "change": "月增 0.3%" },
        { "label": "10 年期殖利率", "value": "約 4.93%", "change": "10/28 約 5.05%" },
        { "label": "幣安駭客事件", "value": "約 63 億美元" },
        { "label": "比特幣", "value": "約 76,700 美元", "change": "-2.7%" }
      ],
      "sources": [
        { "title": "Kiplinger", "url": "https://www.kiplinger.com/investing/live/fed-meeting-updates-and-commentary-october-2026" },
        { "title": "INDmoney", "url": "https://www.indmoney.com/blog/us-stocks/fed-rate-decision-october-inflation-stock-market-impact" }
      ]
    }
  ],
  "links": [
    { "from": "e3", "to": "e5", "label": "能源價格推升通膨" },
    { "from": "e5", "to": "e2", "label": "通膨強化升息預期" },
    { "from": "e5", "to": "e1", "label": "高利率壓縮科技股估值" },
    { "from": "e1", "to": "e4", "label": "美科技股大跌拖累台股" }
  ],
  "storylines": [],
  "watchlist": [
    { "date": "2026-11-02", "text": "Apple（新任 CEO Ternus 首次財報）、Palantir 盤後財報", "entities": ["us-tech"], "confirmed": true },
    { "date": "2026-11-03", "text": "美國期中選舉；AMD 盤後財報", "entities": ["us-wallst", "us-tech"], "confirmed": true },
    { "date": "2026-11-04", "text": "Arm、AppLovin 等盤後財報", "entities": ["us-tech"], "confirmed": true },
    { "date": "2026-11-05", "text": "Qualcomm、Airbnb 等盤後財報", "entities": ["us-tech"], "confirmed": true },
    { "date": "2026-11-06", "text": "美國 10 月就業報告（依慣例應為第一個週五）", "entities": ["us-fed"], "confirmed": false },
    { "date": "2026-11-07", "text": "波克夏財報（巴菲特卸任董事長後首次）", "entities": ["us-wallst"], "confirmed": true },
    { "date": null, "text": "持續追蹤荷莫茲海峽與中東局勢、油價、10 年期殖利率", "entities": ["sea-hormuz", "me-oil", "us-bonds"], "confirmed": true },
    { "date": "2026-12-08", "text": "Fed 下次會議 12/8–9", "entities": ["us-fed"], "confirmed": true }
  ]
}
```
