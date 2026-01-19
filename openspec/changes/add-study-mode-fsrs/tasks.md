## 1. 後端 - FSRS 服務

- [x] 1.1 安裝 ts-fsrs 套件 (`pnpm add ts-fsrs -w --filter @flashmind/api`)
- [x] 1.2 建立 FsrsModule 和 FsrsService
- [x] 1.3 實作 `initializeCard()` 方法（初始化新卡 FSRS 狀態）
- [x] 1.4 實作 `calculateNextReview()` 方法（計算下次複習日期）
- [x] 1.5 實作 Rating 對應邏輯（Known→Good, Unfamiliar→Hard, Unknown→Again）
- [x] 1.6 撰寫 FsrsService 單元測試

## 2. 後端 - 資料模型

- [x] 2.1 新增 ReviewLog 模型到 Prisma schema
- [x] 2.2 執行 Prisma migration
- [x] 2.3 更新 Card 模型（確認 FSRS 欄位完整）

## 3. 後端 - 學習 API

- [x] 3.1 建立 StudyModule、StudyController、StudyService
- [x] 3.2 實作 `GET /decks/{deckId}/study/cards` - 取得今日學習卡片
  - 查詢待複習卡片（due <= now）
  - 查詢新卡片（state = NEW）
  - 套用每日上限
  - 正確排序（複習優先）
- [x] 3.3 實作 `POST /decks/{deckId}/study/review` - 提交評分
  - 驗證卡片歸屬
  - 呼叫 FsrsService 計算新排程
  - 更新 Card FSRS 欄位
  - 建立 ReviewLog
- [x] 3.4 實作 `GET /decks/{deckId}/study/summary` - 取得統計
- [x] 3.5 撰寫 StudyService 單元測試

## 4. API 規格

- [x] 4.1 更新 OpenAPI 規格新增學習相關端點
- [x] 4.2 定義 StudyCard、SubmitReviewRequest、StudySummary schema
- [x] 4.3 執行 `pnpm generate:api` 產生客戶端

## 5. 前端 - Domain 與 Store

- [x] 5.1 建立 study.domain.ts（純函數：評分對應、進度計算）
- [x] 5.2 撰寫 study.domain.spec.ts 單元測試
- [x] 5.3 建立 study.store.ts
  - 狀態：currentCards, currentIndex, failedQueue, stats
  - 方法：startStudy(), submitRating(), undoRating()
- [x] 5.4 實作「不知道」卡片重試佇列邏輯

## 6. 前端 - 學習頁面

- [x] 6.1 更新 StudyComponent 整合 StudyStore
- [x] 6.2 實作開始學習流程（從 API 載入卡片）
- [x] 6.3 實作翻卡互動（點擊翻轉）
- [x] 6.4 實作評分按鈕（三種評分）
- [x] 6.5 實作返回/修改評分功能
- [x] 6.6 實作學習完成畫面
- [x] 6.7 更新 StudyProgress 顯示真實進度
- [x] 6.8 更新 StudyDecisionBar 支援三種評分

## 7. 驗收與文件

- [x] 7.1 驗證所有 User Stories 驗收標準
- [x] 7.2 更新 API 文件
