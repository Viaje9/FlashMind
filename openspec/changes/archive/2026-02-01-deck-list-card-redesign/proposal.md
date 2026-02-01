## Why

牌組列表卡片目前使用 badge 文字顯示新卡/複習數量，資訊密度低且缺乏每日學習進度的直覺回饋。改版為兩欄統計樣式（與牌組詳情頁的 deck-stats-card 一致），讓使用者在列表頁即可掌握每日學習進度，同時將「開始學習」按鈕的導航目標改為直接進入學習模式，減少點擊次數。

## What Changes

- 擴充 `DeckListItem` API 回應，新增 `dailyNewCards`、`dailyReviewCards`、`todayNewStudied`、`todayReviewStudied` 四個欄位
- 後端 `findAllByUserId` 新增 `reviewLog.count` 查詢，計算今日已學新卡數與已複習數
- 前端 `deck-card` 元件從 badge 樣式改為兩欄統計設計（藍色新卡片 + 綠色待複習 + daily 進度條）
- 卡片底部改為全寬「開始學習」按鈕，取代右上角圓形 play 按鈕
- 點擊行為拆分：點擊卡片 → `/decks/:id`（卡片列表），點擊按鈕 → `/decks/:id/study`（直接學習）
- `showAction` 永遠為 `true`，改用 `actionDisabled` 控制按鈕狀態

## Capabilities

### New Capabilities

（無新增獨立 capability）

### Modified Capabilities

- `deck-management`: 牌組列表卡片的顯示方式與導航行為變更（兩欄統計 + 拆分導航）
- `daily-progress`: 每日學習進度擴展至牌組列表頁的卡片中顯示，不再僅限於牌組詳情頁

## Impact

- **API 契約**: `openapi/api.yaml` — `DeckListItem` schema 新增 4 個 required 欄位（**BREAKING** 對既有客戶端）
- **後端**: `apps/api/src/modules/deck/deck.service.ts` — `findAllByUserId` 新增 reviewLog 查詢
- **前端元件**: `apps/web/src/app/components/deck/deck-card/` — 完全重寫模板與元件邏輯
- **前端頁面**: `apps/web/src/app/pages/deck-list/` — 新增 input 綁定與導航拆分
- **API Client**: `packages/api-client/` — 自動重新生成
- **Storybook**: deck-card stories 全部更新
