# Change: 新增卡片管理功能

## Why

FlashMind 目前僅有 UI 雛形，缺乏卡片 CRUD 功能的實際後端與前端整合。使用者需要能夠在牌組內新增、檢視、編輯、刪除快閃卡才能進行學習。這是 P0 核心功能，直接影響使用者能否開始使用應用程式。

## What Changes

### 後端（apps/api）
- 新增 `Deck` 和 `Card` Prisma 模型
- 新增 `CardModule` 包含 CRUD API
- API 端點：
  - `POST /decks/:deckId/cards` - 新增卡片
  - `GET /decks/:deckId/cards` - 取得牌組卡片列表
  - `GET /cards/:id` - 取得單一卡片
  - `PATCH /cards/:id` - 編輯卡片
  - `DELETE /cards/:id` - 刪除卡片
  - `GET /decks/:id` - 取得牌組詳情（含統計）

### 前端（apps/web）
- 實作 `DeckDetailComponent` 的資料綁定（卡片列表、牌組統計）
- 實作 `CardEditorComponent` 的表單驗證與 API 整合
- 新增卡片列表搜尋功能
- 新增刪除卡片確認對話框
- 空狀態顯示引導

### API 契約（openapi/）
- 新增卡片相關 API 規格
- 定義 `Card`、`Deck`、`Meaning` schema

### E2E 測試（e2e/）
- 新增 `card/` 測試目錄

## Impact

- Affected specs: 新增 `card-management` capability
- Affected code:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/modules/card/**`
  - `apps/api/src/modules/deck/**`
  - `apps/web/src/app/pages/deck-detail/**`
  - `apps/web/src/app/pages/card-editor/**`
  - `openapi/api.yaml`
  - `e2e/tests/card/**`
