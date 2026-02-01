## 1. API 契約擴充

- [x] 1.1 在 `openapi/api.yaml` 的 `DeckListItem` schema 新增 `dailyNewCards`、`dailyReviewCards`、`todayNewStudied`、`todayReviewStudied` 四個 required 欄位

## 2. 後端實作

- [x] 2.1 更新 `DeckListItem` interface 新增 4 個欄位
- [x] 2.2 在 `findAllByUserId` 匯入 `getStartOfStudyDay` 並新增 `reviewLog.count` 查詢計算今日學習進度
- [x] 2.3 更新後端測試：mock `reviewLog.count`、更新既有測試 expected 值、新增今日學習進度測試

## 3. API Client 重新生成

- [x] 3.1 執行 `pnpm --filter ./apps/web generate:api` 重新生成 API Client

## 4. 前端 deck-card 元件改版

- [x] 4.1 更新元件 TS：移除 `DeckTag`/`tagList`，移除 `FmBadgeComponent`/`FmIconButtonComponent`，新增 `FmButtonComponent`，新增 daily progress input 與 computed
- [x] 4.2 重寫元件 HTML：兩欄統計設計（藍色新卡 + 綠色複習 + daily 進度條）+ 整體進度條 + 全寬按鈕

## 5. 前端 deck-list 頁面更新

- [x] 5.1 擴充 `DeckPreview` interface，新增 `dailyNewCards`、`dailyReviewCards`、`todayNewStudied`、`todayReviewStudied`、`actionDisabled`
- [x] 5.2 更新 `mapToDeckPreview` 映射新欄位，`showAction` 永遠為 true，以 `actionDisabled` 控制
- [x] 5.3 拆分導航：`onCardClick` → `/decks/:id`，`onStartStudy` → `/decks/:id/study`
- [x] 5.4 更新 HTML 模板綁定新 input 與事件

## 6. Storybook 更新

- [x] 6.1 更新 deck-card stories：加入新 input args，新增「有進度」「已達上限」「無待學習」「已完成全部」「含反向學習」stories

## 7. 驗證

- [x] 7.1 執行後端測試確認全部通過
