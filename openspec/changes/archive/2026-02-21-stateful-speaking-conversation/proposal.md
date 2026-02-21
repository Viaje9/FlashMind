## Why

目前 speaking 每回合都重送整段 `history`（含使用者語音 base64），對話越長請求越大，正式環境會在代理層或上傳限制下出現送出失敗。為了穩定口說流程並降低網路負擔，需要改為後端持有會話狀態，前端僅送當回合音檔。

## What Changes

- 新增 stateful speaking 會話能力：前端送 `audioFile + conversationId`，後端負責持有與更新上下文。
- **BREAKING** 調整 speaking audio chat API 契約：移除 `history` 上傳欄位，改為僅接受 `audioFile` 與 `conversationId`（首回合可省略 `conversationId`）。
- 新增後端會話上下文儲存與過期清理策略，避免無限累積。
- 調整前端 speaking store 請求策略，不再上傳整段歷史語音 base64。
- 強化錯誤分類與可觀測性（會話不存在、會話過期、payload 過大等）。

## Capabilities

### New Capabilities

- `speaking-conversation-session`: 定義 speaking 語音對話的會話生命週期、stateful API 契約、上下文儲存與容錯行為。

### Modified Capabilities

- 無

## Impact

- Affected code:
  - `apps/api/src/modules/speaking/*`: controller/service/dto 與測試
  - `apps/web/src/app/components/speaking/*`: store/domain/repository 與錯誤處理
  - `openapi/api.yaml`: `POST /speaking/chat/audio` request/response schema 更新
  - `packages/api-client/src/generated/*`: 重新產生 speaking client
- Affected APIs:
  - `POST /speaking/chat/audio`（**BREAKING**：移除 `history`，成功回應新增 `conversationId`）
- Dependencies/Systems:
  - 新增後端會話上下文儲存（先以應用內 session store + TTL）
  - 不做 Prisma schema migration（本變更不新增資料表）
