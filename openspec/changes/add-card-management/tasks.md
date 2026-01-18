## 1. 資料庫 Schema

- [ ] 1.1 新增 Deck 模型至 Prisma schema
- [ ] 1.2 新增 Card 模型至 Prisma schema（含 meanings JSON 欄位）
- [ ] 1.3 新增 User-Deck 關聯
- [ ] 1.4 執行 Prisma migration
- [ ] 1.5 執行 prisma:generate

## 2. OpenAPI 規格

- [ ] 2.1 新增 Deck schema 定義
- [ ] 2.2 新增 Card schema 定義
- [ ] 2.3 新增 MeaningBlock schema 定義
- [ ] 2.4 新增 `GET /decks/:id` 端點（牌組詳情）
- [ ] 2.5 新增 `GET /decks/:deckId/cards` 端點（卡片列表）
- [ ] 2.6 新增 `POST /decks/:deckId/cards` 端點（新增卡片）
- [ ] 2.7 新增 `GET /cards/:id` 端點（取得卡片）
- [ ] 2.8 新增 `PATCH /cards/:id` 端點（編輯卡片）
- [ ] 2.9 新增 `DELETE /cards/:id` 端點（刪除卡片）

## 3. 後端 API（TDD）

### 3.1 DeckModule

- [ ] 3.1.1 建立 DeckModule 架構（module, controller, service）
- [ ] 3.1.2 **[TDD]** 撰寫 DeckService.findById 測試
- [ ] 3.1.3 實作 DeckService.findById
- [ ] 3.1.4 **[TDD]** 撰寫 GET /decks/:id controller 測試
- [ ] 3.1.5 實作 GET /decks/:id controller

### 3.2 CardModule - 新增卡片

- [ ] 3.2.1 建立 CardModule 架構（module, controller, service）
- [ ] 3.2.2 **[TDD]** 撰寫 CardService.create 測試
- [ ] 3.2.3 實作 CardService.create
- [ ] 3.2.4 **[TDD]** 撰寫 POST /decks/:deckId/cards controller 測試
- [ ] 3.2.5 實作 POST /decks/:deckId/cards controller
- [ ] 3.2.6 **[TDD]** 撰寫驗證邏輯測試（front 必填、至少一筆 meaning）
- [ ] 3.2.7 實作驗證邏輯

### 3.3 CardModule - 取得卡片列表

- [ ] 3.3.1 **[TDD]** 撰寫 CardService.findByDeckId 測試（含分頁）
- [ ] 3.3.2 實作 CardService.findByDeckId
- [ ] 3.3.3 **[TDD]** 撰寫搜尋邏輯測試
- [ ] 3.3.4 實作搜尋邏輯（搜尋 front 和 meanings）
- [ ] 3.3.5 **[TDD]** 撰寫 GET /decks/:deckId/cards controller 測試
- [ ] 3.3.6 實作 GET /decks/:deckId/cards controller

### 3.4 CardModule - 取得單一卡片

- [ ] 3.4.1 **[TDD]** 撰寫 CardService.findById 測試
- [ ] 3.4.2 實作 CardService.findById
- [ ] 3.4.3 **[TDD]** 撰寫 GET /cards/:id controller 測試
- [ ] 3.4.4 實作 GET /cards/:id controller

### 3.5 CardModule - 編輯卡片

- [ ] 3.5.1 **[TDD]** 撰寫 CardService.update 測試
- [ ] 3.5.2 實作 CardService.update
- [ ] 3.5.3 **[TDD]** 撰寫 PATCH /cards/:id controller 測試
- [ ] 3.5.4 實作 PATCH /cards/:id controller

### 3.6 CardModule - 刪除卡片

- [ ] 3.6.1 **[TDD]** 撰寫 CardService.delete 測試
- [ ] 3.6.2 實作 CardService.delete
- [ ] 3.6.3 **[TDD]** 撰寫 DELETE /cards/:id controller 測試
- [ ] 3.6.4 實作 DELETE /cards/:id controller

### 3.7 權限驗證

- [ ] 3.7.1 **[TDD]** 撰寫卡片權限驗證測試（只能操作自己的卡片）
- [ ] 3.7.2 實作卡片權限 Guard

## 4. 產生 API Client

- [ ] 4.1 執行 `pnpm --filter ./apps/web generate:api`
- [ ] 4.2 驗證產生的 API client 方法

## 5. 前端整合（TDD）

### 5.1 DeckDetailComponent

- [ ] 5.1.1 **[TDD]** 撰寫 DeckDetailDomain 測試（載入牌組資料）
- [ ] 5.1.2 實作 DeckDetailDomain
- [ ] 5.1.3 **[TDD]** 撰寫卡片列表載入測試
- [ ] 5.1.4 實作卡片列表載入
- [ ] 5.1.5 **[TDD]** 撰寫搜尋過濾測試
- [ ] 5.1.6 實作搜尋過濾
- [ ] 5.1.7 實作空狀態 UI
- [ ] 5.1.8 實作刪除卡片確認對話框
- [ ] 5.1.9 綁定編輯/刪除按鈕事件

### 5.2 CardEditorComponent

- [ ] 5.2.1 **[TDD]** 撰寫 CardEditorDomain 測試（表單驗證）
- [ ] 5.2.2 實作 CardEditorDomain
- [ ] 5.2.3 **[TDD]** 撰寫新增卡片流程測試
- [ ] 5.2.4 實作新增卡片 API 整合
- [ ] 5.2.5 **[TDD]** 撰寫編輯卡片流程測試
- [ ] 5.2.6 實作編輯卡片 API 整合
- [ ] 5.2.7 實作詞義區塊動態新增/刪除
- [ ] 5.2.8 新增路由 `/decks/:deckId/cards/new` 和 `/cards/:id/edit`

## 6. E2E 測試

### 6.1 US-020：檢視牌組內卡片

- [ ] 6.1.1 測試顯示牌組摘要
- [ ] 6.1.2 測試顯示卡片列表
- [ ] 6.1.3 測試空狀態顯示
- [ ] 6.1.4 測試搜尋功能

### 6.2 US-022：新增卡片

- [ ] 6.2.1 測試開啟新增表單
- [ ] 6.2.2 測試填寫並儲存卡片
- [ ] 6.2.3 測試新增/刪除詞義區塊
- [ ] 6.2.4 測試驗證錯誤
- [ ] 6.2.5 測試取消新增

### 6.3 US-024：編輯卡片

- [ ] 6.3.1 測試進入編輯模式
- [ ] 6.3.2 測試編輯並儲存

### 6.4 US-025：刪除卡片

- [ ] 6.4.1 測試刪除確認對話框
- [ ] 6.4.2 測試確認刪除
- [ ] 6.4.3 測試取消刪除
