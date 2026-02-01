## 1. 資料庫 Schema 與 Migration

- [x] 1.1 在 Prisma schema 的 Deck model 新增 `overrideDate DateTime?`、`overrideNewCards Int?`、`overrideReviewCards Int?` 欄位
- [x] 1.2 執行 migration 生成與套用

## 2. 後端核心邏輯

- [x] 2.1 建立 `getEffectiveDailyLimits()` 工具函式，封裝覆寫判斷邏輯（含 `max(override, default)` 安全取大）
- [x] 2.2 為 `getEffectiveDailyLimits()` 撰寫單元測試（覆蓋：覆寫有效、覆寫過期、部分覆寫、覆寫低於預設值取大）
- [x] 2.3 修改 `StudyService.getStudyCards()` 使用 `getEffectiveDailyLimits()` 計算剩餘額度
- [x] 2.4 修改 `StudyService.getSummary()` 回傳有效上限值
- [x] 2.5 修改 `DeckService.findAllByUserId()` 和 `findById()` 回傳有效上限值
- [x] 2.6 更新既有的 study service 測試，驗證覆寫情境下的卡片選取邏輯

## 3. API 端點

- [x] 3.1 在 OpenAPI 契約新增 `PUT /decks/{deckId}/daily-override` 端點定義與 request/response schema
- [x] 3.2 重新生成 API client
- [x] 3.3 在 DeckController 新增 `setDailyOverride()` 方法
- [x] 3.4 在 DeckService 新增 `setDailyOverride()` 方法，含驗證邏輯（覆寫值 >= 預設值，403 權限檢查）
- [x] 3.5 為 `setDailyOverride()` 撰寫單元測試（覆蓋：成功設定、低於預設值拒絕、未授權存取、重複設定取代）

## 4. 前端：牌組詳情頁 UI

- [x] 4.1 在牌組詳情頁的進度區域新增「調整今日上限」按鈕
- [x] 4.2 實作覆寫設定的 UI（dialog 或 inline 編輯），包含新卡與複習卡上限輸入
- [x] 4.3 呼叫覆寫 API 並更新畫面上的進度顯示（分母改為有效上限）
- [x] 4.4 覆寫已啟用時顯示視覺提示
