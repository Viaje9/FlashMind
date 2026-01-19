# Change: 新增卡片匯入功能

## Why

目前系統僅支援逐張新增卡片，當使用者擁有大量卡片資料（例如從其他學習工具匯出、或預先準備好的學習素材）時，需要一張一張手動輸入，效率低落。新增批次匯入功能可大幅提升使用者建立學習內容的效率。

## What Changes

- **新增 API 端點**：`POST /decks/{deckId}/cards/import` 支援批次匯入卡片
- **新增前端匯入入口**：在牌組詳情頁的 PageHeader 右側新增「匯入」按鈕
- **新增匯入頁面**：提供 JSON 格式上傳/貼上介面，並顯示匯入預覽與結果
- **定義匯入 JSON 格式**：支援批次卡片資料結構

## Impact

- Affected specs: `card-management`
- Affected code:
  - `openapi/api.yaml`（新增 API 端點與 schema）
  - `apps/api/src/cards/`（後端 Controller 與 Service）
  - `apps/web/src/app/pages/deck-detail/`（新增匯入按鈕）
  - `apps/web/src/app/pages/`（新增匯入頁面）
  - `apps/web/src/app/app.routes.ts`（新增路由）
