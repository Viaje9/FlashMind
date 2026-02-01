## 1. 資料庫 Schema 與 Migration

- [x] 1.1 在 Deck model 新增 `learningSteps`（String, 預設 `"1m,10m"`）、`relearningSteps`（String, 預設 `"10m"`）、`requestRetention`（Float, 預設 `0.9`）、`maximumInterval`（Int, 預設 `36500`）欄位
- [x] 1.2 執行 `prisma migrate` 產生 migration 檔案，確認既有資料使用預設值填充

## 2. 後端 DTO 與驗證

- [x] 2.1 建立 `learning-steps.validator.ts` 自訂驗證器，驗證步驟字串格式（`<正整數><m|h|d>` 逗號分隔）
- [x] 2.2 在 `CreateDeckDto` 新增 `learningSteps`、`relearningSteps`、`requestRetention`、`maximumInterval` 可選欄位與驗證規則
- [x] 2.3 在 `UpdateDeckDto` 新增相同的可選欄位與驗證規則

## 3. 後端 FsrsService 改造

- [x] 3.1 定義 `DeckFsrsParams` 介面（`learningSteps`、`relearningSteps`、`requestRetention`、`maximumInterval`）
- [x] 3.2 新增 `getScheduler(params?: DeckFsrsParams)` 方法，根據參數動態建立或從快取取得 FSRS 實例
- [x] 3.3 修改 `calculateNextReview()` 新增可選的 `fsrsParams` 參數，使用 `getScheduler()` 取得排程器
- [x] 3.4 新增 `parseLearningSteps(stepsString: string): Steps` 工具方法，將逗號分隔字串轉換為 ts-fsrs 格式
- [x] 3.5 撰寫 FsrsService 新功能的單元測試（不同參數建立排程器、快取命中、步驟字串解析、learningStep 追蹤）

## 4. 後端 DeckService 與 StudyService 整合

- [x] 4.1 修改 `DeckService.create()` 與 `DeckService.update()` 支援新的 FSRS 欄位讀寫
- [x] 4.2 修改 `DeckService.findById()` 回傳 `DeckDetail` 包含 FSRS 參數
- [x] 4.3 修改 `StudyService.submitReview()` 查詢牌組 FSRS 設定（含 `learningSteps`/`relearningSteps`）並傳入 `FsrsService.calculateNextReview()`
- [x] 4.4 撰寫 DeckService 新欄位的單元測試
- [x] 4.5 撰寫 StudyService 使用 per-deck 參數的單元測試（含 learningSteps/relearningSteps 傳遞驗證）

## 5. OpenAPI 契約更新

- [x] 5.1 在 `Deck`、`DeckDetail` schema 新增 FSRS 參數欄位
- [x] 5.2 在 `CreateDeckRequest`、`UpdateDeckRequest` schema 新增 FSRS 參數欄位
- [x] 5.3 重新產生 API Client（`pnpm --filter @flashmind/api-client generate`）

## 6. 前端牌組設定頁面

- [x] 6.1 在 `deck-settings.component.ts` 新增 FSRS 參數的 FormControl（requestRetention、maximumInterval、learningSteps、relearningSteps）
- [x] 6.2 在 `deck-settings.component.html` 新增「FSRS 演算法」區塊，包含 4 個參數的表單欄位與格式提示
- [x] 6.3 實作 `loadDeck()` 預填 FSRS 參數到表單
- [x] 6.4 實作 `onSave()` 將 FSRS 參數一併送出更新
- [x] 6.5 實作「重置為預設值」按鈕功能
- [x] 6.6 新增前端格式驗證（learningSteps 格式、retention 範圍、interval 範圍）
