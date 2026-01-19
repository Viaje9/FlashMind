# Change: 新增卡片管理功能

## Why

目前系統已有牌組管理功能，但缺少卡片 CRUD 功能。使用者無法在牌組內新增、檢視、編輯或刪除卡片，這是核心學習流程的必要功能。依據 P0-card-management 功能文件（US-020、US-022、US-024、US-025），需要實作完整的卡片管理功能。

## What Changes

### 後端
- 新增 `Card` 與 `CardMeaning` Prisma 資料模型
- 新增卡片 CRUD API 端點（`/decks/{deckId}/cards`）
- 在 `openapi/api.yaml` 新增卡片相關 API 契約

### 前端
- 升級牌組詳情頁：顯示牌組摘要與卡片列表
- 實作卡片新增/編輯頁面：支援多筆詞義區塊
- 實作卡片刪除功能與確認對話框
- 實作空狀態引導

## Impact

- 新增 capability：`card-management`
- 關聯 capability：`deck-management`（牌組詳情頁擴充）
- 主要受影響程式碼：
  - `apps/api/src/modules/card/`（新增）
  - `apps/api/prisma/schema.prisma`（Card/CardMeaning 模型）
  - `openapi/api.yaml`（卡片 API 契約）
  - `apps/web/src/app/pages/deck-detail/`（卡片列表顯示）
  - `apps/web/src/app/pages/card-editor/`（升級為完整表單）
  - `apps/web/src/app/components/card/`（新增 store/form）
