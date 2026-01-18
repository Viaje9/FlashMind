## 1. 資料庫 Schema

- [x] 1.1 新增 Deck 模型至 Prisma schema（含 dailyNewCards、dailyReviewCards）
- [x] 1.2 新增 User-Deck 關聯
- [x] 1.3 執行 Prisma migration
- [x] 1.4 執行 prisma:generate

## 2. OpenAPI 規格

- [x] 2.1 新增 Deck schema 定義（id, name, dailyNewCards, dailyReviewCards, createdAt, updatedAt）
- [x] 2.2 新增 DeckListItem schema（含 newCount, reviewCount, totalCount, completedCount, progress）
- [x] 2.3 新增 CreateDeckRequest schema
- [x] 2.4 新增 UpdateDeckRequest schema
- [x] 2.5 新增 `GET /decks` 端點（listDecks）
- [x] 2.6 新增 `POST /decks` 端點（createDeck）
- [x] 2.7 新增 `PATCH /decks/:id` 端點（updateDeck）
- [x] 2.8 新增 `DELETE /decks/:id` 端點（deleteDeck）

## 3. 後端 API（TDD）

### 3.1 DeckModule 架構

- [x] 3.1.1 建立 DeckModule 架構（module, controller, service）
- [x] 3.1.2 註冊 DeckModule 至 AppModule

### 3.2 取得牌組列表

- [x] 3.2.1 **[TDD]** 撰寫 DeckService.findAllByUserId 測試
- [x] 3.2.2 實作 DeckService.findAllByUserId（含統計計算）
- [x] 3.2.3 **[TDD]** 撰寫 GET /decks controller 測試
- [x] 3.2.4 實作 GET /decks controller

### 3.3 建立牌組

- [x] 3.3.1 **[TDD]** 撰寫 DeckService.create 測試
- [x] 3.3.2 實作 DeckService.create
- [x] 3.3.3 **[TDD]** 撰寫 POST /decks controller 測試
- [x] 3.3.4 實作 POST /decks controller
- [x] 3.3.5 **[TDD]** 撰寫驗證邏輯測試（name 必填、範圍驗證）
- [x] 3.3.6 實作驗證邏輯

### 3.4 更新牌組

- [x] 3.4.1 **[TDD]** 撰寫 DeckService.update 測試
- [x] 3.4.2 實作 DeckService.update
- [x] 3.4.3 **[TDD]** 撰寫 PATCH /decks/:id controller 測試
- [x] 3.4.4 實作 PATCH /decks/:id controller

### 3.5 刪除牌組

- [x] 3.5.1 **[TDD]** 撰寫 DeckService.delete 測試
- [x] 3.5.2 實作 DeckService.delete
- [x] 3.5.3 **[TDD]** 撰寫 DELETE /decks/:id controller 測試
- [x] 3.5.4 實作 DELETE /decks/:id controller

### 3.6 權限驗證

- [x] 3.6.1 **[TDD]** 撰寫牌組權限驗證測試（只能操作自己的牌組）
- [x] 3.6.2 實作牌組權限 Guard 或在 Service 層驗證

## 4. 產生 API Client

- [x] 4.1 執行 `pnpm --filter ./apps/web generate:api`
- [x] 4.2 驗證產生的 API client 方法（listDecks, createDeck, updateDeck, deleteDeck）

## 5. 前端整合（TDD）

### 5.1 DeckListComponent

- [x] 5.1.1 實作 DeckListComponent API 整合（使用 Signals）
- [x] 5.1.2 實作搜尋過濾功能
- [x] 5.1.3 實作空狀態 UI（整合現有 FmEmptyStateComponent）
- [x] 5.1.4 移除硬編碼牌組資料，綁定 API 回應

### 5.2 DeckCreateComponent

- [x] 5.2.1 實作表單驗證
- [x] 5.2.2 實作建立牌組 API 整合
- [x] 5.2.3 實作儲存成功後導向牌組詳情頁
- [x] 5.2.4 實作錯誤處理

### 5.3 DeckSettingsComponent（新增）

- [x] 5.3.1 建立 DeckSettingsComponent 元件
- [x] 5.3.2 實作表單 UI（複用 DeckCreateComponent 表單結構）
- [x] 5.3.3 實作載入現有設定
- [x] 5.3.4 實作更新 API 整合
- [x] 5.3.5 新增路由 `/decks/:id/settings`

### 5.4 刪除牌組功能

- [x] 5.4.1 在 DeckSettingsComponent 新增刪除按鈕
- [x] 5.4.2 實作刪除確認對話框（使用 FmConfirmDialogComponent）
- [x] 5.4.3 實作刪除 API 整合
- [x] 5.4.4 刪除成功後導向牌組列表

## 6. E2E 測試

> 已移至獨立的 E2E 測試任務處理

- [x] 6.1 E2E 測試規劃完成（見 e2e/specs/deck.test-plan.md）
