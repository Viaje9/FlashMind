## Context

牌組列表頁（`/decks`）的卡片目前使用 `FmBadgeComponent` 顯示新卡/複習數量，右上角圓形 play 按鈕。牌組詳情頁（`/decks/:id`）已經有 `deck-stats-card` 元件，採用兩欄統計設計（藍色新卡 + 綠色複習 + daily 進度條 + 全寬按鈕），視覺上更直覺。

本次改版將列表卡片的顯示風格對齊詳情頁的統計卡片，並將導航行為拆分。

## Goals / Non-Goals

**Goals:**

- 列表卡片顯示每日學習進度（進度條 + N / M 文字）
- 卡片視覺與詳情頁 `deck-stats-card` 保持一致的設計語言
- 點擊「開始學習」按鈕直接進入學習模式（`/decks/:id/study`）
- 點擊卡片其他區域進入卡片列表（`/decks/:id`）

**Non-Goals:**

- 不修改 `deck-stats-card` 元件本身
- 不合併 `deck-card` 與 `deck-stats-card` 為同一元件
- 不新增列表頁的整體學習統計摘要

## Decisions

### 1. 複用進度計算邏輯而非共用元件

將 `newProgressPercent` / `reviewProgressPercent` 計算直接寫在 `deck-card` 元件中，而非抽取為共用 utility。兩個元件的計算邏輯相同但上下文不同（`deck-card` 是列表項、`deck-stats-card` 是詳情頁摘要），目前不值得引入額外的抽象層。

### 2. 在後端 `findAllByUserId` 計算今日進度

使用 `reviewLog.count` 查詢計算 `todayNewStudied` / `todayReviewStudied`，透過 `getStartOfStudyDay` 取得學習日起始時間。每個 deck 額外 2 個 count 查詢，但都在同一個 `Promise.all` 中並行執行，對效能影響有限。

### 3. `showAction` 永遠為 true，以 `actionDisabled` 控制狀態

按鈕始終顯示在卡片底部，無待學習項目時顯示為 disabled 狀態。這讓卡片的視覺高度一致，避免有無按鈕造成的跳動。

### 4. 使用 `FmButtonComponent` 替代 `FmIconButtonComponent`

全寬按鈕需要 `fullWidth` 支援，`FmButtonComponent` 已有此 input。移除對 `FmBadgeComponent` 和 `FmIconButtonComponent` 的依賴。

## Risks / Trade-offs

- **API 破壞性變更** → `DeckListItem` 新增 4 個 required 欄位。目前只有自家前端消費此 API，風險可控。前後端需同時部署。
- **列表查詢效能** → 每個 deck 新增 2 個 `reviewLog.count`。若 deck 數量很多可能影響回應速度 → 目前使用者的 deck 數量有限，暫不需額外優化。未來可考慮批次查詢或快取。
