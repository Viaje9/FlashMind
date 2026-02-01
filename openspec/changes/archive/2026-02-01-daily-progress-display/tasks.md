## 1. 後端 API 擴充

- [x] 1.1 擴充 `StudyService.getSummary()` 方法，新增查詢 `todayNewStudied`（今日已學新卡數，prevState = NEW 的 ReviewLog count）和 `todayReviewStudied`（今日已複習數，prevState != NEW 的 ReviewLog count），並回傳 `dailyNewCards` 和 `dailyReviewCards`
- [x] 1.2 更新 `StudySummary` 介面，新增 `dailyNewCards`、`dailyReviewCards`、`todayNewStudied`、`todayReviewStudied` 欄位
- [x] 1.3 為 `getSummary` 擴充撰寫單元測試，驗證各欄位計算正確性（含反向學習場景）

## 2. OpenAPI 契約與 API Client

- [x] 2.1 更新 `openapi/` 中 `StudySummaryResponse` schema，新增 `dailyNewCards`、`dailyReviewCards`、`todayNewStudied`、`todayReviewStudied` 欄位
- [x] 2.2 重新生成 `packages/api-client/`

## 3. 前端 deck-stats-card 元件擴充

- [x] 3.1 `FmDeckStatsCardComponent` 新增 input 屬性：`dailyNewCards`、`dailyReviewCards`、`todayNewStudied`、`todayReviewStudied`
- [x] 3.2 在 `deck-stats-card.component.html` 的「新卡片」與「待複習」數字下方新增進度條與 `N / M` 文字
- [x] 3.3 進度條使用 Tailwind CSS 實作，寬度按比例計算（`Math.min(100, (studied / limit) * 100)`），新卡用藍色、複習用綠色

## 4. 前端 deck-detail 頁面整合

- [x] 4.1 `DeckDetailComponent` 在 `ngOnInit` 中呼叫 `StudyService.getStudySummary(deckId)`，將結果傳入 `deck-stats-card`
- [x] 4.2 將 summary 資料透過 input binding 傳入 `fm-deck-stats-card`
