# 長期資料成長 — 設計規格（時間軸視窗與索引分拆）

- 日期：2026-11-07
- 狀態：使用者已核可方向（時間軸視窗、索引分拆、JSON 壓縮，不引入外部資料庫），並指示直接實作
- 分支：`feat/scale`

## 1. 問題與目標

週報每週增加一週。目前：
- 底部時間軸每週一欄（最少 64 px）、每條主線一列；一年後約 52 欄、3,500 px 寬，舊主線永遠佔一列。
- `index.json` 在開頁時一次載入：目前 198 KB（未壓縮的縮排格式），其中 `state` 81 KB，因為每週都重複存 36 個節點的完整狀態；每週約 +10 KB。

目標：
1. 時間軸只顯示一個視窗（桌機 12 週、手機 6 週），預設包含目前這週，可往前／往後翻頁；只列視窗內出現過的主線；週次上方有年月標示。
2. 開頁載入的 `index.json` 大小不隨週數線性成長的主要部分移出：每週的衍生資料（節點狀態、管道活躍度、本週狀態轉變）改成每週一個檔案，切到那週時才載入。
3. 發佈的 JSON 一律壓縮（不縮排）。
4. 不引入外部資料庫或伺服器：git 中的 JSON 仍是唯一資料來源，建置與測試不連網。
5. 所有既有功能、網址與測試不退化；排程與說明書不需要修改。

非目標：分年歸檔、把 `indicators` 也移出（每週約 1.6 KB，壓縮後很小，暫時保留在目錄中供走勢圖使用）、伺服器端搜尋。

## 2. 索引分拆（`src/data/splitIndex.ts`，純邏輯）

`buildIndex()` 仍回傳完整的 `ArchiveIndex`（單元測試與建置都用它）。新增：

```ts
interface WeekDerived {
  weekId: string;
  state: Record<string, NodeState>;            // 該週五的節點狀態（= state.byWeek[weekId]）
  channels: Record<string, ChannelActivity>;   // 該週管道活躍度（= channels.byWeek[weekId]）
  transitions: Transition[];                   // 與前一週相比（週五對週五）的狀態轉變，最多 5 筆
}
function splitIndex(full: ArchiveIndex): { catalog: ArchiveIndex; derived: WeekDerived[] };
function hydrateWeek(catalog: ArchiveIndex, d: WeekDerived): void;   // 把 d 填回 catalog.state.byWeek / channels.byWeek / state.transitions
```

- `catalog` = 完整索引，但 `state.byWeek = {}`、`channels.byWeek = {}`、`state.transitions = {}`；其餘（weeks、storylines、entities、mentions、districts、indicators、channels.history、channels.proposals、state.latest、state.latestRef、state.series）照舊。
- `ArchiveIndex.state` 新增 `transitions: Record<weekId, Transition[]>`；第一週為空陣列。`Transition` = 既有 `stateTransitions` 的回傳元素型別（匯出為具名型別）。
- 「本週狀態轉變」改用 `state.transitions[weekId]`（週五對週五），不再用最新狀態對前一週比，所以最新一週的清單在下一週進來後也不會改變。
- 往返保證：`hydrateWeek` 填回所有 `derived` 後，`catalog` 等於原本的完整索引（測試保證）。

## 3. 建置輸出（`scripts/build-index.ts`）

- `public/data/index.json`：壓縮的 `catalog`。
- `public/data/derived/<weekId>.json`：每週一個，壓縮。
- `data/index.json`：縮排的 `catalog`（排程依說明書讀 `storylines`；給人看）。
- 週檔 `public/data/weeks/*.json` 照舊複製（原檔縮排保留，方便直接閱讀）。

## 4. 前端載入（`src/ui/app.ts`）

- `loadWeek(id)` 同時抓週檔與 `derived/<id>.json`，兩者都成功才算載入完成；`derived` 載入後呼叫 `hydrateWeek(index, d)`。快取規則同週檔（同一週只抓一次）。
- 所有讀 `index.state.byWeek[week]`、`index.channels.byWeek[week]` 的程式不需改動：渲染某週之前，那週的衍生資料一定已經填回。
- `derived` 載入失敗時：視同該週載入失敗（顯示既有的「這一週的資料載入失敗」提示），不會用半套資料渲染。
- 首次載入時多一個請求（目前這週的 `derived`）；切到別週時多一個小檔案（每週約 6–10 KB 壓縮前）。

## 5. 時間軸視窗（`src/ui/timeline.ts`）

- 純函式 `timelineWindow(weekIds: string[], current: string, start: number | null, size: number): { start: number; end: number }`：
  - `start` 為 null 時，視窗結尾對齊 `current`（current 為最後一欄；週數不足 size 時從 0 開始）。
  - `start` 有值時沿用，但會夾在 `[0, max(0, n − size)]`；若 `current` 不在視窗內，改成結尾對齊 `current`。
- `renderTimeline` 新增 `windowStart: number | null`、`windowSize: number`、`onWindow(start: number)`：
  - 只畫視窗內的週次欄位；`--weeks` 為視窗內週數。
  - 週次列上方加一列年月標籤：視窗內連續同年月的週合併成一格（`grid-column: span k`），文字「2026/11」；以 weekId（週五）所在的年月為準。
  - 左側「‹ 更早」、右側「較新 ›」按鈕（`data-action="timeline-older"`／`"timeline-newer"`），一次移動半個視窗（`size / 2`，至少 1）；到頭時停用（`disabled`）。
  - 主線列只列出在視窗內有事件的主線；目前高亮的主線即使不在視窗內也保留一列，讓使用者可以取消高亮。
- `app.ts`：保存 `timelineStart`（null = 跟隨目前週）；桌機 `windowSize = 12`、窄螢幕（≤ 767 px）`6`；翻頁設定 `timelineStart`；切週時若目前週落在視窗外，`timelineWindow` 會自動把視窗移過去。

## 6. 測試

- **單元**：`splitIndex` 的 catalog 不含 byWeek 資料、derived 每週一份；`hydrateWeek` 往返等於完整索引；transitions 週五對週五（第一週為空）；`timelineWindow` 的預設、夾範圍、目前週在視窗外時自動移動、週數少於 size；`renderTimeline` 只畫視窗內的週、年月標籤合併、翻頁按鈕停用狀態、主線過濾與高亮主線保留。
- **建置**：`build-index` 產出 `public/data/derived/<week>.json`，`public/data/index.json` 為單行壓縮 JSON 且不含 byWeek 資料（以單元測試呼叫分拆函式驗證；建置後 E2E 也會用到）。
- **E2E**：既有測試全部通過；新增：時間軸翻頁（用 20 週的合成資料不實際，改以單元測試覆蓋），網路請求驗證開頁時有載入 `derived/<最新週>.json`，切週時載入該週的 `derived`。
