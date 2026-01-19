# Tasks: 卡片匯入功能

## 1. API 設計與實作

- [x] 1.1 在 `openapi/api.yaml` 新增匯入 API 端點與 schema
- [x] 1.2 執行 `pnpm generate:api` 產生 API client
- [x] 1.3 實作後端 `CardsController.importCards()` 方法
- [x] 1.4 實作後端 `CardsService.importCards()` 方法
- [x] 1.5 撰寫後端單元測試

## 2. 前端匯入入口

- [x] 2.1 在牌組詳情頁 PageHeader 新增「匯入」IconButton
- [x] 2.2 新增路由 `/decks/:id/cards/import`

## 3. 前端匯入頁面

- [x] 3.1 建立 `CardImportComponent` 頁面元件
- [x] 3.2 實作 JSON 輸入區塊（textarea + 檔案上傳）
- [x] 3.3 實作 JSON 解析與前端驗證
- [x] 3.4 實作卡片預覽列表
- [x] 3.5 實作匯入結果顯示
- [x] 3.6 撰寫前端單元測試

## 4. E2E 測試

- [ ] 4.1 撰寫匯入功能 E2E 測試（跳過）

## 5. 收尾

- [x] 5.1 更新 spec 並執行驗證
