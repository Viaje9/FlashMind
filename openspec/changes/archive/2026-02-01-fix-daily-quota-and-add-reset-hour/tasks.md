## 1. API 契約更新

- [x] 1.1 OpenAPI schema `Deck` 加入 `dailyResetHour`（integer, 0-23, default 4, required）
- [x] 1.2 OpenAPI schema `DeckDetail` 加入 `dailyResetHour`（required）
- [x] 1.3 OpenAPI schema `CreateDeckRequest` 加入 `dailyResetHour`（optional, default 4）
- [x] 1.4 OpenAPI schema `UpdateDeckRequest` 加入 `dailyResetHour`（optional）
- [x] 1.5 執行 `pnpm --filter ./apps/web generate:api` 重新產生 API client

## 2. 資料庫 Schema

- [x] 2.1 Prisma schema Deck model 加入 `dailyResetHour Int @default(4)`
- [x] 2.2 建立 migration `add_daily_reset_hour`
- [x] 2.3 執行 `prisma generate` 更新 Prisma client

## 3. 後端 DTO

- [x] 3.1 `create-deck.dto.ts` 加入 `@IsOptional() @IsInt() @Min(0) @Max(23) dailyResetHour`
- [x] 3.2 `update-deck.dto.ts` 加入 `@IsOptional() @IsInt() @Min(0) @Max(23) dailyResetHour`

## 4. 學習日計算工具函式

- [x] 4.1 新增 `study-day.spec.ts` 測試先行（7 個測試案例）
- [x] 4.2 新增 `study-day.ts` 實作 `getStartOfStudyDay(now, resetHour)` 純函式

## 5. StudyService 修復

- [x] 5.1 `validateDeckAccess()` select 加入 `dailyResetHour`，回傳型別擴充
- [x] 5.2 `getStudyCards()` 用 `getStartOfStudyDay()` 計算學習日起始
- [x] 5.3 `getStudyCards()` 查詢今日已學新卡數與已複習數，計算剩餘額度
- [x] 5.4 `getStudyCards()` 額度為 0 時跳過對應查詢
- [x] 5.5 `getSummary()` 改用 `getStartOfStudyDay()` 取代固定午夜
- [x] 5.6 更新 `study.service.spec.ts`：mockDeck 加入 `dailyResetHour`、新增額度扣除測試

## 6. DeckService 擴充

- [x] 6.1 `DeckDetail` interface 加入 `dailyResetHour`
- [x] 6.2 `findById()` 回傳 `dailyResetHour`
- [x] 6.3 `create()` data 加入 `dailyResetHour: dto.dailyResetHour ?? 4`
- [x] 6.4 `update()` data 加入條件更新 `dailyResetHour`
- [x] 6.5 更新 `deck.service.spec.ts`：mockDeck 加入 `dailyResetHour`、更新斷言

## 7. 前端牌組設定頁

- [x] 7.1 `deck-settings.component.ts` 新增 `dailyResetHourControl`
- [x] 7.2 `loadDeck()` 中設值 `dailyResetHour`
- [x] 7.3 `onSave()` payload 加入 `dailyResetHour`
- [x] 7.4 `deck-settings.component.html` 新增 `fm-number-input-row`（icon: schedule, min:0, max:23, step:1, unit: 時）

## 8. 測試驗證

- [x] 8.1 study-day.spec.ts — 7 個測試通過
- [x] 8.2 study.service.spec.ts — 15 個測試通過（含新增的額度扣除測試）
- [x] 8.3 deck.service.spec.ts — 14 個測試通過
- [x] 8.4 手動測試：學習 3 張卡 → 離開 → 重新進入 → 進度 1/17 正確
