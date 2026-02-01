## Why

目前牌組詳情頁的統計卡片（deck-stats-card）只顯示「新卡片」與「待複習」的總數量，但無法反映今日已學習的進度。使用者無從得知今天實際還剩多少張卡片需要練習，也不知道自己已經練了幾張。這讓使用者在安排學習時間時缺乏直覺的參考依據。

## What Changes

- 後端 `GET /decks/{deckId}/study/summary` API 新增 `dailyNewCards`、`dailyReviewCards`、`todayNewStudied`、`todayReviewStudied` 欄位，回傳每日限額與今日已學數量
- 前端牌組詳情頁的 `deck-stats-card` 元件新增今日練習進度顯示，包含：
  - 新卡進度：`已學 N / 上限 M`
  - 複習進度：`已學 N / 上限 M`
- 進度顯示在「開始學習」按鈕上方，讓使用者一眼看到今日進度

## Capabilities

### New Capabilities

- `daily-progress`: 今日學習進度顯示功能，涵蓋後端 API 擴充與前端 UI 呈現

### Modified Capabilities

- `study-session`: 需擴充 StudySummary 的回傳欄位以包含每日限額與今日已學數量

## Impact

- 後端：`apps/api/src/modules/study/study.service.ts` 的 `getSummary` 方法需擴充回傳資料
- OpenAPI：`openapi/` 下的 StudySummary schema 需新增欄位
- API Client：`packages/api-client/` 需重新生成
- 前端：`apps/web/src/app/pages/deck-detail/components/deck-stats-card/` 需擴充 UI
- 前端：`apps/web/src/app/pages/deck-detail/deck-detail.component.ts` 需呼叫 summary API
