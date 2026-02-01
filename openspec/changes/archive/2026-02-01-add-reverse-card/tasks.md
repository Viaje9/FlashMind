## 1. 資料模型與 Migration

- [x] 1.1 在 Card model 新增反向 FSRS 排程欄位（`reverseState`/`reverseDue`/`reverseStability`/`reverseDifficulty`/`reverseElapsedDays`/`reverseScheduledDays`/`reverseReps`/`reverseLapses`/`reverseLastReview`）
- [x] 1.2 在 Deck model 新增 `enableReverse` 欄位（Boolean，預設 `false`）
- [x] 1.3 在 ReviewLog 新增 `direction` 欄位（String，預設 `"FORWARD"`）
- [x] 1.4 移除舊的 `CardDirection` enum、Card 的 `direction` 與 `pairId` 欄位
- [x] 1.5 執行 Prisma migration，為既有卡片的反向 FSRS 欄位設定預設值
- [x] 1.6 執行 `prisma:generate` 更新 Prisma Client 型別

## 2. OpenAPI 契約更新

- [x] 2.1 Card/CardListItem schema 移除 `direction`、`hasReversePair` 欄位
- [x] 2.2 CreateCardRequest 移除 `generateReverse` 欄位
- [x] 2.3 ImportCardsRequest 移除 `generateReverse` 欄位
- [x] 2.4 ImportCardsResult 移除 `reverseCount` 欄位
- [x] 2.5 Deck/DeckDetail schema 新增 `enableReverse` 欄位（boolean）
- [x] 2.6 CreateDeckRequest/UpdateDeckRequest 新增 `enableReverse` 欄位（boolean，選填）
- [x] 2.7 StudyCard schema 新增 `direction` 欄位（`FORWARD`/`REVERSE`）
- [x] 2.8 SubmitReviewRequest 新增 `direction` 欄位（`FORWARD`/`REVERSE`，選填）
- [x] 2.9 重新生成 API client（`packages/api-client`）

## 3. 後端核心邏輯

- [x] 3.1 簡化 `card.service.ts` 匯入邏輯：移除 `generateReverse` 參數與反向卡生成
- [x] 3.2 簡化 `card.service.ts` 新增邏輯：移除 `generateReverse` 參數與反向卡生成
- [x] 3.3 簡化 `card.service.ts` 編輯邏輯：移除反向卡同步更新
- [x] 3.4 簡化 `card.service.ts` 刪除邏輯：移除反向卡 cascade 刪除
- [x] 3.5 移除反向卡生成工具函式（`generateReverseCard`）及其相關測試
- [x] 3.6 更新 CardService 單元測試，移除與反向卡生成/同步/cascade 相關的測試案例
- [x] 3.7 修改 `deck.service.ts`：支援 `enableReverse` 欄位的建立與更新
- [x] 3.8 撰寫 DeckService `enableReverse` 相關單元測試
- [x] 3.9 修改 `study.service.ts`：`getStudyCards` 根據 `enableReverse` 決定是否查詢反向排程，使用 `mapToStudyCard` 產生雙向 StudyCard
- [x] 3.10 修改 `study.service.ts`：`submitReview` 新增 `direction` 參數，根據方向讀寫對應 FSRS 欄位
- [x] 3.11 修改 `study.service.ts`：`getSummary` 在 `enableReverse` 開啟時加計反向統計
- [x] 3.12 修改 `study.service.ts`：ReviewLog 記錄 `direction`
- [x] 3.13 修改 `fsrs.service.ts`：支援 per-deck FSRS 參數（`requestRetention`/`maximumInterval`）
- [x] 3.14 撰寫 StudyService 雙向排程相關單元測試
- [x] 3.15 撰寫 FsrsService per-deck 參數相關單元測試

## 4. 前端

- [x] 4.1 移除匯入頁面的「同時產生反向卡」toggle 開關
- [x] 4.2 移除匯入頁面結果摘要中的 reverseCount 顯示
- [x] 4.3 移除匯入元件傳遞 `generateReverse` 參數至 API 的邏輯
- [x] 4.4 移除卡片列表元件中的反向卡方向標籤（direction badge）
- [x] 4.5 牌組設定頁面新增「啟用反向學習」toggle，綁定 `enableReverse` 欄位
- [x] 4.6 修改學習 domain：新增 `getStudyWord` 函式（反向時回傳所有 zhMeaning 以全形分號連接）
- [x] 4.7 修改學習 domain：新增 `getStudyTranslations` 函式（反向時回傳 `[front]`）
- [x] 4.8 撰寫 `getStudyWord`/`getStudyTranslations` 單元測試
- [x] 4.9 修改學習元件：使用 `getStudyWord`/`getStudyTranslations` 處理正反面顯示
- [x] 4.10 修改學習元件：submitReview 時傳遞當前 StudyCard 的 `direction` 參數
