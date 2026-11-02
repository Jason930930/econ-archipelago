# 常駐傳導網絡 — 設計規格（總體金融數位孿生・子專案 2）

- 日期：2026-11-02
- 狀態：使用者已核可設計，並指示直接實作
- 前置：世界骨架 v2（`docs/superpowers/specs/2026-11-02-world-skeleton-v2-design.md`）
- 分支：`feat/transmission-network`

## 1. 目標與成功標準

在世界中常駐一張**經濟傳導管道圖**。每週事件會點亮實際被觸發的管道，跨週還能看出哪些管道持續活躍。這張圖也是子專案 4（情境推演）的計算基礎。

成功標準：
1. 精選的核心管道（36 個節點、40 條管道，其中 11 條和台灣有關）以海底管線的形式常駐在世界中。
2. 每週的事件連線和事件本身可以標註管道。被標註的管道會發亮並有流動的光點，粗細依熱度（半衰期 1 週）決定。
3. 點擊管線會開出管道面板：機制說明、方向、強度、時間落差、本週點亮它的事件、歷史上點亮的週次。
4. 網絡模式開關：開啟時整張網絡提亮、建築變淡。
5. 排程可以提議新管道：畫面上以虛線顯示，不參與推演，等使用者審閱後再升格成精選管道。
6. 三期舊週報中，週報原文明寫因果的連線會補上管道標註。
7. v1 和 v2 的所有功能與測試都不退化。

非目標：情境推演（子專案 4）、外部資料源（子專案 3）、在網頁上直接升格提議、量化的傳導係數。

## 2. 資料模型

### 2.1 節點 = 位置 + 狀態變數（`src/world/channels.ts`，精選、需要審查）

```ts
interface ChannelNode {
  id: string;               // 例：'us.inflation'
  path: string;             // 世界路徑，可以是任何深度
  name: string;             // 中文名稱
  indicator?: IndicatorKey; // 綁定既有指標（供子專案 3、4 使用）
  indicatorSign?: 1 | -1;   // 指標方向與變數方向相反時填 -1（例：新台幣強弱 vs usdtwd）
}
```

| id | 路徑 | 名稱 | 指標 |
|---|---|---|---|
| `gulf.oil-price` | `gulf/energy` | 油價 | brent |
| `gulf.geopolitics` | `gulf/government` | 中東地緣衝突 | |
| `intl.opec-supply` | `intl/organization/opec` | OPEC+ 供給 | |
| `seas.hormuz-risk` | `seas/shipping-lane/hormuz` | 荷莫茲航運風險 | |
| `seas.red-sea-risk` | `seas/shipping-lane/red-sea` | 紅海航運風險 | |
| `us.inflation` | `us` | 美國通膨 | cpiYoY |
| `us.policy-rate` | `us/central-bank` | Fed 政策利率 | fedFunds |
| `us.long-yield` | `us/bonds` | 美債長天期殖利率 | us10y |
| `us.dollar` | `us/fx` | 美元強弱 | |
| `us.equity` | `us/equity` | 美股大盤 | sp500 |
| `us.tech-valuation` | `us/tech` | 美國科技股估值 | nasdaq |
| `us.ai-capex` | `us/tech` | AI 資本支出 | |
| `us.tariff` | `us/trade` | 美國關稅 | |
| `us.fiscal` | `us/government` | 美國財政赤字 | |
| `ez.inflation` | `ez` | 歐元區通膨 | |
| `ez.policy-rate` | `ez/central-bank` | ECB 政策利率 | |
| `ez.energy-cost` | `ez/energy` | 歐洲能源成本 | |
| `ru.energy-supply` | `ru/energy` | 俄羅斯能源供給 | |
| `jp.policy-rate` | `jp/central-bank` | 日銀政策利率 | |
| `jp.yen` | `jp/fx` | 日圓強弱 | |
| `cn.industry` | `cn/industry` | 中國製造業 | |
| `cn.real-estate` | `cn/real-estate` | 中國房地產 | |
| `kr.memory` | `kr/memory` | 韓國記憶體景氣 | |
| `kr.equity` | `kr/equity` | 韓股 | |
| `au.commodities` | `au/commodities` | 澳洲原物料出口 | |
| `intl.gold` | `intl/commodities/gold` | 金價 | gold |
| `intl.bitcoin` | `intl/crypto/bitcoin` | 比特幣 | btc |
| `intl.risk-appetite` | `intl` | 全球風險偏好 | |
| `tw.semis` | `tw/semiconductor` | 台灣半導體景氣 | |
| `tw.tsmc` | `tw/semiconductor/tsmc` | 台積電營運 | |
| `tw.equity` | `tw/equity` | 台股 | taiex |
| `tw.foreign-flow` | `tw/equity` | 外資買賣超 | |
| `tw.twd` | `tw/fx` | 新台幣強弱 | usdtwd（`indicatorSign: -1`） |
| `tw.policy-rate` | `tw/central-bank` | 台灣央行利率 | |
| `tw.exports` | `tw/trade` | 台灣出口 | |
| `tw.strait-risk` | `seas/shipping-lane/taiwan-strait` | 台海緊張 | |

### 2.2 管道

```ts
interface Channel {
  id: string;                         // 例：'oil-to-us-inflation'
  from: string; to: string;           // 節點 id
  sign: 1 | -1;                       // 同向或反向
  strength: 1 | 2 | 3;                // 教科書層級的相對重要性
  lag: 'days' | 'weeks' | 'months';
  family: ChannelFamily;
  mechanism: string;                  // 1–2 句中文機制說明
}
type ChannelFamily = 'energy-inflation' | 'monetary' | 'markets' | 'flows-fx' | 'supply-chain' | 'geopolitics' | 'policy-trade';
```

類別顏色與名稱：能源與通膨（橙）、貨幣政策（藍）、金融市場（綠）、資金流與匯率（青）、供應鏈與產業（紫）、地緣與航運（紅）、政策與貿易（黃）。

精選管道（40 條，★ 為台灣相關，共 11 條）：


| id | 起點 → 終點 | 方向 | 強度 | 落差 | 類別 | 機制 |
|---|---|---|---|---|---|---|
| `mideast-to-hormuz` | 中東地緣衝突 → 荷莫茲航運風險 | + | 3 | days | geopolitics | 衝突升溫使油輪遇襲與保險成本上升，海峽通行風險升高。 |
| `hormuz-to-oil` | 荷莫茲航運風險 → 油價 | + | 3 | days | energy-inflation | 全球約五分之一原油經荷莫茲海峽，運輸中斷風險直接推升油價。 |
| `opec-to-oil` | OPEC+ 供給 → 油價 | − | 3 | weeks | energy-inflation | 減產使市場供給縮減，油價上升；增產則壓低油價。 |
| `red-sea-to-us-inflation` | 紅海航運風險 → 美國通膨 | + | 1 | months | geopolitics | 繞道好望角拉長航程、推高運費與進口成本。 |
| `mideast-to-gold` | 中東地緣衝突 → 金價 | + | 2 | days | geopolitics | 避險需求升溫，資金流向黃金。 |
| `russia-to-eu-energy` | 俄羅斯能源供給 → 歐洲能源成本 | − | 3 | weeks | geopolitics | 俄國天然氣與原油供給減少，歐洲能源價格上升。 |
| `oil-to-us-inflation` | 油價 → 美國通膨 | + | 3 | weeks | energy-inflation | 汽油與運輸成本直接計入 CPI，並透過生產成本間接推升核心物價。 |
| `oil-to-eu-energy` | 油價 → 歐洲能源成本 | + | 2 | weeks | energy-inflation | 歐洲高度依賴進口能源，油價上升直接墊高能源成本。 |
| `eu-energy-to-ez-inflation` | 歐洲能源成本 → 歐元區通膨 | + | 3 | weeks | energy-inflation | 能源在歐元區 HICP 權重高，成本上升直接反映在物價。 |
| `us-inflation-to-fed` | 美國通膨 → Fed 政策利率 | + | 3 | months | monetary | 通膨高於目標時，Fed 傾向升息或延後降息。 |
| `fed-to-us-yield` | Fed 政策利率 → 美債長天期殖利率 | + | 3 | days | monetary | 政策利率預期上升，帶動整條殖利率曲線走高。 |
| `fed-to-dollar` | Fed 政策利率 → 美元強弱 | + | 2 | days | monetary | 美國利率相對走高，吸引資金流入美元資產。 |
| `fiscal-to-us-yield` | 美國財政赤字 → 美債長天期殖利率 | + | 2 | weeks | policy-trade | 赤字擴大增加公債供給，投資人要求更高的期限溢酬。 |
| `ez-inflation-to-ecb` | 歐元區通膨 → ECB 政策利率 | + | 3 | months | monetary | 通膨高於目標時，ECB 傾向維持緊縮。 |
| `boj-to-yen` | 日銀政策利率 → 日圓強弱 | + | 2 | days | monetary | 日銀升息縮小與海外的利差，日圓走強。 |
| `us-yield-to-yen` | 美債長天期殖利率 → 日圓強弱 | − | 2 | days | flows-fx | 美日利差擴大鼓勵套利交易，日圓走弱。 |
| `fed-to-tw-policy-rate` ★ | Fed 政策利率 → 台灣央行利率 | + | 1 | months | monetary | 台灣央行需兼顧台美利差與資金外流壓力，常跟隨 Fed 方向。 |
| `us-yield-to-tech` | 美債長天期殖利率 → 美國科技股估值 | − | 3 | days | markets | 折現率上升，壓縮高成長股的未來現金流現值。 |
| `us-yield-to-gold` | 美債長天期殖利率 → 金價 | − | 2 | days | markets | 實質利率上升提高持有黃金的機會成本。 |
| `tech-to-us-equity` | 美國科技股估值 → 美股大盤 | + | 3 | days | markets | 科技股在 S&P 500 權重高，帶動大盤。 |
| `us-equity-to-tw-equity` ★ | 美股大盤 → 台股 | + | 3 | days | markets | 台股與美股（尤其科技股）連動度高，美股大跌常隔日反映。 |
| `us-equity-to-kr-equity` | 美股大盤 → 韓股 | + | 2 | days | markets | 全球風險情緒與科技股連動帶動韓股。 |
| `us-equity-to-risk` | 美股大盤 → 全球風險偏好 | + | 2 | days | markets | 美股下跌常引發全球去槓桿與風險趨避。 |
| `risk-to-bitcoin` | 全球風險偏好 → 比特幣 | + | 2 | days | markets | 加密資產屬高風險資產，隨風險偏好起伏。 |
| `dollar-to-twd` ★ | 美元強弱 → 新台幣強弱 | − | 3 | days | flows-fx | 美元走強時，新台幣通常走弱。 |
| `dollar-to-gold` | 美元強弱 → 金價 | − | 2 | days | flows-fx | 金價以美元計價，美元走強壓抑金價。 |
| `us-yield-to-foreign-flow` ★ | 美債長天期殖利率 → 外資買賣超 | − | 2 | weeks | flows-fx | 美國利率走高吸引資金回流美國，外資賣超新興市場。 |
| `foreign-flow-to-tw-equity` ★ | 外資買賣超 → 台股 | + | 3 | days | flows-fx | 外資是台股主要成交力量，大額賣超直接壓抑指數。 |
| `foreign-flow-to-twd` ★ | 外資買賣超 → 新台幣強弱 | + | 3 | days | flows-fx | 外資匯出需賣新台幣換美元，造成新台幣貶值。 |
| `ai-capex-to-tw-semis` ★ | AI 資本支出 → 台灣半導體景氣 | + | 3 | months | supply-chain | 雲端業者的 AI 資本支出決定先進製程與封裝的訂單。 |
| `ai-capex-to-kr-memory` | AI 資本支出 → 韓國記憶體景氣 | + | 3 | months | supply-chain | AI 伺服器帶動 HBM 與高階 DRAM 需求。 |
| `tw-semis-to-tw-equity` ★ | 台灣半導體景氣 → 台股 | + | 3 | weeks | supply-chain | 半導體佔台股權重過半，景氣變化直接反映在指數。 |
| `tsmc-to-tw-equity` ★ | 台積電營運 → 台股 | + | 3 | days | supply-chain | 台積電單一個股約佔加權指數三成權重。 |
| `tw-semis-to-exports` ★ | 台灣半導體景氣 → 台灣出口 | + | 3 | months | supply-chain | 電子零組件與資通訊產品佔台灣出口大宗。 |
| `kr-memory-to-kr-equity` | 韓國記憶體景氣 → 韓股 | + | 2 | weeks | supply-chain | Samsung、SK Hynix 在韓股權重高。 |
| `cn-industry-to-au` | 中國製造業 → 澳洲原物料出口 | + | 2 | months | supply-chain | 中國是澳洲鐵礦砂與煤炭的最大買家。 |
| `cn-property-to-industry` | 中國房地產 → 中國製造業 | + | 2 | months | supply-chain | 房地產牽動鋼鐵、建材與家電等上游製造需求。 |
| `strait-to-tw-equity` ★ | 台海緊張 → 台股 | − | 3 | days | geopolitics | 地緣風險升溫，外資降低台灣資產曝險。 |
| `tariff-to-cn-industry` | 美國關稅 → 中國製造業 | − | 2 | months | policy-trade | 關稅提高壓抑對美出口訂單。 |
| `tariff-to-us-inflation` | 美國關稅 → 美國通膨 | + | 2 | months | policy-trade | 進口成本部分轉嫁給消費者。 |

實作中的 `CHANNELS` 必須和此表一致，數量（40 條）由測試鎖定。

### 2.3 完整性規則（單元測試）
- 節點 id 唯一；路徑用種子實體檢查時可以解析。
- 管道 id 唯一；兩端節點都存在；`from ≠ to`；同一組 `(from, to)` 不重複。
- 每個節點至少連著一條管道，沒有孤立節點。
- 台灣相關管道（任一端的路徑以 `tw` 開頭，或是 `tw.strait-risk`）至少 10 條。
- 管道節點的路徑一律納入區塊集合（`buildIndex` 的 `districts`），所以端點區塊一定會畫出來，例如 `us/fx`、`tw/trade`。

## 3. 週資料（schema v2 擴充，全部選填，向下相容）

```jsonc
"links": [{ "from": "e3", "to": "e5", "label": "能源價格推升通膨", "channel": "oil-to-us-inflation" }],
"events": [{ …, "channels": ["ai-capex-to-tw-semis"] }],
"proposedChannels": [{
  "id": "us-tariff-to-mx-industry",
  "fromPath": "us/trade", "fromVar": "美國關稅",
  "toPath": "mx/industry", "toVar": "墨西哥製造業",
  "sign": -1,
  "mechanism": "週報指出關稅升級壓抑墨西哥對美出口與製造業訂單。",
  "evidence": ["e3"]
}]
```

### 3.1 驗證規則（`npm run validate`）
「`p` 碰到節點 `n`」的定義：`isWithin(p, n.path) || isWithin(n.path, p)`。

1. `links[].channel` 必須是精選管道 id。連線的 from 事件中，必須有某個 place 碰到管道起點節點；to 事件中，必須有某個 place 碰到終點節點。
2. `events[].channels` 每一項都必須是精選管道 id，而且事件的某個 place 要碰到該管道的起點或終點；同一則事件內不可重複。
3. `proposedChannels`：
   - `id` 格式與實體 id 相同，不可等於精選管道 id；
   - `fromPath`、`toPath` 必須可以解析，而且兩者不同；
   - `fromVar`、`toVar`、`mechanism` 不可為空；`sign` 為 1 或 -1；
   - `evidence` 至少一個，每個都是本週的事件 id，且該事件的某個 place 碰到 `fromPath` 或 `toPath`；
   - 已有精選管道的兩端節點路徑**正好**等於 `(fromPath, toPath)` 時拒絕，錯誤訊息要列出應改用的管道 id；
   - 同一 `id` 在較早週出現過時，`fromPath`、`toPath`、`sign` 必須一致；
   - 同一週內 `id` 不可重複。

## 4. 活躍度（建置索引時計算，`src/world/activation.ts`）

- **本週強度** `intensity(c, w)`：本週引用管道 c 的不同事件數，上限 3。`links[].channel` 計入 from 與 to 兩則事件，`events[].channels` 計入該則事件。
- **熱度** `heat(c, w) = intensity(c, w) + 0.5 · heat(c, w−1)`，第一週的上一週熱度為 0。週次依 weekId 排序，週與週之間缺漏的不另外補。
- **連續週數** `streak(c, w)`：截至 w 連續 `intensity > 0` 的週數。`streak ≥ 2` 視為「持續活躍」。
- **歷史**：每條管道列出被點亮的 `{ weekId, eventIds }`。
- **提議彙總**：每個提議 id 列出 `{ fromPath, toPath, fromVar, toVar, sign, mechanism（取最近一次）, weeks: [{ weekId, evidence }] }`；提議 id 若已是精選管道，就標記 `promoted: true`。
- 以上結果寫進 `ArchiveIndex.channels`：`{ byWeek: Record<weekId, Record<channelId, { intensity, heat, streak }>>, history, proposals }`。

## 5. 畫面與互動

### 5.1 管線層（`src/render/layers/channels.ts`）
- 端點：用 `WorldGraph.nearest(node.path)` 的落點（anchor）投影到水平面。
- 路線：兩端屬於**不同地區**時，走海面上的二次貝茲曲線（y = 0.15），弧度依距離決定；同一對地區之間的多條管道，依序往側邊錯開 1.2 單位。兩端在**同一地區**時，改成島上方 y ≈ 2.5 的拱形短弧。
- 外觀：
  - 每條管道是一根管線（TubeGeometry，半徑隨熱度變化），材質不參與拾取以外的光影。
  - 暗管：透明度 0.12、類別色降低飽和度。
  - 亮管：本週 `intensity > 0` 或 `heat ≥ 0.5` 時，不透明度 0.35 + 0.5·min(1, heat/3)，半徑 0.08 + 0.06·min(heat, 3)，管內有沿 from → to 流動的光點；`streak ≥ 2` 時光點速度加倍。
  - 反向管道：曲線中點放一個「−」小標記（白底圓盤）。
  - 提議管道：灰色虛線（Line + LineDashedMaterial），沒有光點。
- 網絡模式：所有管道以亮管樣式呈現，並顯示名稱標籤；建築與島嶼的材質透明度降到 0.35。關閉後恢復。
- 拾取：管線的 `userData.channel` 是管道 id；`WorldView.onPick` 的回傳型別擴充為 `{ kind: 'node'; path } | { kind: 'channel'; id }`。
- 播放：連線有 `channel` 時，`effects.flow` 改沿該管道的曲線移動（新函式 `flowAlong(channelId, label)`），並讓該管道短暫加亮；沒有 `channel` 時維持原本的弧線。

### 5.2 UI
- 頂欄新增「傳導網絡」切換按鈕（`aria-pressed`），偏好存在 localStorage key `econ-archipelago:network`，讀寫都包 try/catch。
- **管道面板**（`src/ui/channelPanel.ts`）：
  - 標題：起點名稱 → 終點名稱，兩者都是按鈕，點擊會選取節點；
  - 方向（同向／反向）、強度（●●○）、時間落差（數日／數週／數月）、類別；
  - 機制說明；
  - 本週點亮它的事件（按鈕）；
  - 熱度與「持續活躍 N 週」；
  - 歷史週次（按鈕，點擊跳到該週）；
  - 固定說明：「方向與強度為教科書層級的定性判斷，不是量化模型或預測。」
- **提議面板**：起點 → 終點（路徑名稱）、方向、機制、被提議的週次與依據事件，並標註「待審提議：不參與推演」。
- **節點面板**新增「傳導管道」區塊：列出節點路徑碰到本節點路徑的管道（`isWithin(node.path, path)`），本週有亮的排在前面，點擊開管道面板。
- **本週故事面板**新增「本週點亮的管道」區塊，依熱度由高到低排列。
- **網絡模式圖例**：7 種類別色塊與「待審提議 N 項」按鈕，點擊列出所有提議。
- **文字模式**：在因果連線之後新增「本週點亮的管道」，列出名稱與機制說明。
- 所有文字一律以 textContent 寫入（提議來自排程，可能含任意文字）。

## 6. 舊資料回填（依週報原文）
| 週 | 標註 | 依據 |
|---|---|---|
| 10/16 | e1→e2 `oil-to-us-inflation` | 「能源價格推升通膨」 |
| 10/16 | e4→e5 `foreign-flow-to-twd` | 「外資賣超牽動新台幣」 |
| 10/16 | e4 `tsmc-to-tw-equity` | 法說後股價收黑、台股週跌 |
| 10/23 | e2→e3 `oil-to-us-inflation` | 「油價推升通膨、影響央行判斷」 |
| 10/23 | e3→e1 `us-yield-to-tech` | 「融資成本壓抑科技股估值」 |
| 10/23 | e4 `foreign-flow-to-tw-equity` | 外資賣超約 815.82 億元、台股重挫 |
| 10/30 | e3→e5 `oil-to-us-inflation` | 「能源價格推升通膨」 |
| 10/30 | e5→e2 `us-inflation-to-fed` | 「通膨強化升息預期」 |
| 10/30 | e5→e1 `us-yield-to-tech` | 「高利率壓縮科技股估值」 |
| 10/30 | e1→e4 `us-equity-to-tw-equity` | 「美科技股大跌拖累台股」 |
| 10/30 | e1 `ai-capex-to-tw-semis` | 「牽動半導體與台灣供應鏈情緒」 |
| 10/30 | e3 `hormuz-to-oil` | 油輪在荷莫茲海峽遇襲、油價維持高檔 |

10/16 的 e2→e3「借貸成本上升放大 AI 債務疑慮」不標註：起點事件只有 `us/central-bank`，碰不到殖利率節點，硬標會違反第 3.1 節的規則。

## 7. 排程說明書
- 新增「傳導管道」一節：
  - 用途；
  - 標註規則：原文明寫因果才標；優先用 `links[].channel`；單一事件才用 `events[].channels`；
  - 「碰到」的定義；
  - 精選管道總表（id、起點 → 終點、方向）；
  - 提議規則（只在精選清單沒有、原文確實寫出因果時才提議，不填強度）與範例。
- 測試確保說明書收錄了每一個精選管道 id，並包含 `proposedChannels`、`fromVar`、`evidence` 等關鍵字。
- 合成週：在 rank 1 事件的 `channels` 加入一條它碰得到的精選管道（找不到就略過），並加入一個提議（id `synthetic-proposal`，起點與終點取 rank 1 事件的前兩個 place；若兩者相同，或恰好等於某條精選管道的兩端，就略過）。

## 8. 測試
- **單元測試**：
  - 精選清單的完整性（第 2.3 節）；
  - 驗證器：每條規則至少一個通過案例、一個失敗案例；
  - 活躍度：強度上限、熱度遞迴（例：1、0、2 → 1、0.5、2.25）、連續週數、歷史、提議彙總與 promoted；
  - 管線路線的純函式：是否同一地區、側向錯開量；
  - UI（jsdom）：管道面板、提議面板、節點面板的傳導區塊、文字模式的管道列表，以及 XSS（提議的 mechanism 含 HTML 時必須以文字顯示）。
- **E2E**：
  - 網絡模式開關（按鈕狀態、圖例出現）；
  - 點擊一條亮管開出管道面板（用 `screenOf` 的對應函式 `channelScreenPoint(id)` 取得螢幕座標）；
  - 本週故事面板列出點亮的管道；
  - 文字模式列出管道；
  - 播放 10/30 時不報錯；
  - 合成週帶有提議時，提議出現在待審清單中（只在演練時執行）。

## 9. 留給後續子專案的介面
- `CHANNEL_NODES`、`CHANNELS`、節點的指標綁定（含 `indicatorSign`）：子專案 4 用來沿圖做符號傳播。
- `ArchiveIndex.channels.byWeek` 的熱度：子專案 4 可以用來標示「本週已經在傳導的路徑」。
