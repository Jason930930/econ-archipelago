# 經濟群島 econ-archipelago

把每週的《財金週報》演成一個可互動、會隨時間演化的 3D 經濟世界。

**線上版：** https://jason930930.github.io/econ-archipelago/

![經濟群島總覽](docs/images/overview.png)

每一座島代表一個經濟體或市場，島上的地標會隨真實指標變化：

- 油價越高，中東油田的火焰越大、航道上的油輪越多。
- 殖利率越高，美債塔越高。
- 交易所的燈光顯示漲跌，預設紅漲綠跌，可切換。
- 整週的市場情緒決定全世界的天氣：晴天、多雲、陰天或暴風雨。

按下 ▶，世界會依事件之間的**因果順序**逐一演出：

1. 鏡頭飛到事件發生的地點，地標播放動畫。
2. 粒子沿因果連線流向下一個地點，例如「能源價格推升通膨」。
3. 若事件對台灣有影響，會有一道漣漪傳到台灣島。
4. 最後一幕會在各地插上「下週值得關注」的旗幟。

![播放中](docs/images/playing.png)

> 僅為資訊整理，不構成任何買賣或個人化投資建議。

## 功能

- **故事播放**：依週報中寫明的因果關係排序（拓撲排序；遇到循環時改依重要性排序），可暫停、切換上一則或下一則，也可以用 2× 播放。
- **自由探索**：可拖曳、縮放鏡頭。點擊地標會列出本週相關事件，以及相關指標近 12 週的走勢。
- **跨週時間軸**：切換週次時，世界會從上一週的狀態漸變過去。「主線」（例如 Fed 升息循環、AI 資本支出疑慮）會把不同週的事件串起來。
- **誠實呈現資料**：
  - 來源之間數字不一致時會保留「數據出入」，並以虛線框標示。
  - 某週缺少的指標會沿用上週的數值，並標示「沿用上週」，不會自行補造。
  - 「對台灣的影響」只依週報原文填寫。
- **分享連結**：`#/2026-10-30/e3` 會直接開到某一週的某一則事件。
- **文字模式**：內容與 3D 版相同。瀏覽器不支援 WebGL 時會自動切換過去。
- **手機版**：面板改為底部 sheet，並降低特效品質以節省效能。

| 手機版 |
|---|
| <img src="docs/images/mobile.png" width="280" alt="手機版"> |

## 每週自動更新

```
每週六 08:52（台北）排程「每週財金五大事」
  ├─ 搜尋新聞、撰寫週報 → 推播＋寄信
  └─ 依 docs/WEEKLY_DATA_GUIDE.md 轉成 data/weeks/<週五>.json
       └─ npm run validate
            ├─ 通過 → push main → GitHub Actions 驗證、測試、部署 Pages
            └─ 失敗 → push data/week-<日期> 分支，網站維持上一版
```

資料格式與規則：`docs/WEEKLY_DATA_GUIDE.md`、`schema/week.schema.json`。

## 架構

```
data/weeks/*.json          每週資料（唯一的資料來源）
schema/week.schema.json    JSON Schema
src/data/                  驗證、指標補值、索引產生（純邏輯）
src/world/                 實體清單、指標→視覺參數、情緒→天氣（純邏輯）
src/story/                 因果排序、播放狀態機（純邏輯）
src/render/                Three.js：程式生成的低多邊形群島、地標、特效
src/ui/                    事件卡、地標面板、時間軸、控制列、文字模式、路由
```

`render/` 只接收已計算好的視覺參數，例如 `{ oilFlame: 0.66, weather: 'storm' }`，不直接讀取原始資料。因此資料、世界狀態和播放邏輯都能在 Node 中做單元測試。

技術：TypeScript、Vite、Three.js、ajv、Vitest、Playwright。

## 本機開發

```bash
npm ci
npm run dev        # 開發伺服器（會先產生索引）
npm run validate   # 驗證 data/weeks/*.json
npm test           # 單元測試
npm run e2e        # 建置後跑瀏覽器煙霧測試
npm run build      # 驗證 → 產生索引 → 建置到 dist/
```

## 設計文件

- 規格：`docs/superpowers/specs/2026-11-02-econ-archipelago-design.md`
- 實作計畫：`docs/superpowers/plans/2026-11-02-econ-archipelago.md`
