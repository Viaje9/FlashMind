# Change: 新增牌組管理功能

## Why

FlashMind 目前前端牌組列表和新增牌組頁面已有 UI 雛形，但使用硬編碼資料且缺乏後端 API。使用者需要能夠建立、檢視、編輯、刪除牌組，這是開始學習的前提條件。牌組管理是 P0 核心功能，直接影響使用者能否使用應用程式。

## What Changes

### 後端（apps/api）

- 新增 `Deck` Prisma 模型（若尚未存在）
- 新增 `DeckModule` 包含 CRUD API
- API 端點：
  - `GET /decks` - 取得使用者牌組列表
  - `POST /decks` - 建立新牌組
  - `GET /decks/:id` - 取得牌組詳情
  - `PATCH /decks/:id` - 編輯牌組設定
  - `DELETE /decks/:id` - 刪除牌組

### 前端（apps/web）

- 實作 `DeckListComponent` 的 API 整合（取代硬編碼資料）
- 實作 `DeckCreateComponent` 的表單驗證與 API 整合
- 新增 `DeckSettingsComponent` 編輯牌組設定頁面
- 實作刪除牌組確認對話框
- 空狀態顯示引導

### API 契約（openapi/）

- 新增牌組相關 API 規格
- 定義 `Deck`、`DeckCreate`、`DeckUpdate` schema

### E2E 測試（e2e/）

- 新增 `deck/` 測試目錄

## Impact

- Affected specs: 新增 `deck-management` capability
- Affected code:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/modules/deck/**`
  - `apps/web/src/app/pages/deck-list/**`
  - `apps/web/src/app/pages/deck-create/**`
  - `apps/web/src/app/pages/deck-settings/**`（新增）
  - `openapi/api.yaml`
  - `e2e/tests/deck/**`
