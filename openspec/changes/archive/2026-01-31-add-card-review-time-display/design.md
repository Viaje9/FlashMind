## Context

牌組詳情頁的卡片列表原本只顯示卡片正面文字和摘要，不包含任何學習狀態資訊。後端卡片列表 API 只回傳 `id`、`front`、`summary` 三個欄位，而 FSRS 排程欄位（`state`、`due`）雖已存在於 Card model 中，但未暴露給列表 API。此外，牌組統計（`newCount`、`reviewCount`、`totalCount`）在 `deck.service.ts` 中被硬編碼為 0。

## Goals / Non-Goals

**Goals:**

- 卡片列表 API 回傳 `state` 和 `due` 欄位，讓前端能顯示複習時間
- 前端卡片列表項目以行內式（版本 B）呈現複習狀態，根據狀態顯示不同顏色和文字
- 修正牌組統計硬編碼為 0 的 bug

**Non-Goals:**

- 不改變 FSRS 排程演算法本身
- 不新增排序/篩選卡片的功能（如依複習時間排序）
- 不修改學習模式的流程

## Decisions

### 1. API 擴充方式：擴展現有 `CardListItem` 而非新增 endpoint

直接在 `GET /api/decks/:deckId/cards` 的回傳中加入 `state` 和 `due` 欄位。

**替代方案**：新增獨立 endpoint（如 `/cards/:id/schedule`）分別取得排程資訊。
**選擇理由**：`state` 和 `due` 是輕量欄位，已存在於 Card model 中，無需額外查詢。新增 endpoint 會增加前端的 API 呼叫次數，對列表場景不實際。

### 2. 複習時間計算：前端 computed 而非後端格式化

後端回傳原始的 `state`（enum）和 `due`（ISO 8601 timestamp），前端透過 `computed` 即時計算顯示文字（如「2 小時後到期」「已逾期 3 天」）。

**替代方案**：後端直接回傳格式化好的顯示文字。
**選擇理由**：前端計算可以即時反映時間變化（使用者停留在頁面時，「59 分鐘後」會自動變為「已到期」），且支援未來的 i18n 需求。

### 3. 顯示風格：行內式（版本 B）

在卡片描述文字下方，以小字搭配 `schedule` icon 行內顯示。經 Storybook 設計提案比較三個版本後選定。

**替代方案**：版本 A（底部標籤式 pill badge）、版本 C（右側狀態區塊）。
**選擇理由**：版本 B 最簡潔低調，不破壞原有卡片的視覺層次，同時清楚傳達資訊。

### 4. 牌組統計修正：直接在 `deck.service.ts` 查詢

在 `findAllByUserId` 和 `findById` 方法中使用 `prisma.card.count` 查詢實際的 `newCount`、`reviewCount`、`totalCount`。

**替代方案**：注入 `StudyService` 複用其 `getSummary()` 方法。
**選擇理由**：避免模組間的循環依賴，且 deck service 只需要簡單的 count 查詢，不需要 study service 的完整摘要（如 `todayStudied`）。

## Risks / Trade-offs

- **牌組列表 N+1 查詢**：`findAllByUserId` 對每個 deck 執行 3 個 count 查詢（`Promise.all` 並行），當牌組數量多時可能影響效能。→ 目前使用者牌組數量有限，可接受。若未來需要優化，可改用 raw SQL 的 subquery 一次查回。
- **前端時間顯示不會自動刷新**：`computed` 只在 `state`/`due` 變更時重算，使用者停留在頁面上時不會即時更新「X 分鐘後」的倒數。→ 當前可接受，未來可透過 `setInterval` 觸發信號更新。
- **API 向下相容**：新增欄位為 additive change，不影響既有 API 消費者。`due` 為 nullable，新卡片回傳 `null`。
