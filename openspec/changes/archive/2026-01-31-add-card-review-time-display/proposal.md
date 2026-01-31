## Why

使用者在牌組詳情頁瀏覽卡片清單時，無法得知每張卡片的學習狀態和下次複習時間，需要逐一點進學習模式才能了解排程。這使得使用者難以掌握學習進度，也無法快速判斷哪些卡片需要優先複習。

## What Changes

- 卡片列表 API（`GET /api/decks/:deckId/cards`）回傳新增 `state`（卡片學習狀態）和 `due`（下次複習時間）欄位
- OpenAPI spec `CardListItem` schema 新增 `state` 和 `due` 欄位定義，並重新產生前端 API client
- 前端 `card-list-item` 元件在描述文字下方，以行內式（版本 B）顯示複習時間資訊：
  - 新卡片（藍色）：「新卡片・尚未學習」
  - 即將到期（綠色）：「X 小時後到期」
  - 已逾期（紅色）：「已逾期 X 天」
  - 未來複習（灰色）：「X 天後」
- 牌組詳情頁將 `state` 和 `due` 傳入卡片元件
- **修正牌組統計 bug**：`deck.service.ts` 中 `newCount`、`reviewCount`、`totalCount` 原本硬編碼為 0，改為實際查詢資料庫

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `card-management`：卡片列表 API 回傳新增 `state` 和 `due` 欄位，前端卡片列表項目元件新增複習時間行內顯示
- `deck-management`：牌組統計數據（newCount、reviewCount、totalCount）從硬編碼改為實際查詢資料庫計算

## Impact

- **API**：`GET /api/decks/:deckId/cards` 回傳格式新增欄位（向下相容，新增欄位不影響既有消費者）
- **OpenAPI spec**：`CardListItem` schema 變更，需重新產生 api-client
- **後端**：`card.service.ts`（卡片列表查詢）、`deck.service.ts`（牌組統計計算）
- **前端**：`card-list-item` 元件（新增 input 和 template）、`deck-detail` 頁面（傳入新屬性）
