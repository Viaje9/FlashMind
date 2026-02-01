## Why

學習頁面的每日新卡與複習卡額度在使用者離開後重新進入時不會扣除已學數量，導致每次進入都顯示完整額度（新卡 20、複習 100）。此外，使用者希望能自訂每天何時重置學習額度，而非固定在午夜。

## What Changes

- **Bug 修復：新卡額度未扣除** — `getStudyCards()` 改為查詢今日已學新卡數，從 `dailyNewCards` 中扣除
- **Bug 修復：複習卡額度未扣除** — 同理，查詢今日已複習數，從 `dailyReviewCards` 中扣除
- **Bug 修復：額度用完跳過查詢** — 當剩餘額度為 0 時不再發送不必要的資料庫查詢
- **新功能：每日重置時間** — 牌組新增 `dailyResetHour` 欄位（0-23，預設 4），使用者可在牌組設定頁自訂重置時間
- **學習日計算** — 新增 `getStartOfStudyDay()` 工具函式，根據 `dailyResetHour` 計算學習日起始時間，取代固定午夜計算

## Capabilities

### New Capabilities

- `daily-reset-hour`: 每日學習額度重置時間設定，包含學習日起始計算邏輯

### Modified Capabilities

- `study-session`: 修改每日額度計算邏輯，扣除今日已學數量，使用學習日起始時間取代午夜
- `deck-management`: 牌組新增 `dailyResetHour` 欄位，支援建立與更新

## Impact

- **API 契約**: OpenAPI `Deck`、`DeckDetail`、`CreateDeckRequest`、`UpdateDeckRequest` schema 新增 `dailyResetHour`
- **資料庫**: Prisma schema Deck model 新增 `dailyResetHour` 欄位 + migration
- **後端**: `StudyService`（getStudyCards、getSummary）、`DeckService`（create、update、findById）、DTO
- **前端**: 牌組設定頁新增重置時間設定欄位、API client 重新產生
- **測試**: study-day 工具函式測試、StudyService 測試、DeckService 測試
