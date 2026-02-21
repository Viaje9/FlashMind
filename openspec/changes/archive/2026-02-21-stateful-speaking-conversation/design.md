## Context

目前 `/speaking/chat/audio` 的前端流程會在每回合把 `history` 序列化為 JSON 字串，且使用者歷史訊息常含 `audioBase64`。對話回合增加後，請求體積快速膨脹，正式環境容易碰到代理層或 multipart 欄位限制，導致前端出現 `status = 0` 的送出失敗。

專案希望改為 stateful 會話：前端只送當回合音檔，歷史上下文由後端管理，並直接切換至新契約，不保留相容過渡路徑。

## Goals / Non-Goals

**Goals:**

- 將 speaking 主流程改為「`audioFile + conversationId`」模式，不再依賴前端重送整段歷史 base64。
- 在不破壞現有 endpoint 的前提下，新增會話識別與可辨識錯誤語意（例如 session 過期）。
- 為後端會話上下文提供可控的容量上限與 TTL 清理機制。
- 明確以 breaking 方式移除 `history` 上傳，簡化流程與維護成本。

**Non-Goals:**

- 不導入串流回覆（SSE/WebSocket）。
- 不新增 Prisma schema 或永久儲存 speaking 會話。
- 不在本次切換模型供應商或改寫整個 speaking prompt 策略。

## Decisions

### Decision 1: 沿用 `POST /speaking/chat/audio`，擴充 stateful 欄位

- 決策：
  - request 新增 `conversationId`（optional）。
  - response `data` 新增 `conversationId`（required on success）。
  - request 不再接受 `history` 欄位。
- 理由：
  - 避免新增第二條 API 造成前後端分叉與客戶端重複邏輯。
  - 在已確認新用戶場景下，直接切換可降低程式複雜度與維運負擔。
- 替代方案：
  - 新增 `/speaking/chat/audio/session` 新端點：語意清楚，但遷移成本較高。
  - 保留 `history` 相容過渡：切換風險較低，但會延續雙軌邏輯與維護成本。

### Decision 2: 會話上下文採「可替換的 SessionStore 抽象 + 先用 in-memory TTL 實作」

- 決策：
  - 在 `apps/api/src/modules/speaking` 新增 `SpeakingSessionStore` 介面。
  - 第一版提供 in-memory 實作（例如 `Map` + `expiresAt`），預設 TTL 30 分鐘。
  - key 維度為 `(userId, conversationId)`，避免跨使用者污染。
- 理由：
  - 先快速解決正式環境 payload 失敗問題，保留未來替換 Redis 的路徑。
  - 不引入新基礎設施即可落地。
- 替代方案：
  - 直接上 Redis：可跨實例，但目前 infra 成本與部署複雜度較高。
  - 寫入 PostgreSQL：持久化強，但本次需求不需要永久留存且延遲/成本較高。

### Decision 3: 會話內容維持 `SpeakingChatHistoryItem` 形狀，並做雙重上限控制

- 決策：
  - session 內容儲存為 `SpeakingChatHistoryItem[]`（`user audioBase64`、`assistant text`）。
  - 每回合更新後執行裁切策略：
    - `maxHistoryItems`（例如 20）
    - `maxSerializedBytes`（例如 700KB~1MB）
  - 超限時先丟最舊回合，保留最近上下文。
- 理由：
  - 可最大化重用現有 `buildAudioMessages` 與 prompt 建構邏輯。
  - 可直接限制記憶體占用並避免再次形成超大 payload。
- 替代方案：
  - 只存文字 transcript：payload 最小，但需額外 STT 流程，超出本次範圍。

### Decision 4: 無效會話使用明確錯誤語意

- 決策：
  - `conversationId` 無效/過期：回 `409` + `SPEAKING_SESSION_EXPIRED`。
  - `conversationId` 不屬於當前使用者：回 `404` 或 `403`（以不洩漏資源為原則）。
- 理由：
  - 前端可據此清楚引導使用者「重啟新會話」，不再只顯示 generic network error。
- 替代方案：
  - 一律 500：可實作但不利前端恢復策略。

### Decision 5: 前端改為只送當回合音檔與 conversationId

- 決策：
  - `speaking.store` 不再呼叫 `toSpeakingHistory(...)` 後上傳完整 `history`。
  - 首回合不帶 `conversationId`，成功後保存 response 回傳值；後續回合沿用。
  - 收到 `SPEAKING_SESSION_EXPIRED` 時，自動提示使用者重試並建立新會話。
- 理由：
  - 徹底移除前端網路層的 base64 放大效應。
- 替代方案：
  - 只做前端裁切：可暫時緩解，但仍會隨回合擴大且治標不治本。

## Risks / Trade-offs

- [多實例部署下 in-memory session 不共享] → 先以單實例/黏著路由運行；保留 Redis 實作介面作為下一步。
- [服務重啟會導致會話遺失] → 前端針對 `SPEAKING_SESSION_EXPIRED` 提供一鍵重啟會話，並保留本機音檔可重送。
- [儲存歷史音訊仍會占用記憶體] → 設定 `maxHistoryItems` + `maxSerializedBytes` + TTL 三層防線。
- [直接 breaking 切換造成舊客戶端不可用] → 前後端同版部署，並在發版窗口內一次切換。

## Migration Plan

1. 更新 OpenAPI 與 `packages/api-client`，移除 `history` 契約並加入 `conversationId`。
2. 完成後端 stateful session 實作與 `SPEAKING_SESSION_EXPIRED` 錯誤處理。
3. 完成前端 speaking store 切換為 `audioFile + conversationId`。
4. 以同版次部署前後端，避免新舊契約混用。
5. 上線後監控 `/speaking/chat/audio` 的 4xx/5xx 與 request size 分布。

Rollback:

- 需前後端一併回滾，避免契約不一致導致 speaking 流程失效。

## Open Questions

- TTL 最佳值應為 15、30 或 60 分鐘（需依真實使用行為調整）。
- `maxHistoryItems` 與 `maxSerializedBytes` 的正式值要以線上監測資料校準。
- 是否需要在 response 增加 `sessionExpiresAt`，讓前端可預先提示過期。
- 是否在下一階段直接導入 Redis，避免多實例 session 斷裂。
