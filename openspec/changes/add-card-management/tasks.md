# Tasks: 卡片管理功能

## 1. 資料庫與模型

- [ ] 1.1 新增 Card 和 CardMeaning Prisma 模型
- [ ] 1.2 執行 Prisma migrate 建立資料表
- [ ] 1.3 更新 Deck 模型加入 cards 關聯

## 2. API 契約

- [ ] 2.1 在 openapi/api.yaml 新增 Card 相關 schemas
- [ ] 2.2 在 openapi/api.yaml 新增卡片 CRUD 端點
- [ ] 2.3 執行 generate:api 產生 TypeScript 客戶端

## 3. 後端實作（TDD）

- [ ] 3.1 建立 CardModule 空殼結構
- [ ] 3.2 撰寫 CardService 單元測試（Red）
- [ ] 3.3 實作 CardService 讓測試通過（Green）
  - [ ] 3.3.1 listCards
  - [ ] 3.3.2 createCard
  - [ ] 3.3.3 getCard
  - [ ] 3.3.4 updateCard
  - [ ] 3.3.5 deleteCard
- [ ] 3.4 重構 CardService（Refactor）
- [ ] 3.5 實作 CardController

## 4. 前端架構（TDD）

- [ ] 4.1 撰寫 card.domain.spec.ts 單元測試（Red）
- [ ] 4.2 建立 card.domain.ts 讓測試通過（Green）
- [ ] 4.3 重構 card.domain.ts（Refactor）
- [ ] 4.4 建立 card.store.ts（狀態管理、API 呼叫）
- [ ] 4.5 建立 card.form.ts（Signal Forms 表單定義）

## 5. 前端路由調整

- [ ] 5.1 調整路由：/decks/:deckId/cards/new
- [ ] 5.2 新增路由：/decks/:deckId/cards/:cardId/edit

## 6. 牌組詳情頁升級

- [ ] 6.1 整合 card.store 載入卡片列表
- [ ] 6.2 顯示牌組摘要（新卡/待複習/建立時間/上次複習）
- [ ] 6.3 實作卡片列表顯示
- [ ] 6.4 實作空狀態引導
- [ ] 6.5 實作編輯/刪除按鈕事件

## 7. 卡片編輯頁升級

- [ ] 7.1 整合 card.form 實作表單綁定
- [ ] 7.2 實作新增詞義區塊功能
- [ ] 7.3 實作刪除詞義區塊功能（保留至少一筆）
- [ ] 7.4 實作儲存（新增/更新）邏輯
- [ ] 7.5 實作取消返回邏輯

## 8. 刪除確認對話框

- [ ] 8.1 實作刪除卡片確認對話框
- [ ] 8.2 刪除成功後更新列表
