## Context

目前牌組的每日學習限制（`dailyNewCards`、`dailyReviewCards`）是固定配置，存在 Deck 模型中。`StudyService.getStudyCards()` 在計算剩餘額度時直接讀取這些值。使用者若想臨時加量，只能修改牌組設定，影響往後每天。

需要一個輕量的覆寫機制，讓使用者可以臨時提高單日上限。

## Goals / Non-Goals

**Goals:**
- 使用者可在牌組詳情頁設定今日的新卡/複習上限覆寫
- 覆寫隔天自動失效，不需清理機制
- 所有使用每日限制的邏輯（卡片選取、摘要、進度顯示）皆考慮覆寫值

**Non-Goals:**
- 不支援往下調（覆寫值必須 >= 預設值）
- 不保留覆寫歷史紀錄
- 不支援批次設定多個牌組的覆寫
- 不支援預先排程（只能設定當天）

## Decisions

### D1: 覆寫資料存在 Deck 表上，不另建新表

**選擇**: 在 Deck 表新增 3 個 nullable 欄位
**替代方案**: 建立獨立的 DailyOverride 表
**理由**: 一次只會有「今天」的覆寫，不需要歷史紀錄。直接放在 Deck 上可以避免額外的 JOIN 查詢，邏輯更簡單。nullable 欄位在沒有覆寫時不佔空間。

新增欄位：
```
overrideDate          DateTime?   // 覆寫適用的學習日起始時間
overrideNewCards      Int?        // 今日新卡上限覆寫
overrideReviewCards   Int?        // 今日複習上限覆寫
```

### D2: overrideDate 存學習日起始時間，而非日期字串

**選擇**: `overrideDate` 存的是 `getStartOfStudyDay()` 計算出的 DateTime
**替代方案**: 存日期字串如 `"2025-01-15"`
**理由**: 學習日的邊界由 `dailyResetHour` 決定，不一定對齊日曆日。直接存學習日起始時間可以與 `getStartOfStudyDay()` 的回傳值做精確比對，避免時區與邊界問題。

### D3: 使用專用 API 端點設定覆寫

**選擇**: `PUT /decks/{deckId}/daily-override`
**替代方案**: 擴充既有的 `PATCH /decks/{deckId}`
**理由**: 覆寫是暫時性操作，語意上與「更新牌組設定」不同。獨立端點讓 API 語意更清楚，也方便未來擴充（例如加入清除覆寫的功能）。

請求格式：
```json
{
  "newCards": 50,
  "reviewCards": 200
}
```

兩個欄位皆為 optional，只提供其中一個時只覆寫該項。後端自動以當前學習日的起始時間填入 `overrideDate`。

### D4: 計算 effective limit 的邏輯集中在 helper function

**選擇**: 建立 `getEffectiveDailyLimits(deck)` 工具函式
**理由**: 至少有三處需要使用 effective limit：`getStudyCards()`、`getSummary()`、`DeckService` 的統計計算。集中邏輯避免重複且確保一致性。

```typescript
function getEffectiveDailyLimits(deck: {
  dailyNewCards: number;
  dailyReviewCards: number;
  dailyResetHour: number;
  overrideDate: Date | null;
  overrideNewCards: number | null;
  overrideReviewCards: number | null;
}): { effectiveNewCards: number; effectiveReviewCards: number } {
  const studyDayStart = getStartOfStudyDay(new Date(), deck.dailyResetHour);
  const isOverrideActive = deck.overrideDate?.getTime() === studyDayStart.getTime();

  return {
    effectiveNewCards: isOverrideActive && deck.overrideNewCards != null
      ? deck.overrideNewCards
      : deck.dailyNewCards,
    effectiveReviewCards: isOverrideActive && deck.overrideReviewCards != null
      ? deck.overrideReviewCards
      : deck.dailyReviewCards,
  };
}
```

### D5: 牌組詳情頁的 UI 入口

**選擇**: 在牌組詳情頁的今日進度區域加入「調整今日上限」按鈕，點擊後展開 inline 編輯或開啟 dialog
**理由**: 使用者在查看進度時最容易產生「想多練一些」的念頭，放在進度旁邊最符合使用情境。

### D6: 覆寫值的驗證規則

- `newCards` 必須 >= `deck.dailyNewCards`（不能往下調）
- `reviewCards` 必須 >= `deck.dailyReviewCards`（不能往下調）
- 上限沿用既有範圍的合理倍數（暫定不設硬上限，但前端 UI 可做建議範圍）

## Risks / Trade-offs

- **[Risk] 覆寫與設定修改的交互** → 若使用者先設定覆寫（newCards = 50），再去牌組設定把 dailyNewCards 改成 60，覆寫值會變得小於預設值。Mitigation: 計算 effective limit 時取 `max(overrideValue, defaultValue)`，確保覆寫永遠不會降低上限。
- **[Risk] 時區問題** → `overrideDate` 的比對依賴 `getStartOfStudyDay()` 的精確時間。Mitigation: 兩端都使用同一個函式計算，且 DateTime 比對到毫秒級。
- **[Trade-off] 不建新表** → 若未來需要覆寫歷史分析，需要額外工作。但目前需求明確不需要，保持簡單。
