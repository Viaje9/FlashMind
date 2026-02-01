## Context

學習頁面的每日新卡（`dailyNewCards`）與複習卡（`dailyReviewCards`）額度在使用者離開後重新進入時不會扣除已學數量。`getSummary()` 使用固定午夜作為學習日起始，無法自訂。此次同時修復額度 bug 並新增可設定的每日重置時間。

## Goals / Non-Goals

**Goals:**
- 修復新卡與複習卡額度不扣除已學數量的 bug
- 新增 `dailyResetHour` 欄位讓使用者自訂學習日重置時間
- 抽取學習日計算邏輯為純函式，便於測試與復用

**Non-Goals:**
- 不支援時區設定（使用伺服器本地時間）
- 不支援分鐘級精度的重置時間
- 不改變學習卡片的排序邏輯

## Decisions

1. **學習日計算為純函式** — `getStartOfStudyDay(now, resetHour)` 獨立於 service，方便單元測試。邏輯：若當前時間 < 今天的 resetHour，則學習日起始為昨天的 resetHour。

2. **透過 ReviewLog 計算已學數** — 查詢 `reviewLog.count` 搭配 `prevState` 區分新卡（`prevState = NEW`）與複習卡（`prevState ≠ NEW`），配合 `reviewedAt >= startOfStudyDay` 篩選今日範圍。

3. **額度用完時跳過查詢** — 當 `remainingNewSlots` 或 `remainingReviewSlots` 為 0 時直接回傳空陣列，避免不必要的資料庫查詢。

4. **Contract-First 流程** — 先更新 OpenAPI schema，再產生 API client，最後實作後端與前端。

5. **預設重置時間為 4 點** — 凌晨 4 點是多數使用者的睡眠時間，作為學習日分界較合理。

## Risks / Trade-offs

- **額外查詢** — 每次 `getStudyCards()` 多了 2 次 `reviewLog.count` 查詢。但這些查詢有索引支援且資料量小，效能影響可忽略。
- **伺服器時間** — 學習日計算使用伺服器本地時間，若使用者跨時區使用可能有誤差。目前不處理時區，未來可擴充。
- **Migration 向下相容** — `dailyResetHour` 有 `@default(4)`，既有資料自動獲得預設值，無需資料遷移。
