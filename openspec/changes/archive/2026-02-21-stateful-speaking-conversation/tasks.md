## 1. API 契約與型別

- [x] 1.1 更新 `openapi/api.yaml`：`POST /speaking/chat/audio` request 移除 `history`，新增 `conversationId`；response 新增 `conversationId`
- [x] 1.2 在 OpenAPI 錯誤定義加入 `SPEAKING_SESSION_EXPIRED`（409）範例與說明
- [x] 1.3 重新產生 `packages/api-client`，確認 `SpeakingAudioChatResponse` 與 `createSpeakingAudioReply` 型別同步

## 2. 後端 stateful session 實作

- [x] 2.1 在 `apps/api/src/modules/speaking` 新增 `SpeakingSessionStore` 介面與 in-memory TTL 實作
- [x] 2.2 於 speaking service 導入 `(userId, conversationId)` 會話讀寫與過期檢查
- [x] 2.3 將每回合上下文寫入 session，加入 `maxHistoryItems` 與 `maxSerializedBytes` 裁切策略
- [x] 2.4 在 `createSpeakingAudioReply` 成功回應中補上 `conversationId`
- [x] 2.5 當請求包含 `history` 欄位時回傳 `400` + `VALIDATION_ERROR`
- [x] 2.6 對不存在/過期會話回傳 `409` + `SPEAKING_SESSION_EXPIRED`

## 3. 前端 speaking 流程切換

- [x] 3.1 調整 `speaking.store` 送出流程：主流程只送 `audioBlob + conversationId`
- [x] 3.2 成功回應後保存/更新 `conversationId`，後續回合沿用
- [x] 3.3 遇到 `SPEAKING_SESSION_EXPIRED` 時自動引導重啟新會話並保留重試能力
- [x] 3.4 移除主流程對 `toSpeakingHistory` 的依賴與 base64 序列化上傳

## 4. 測試與驗證

- [x] 4.1 新增/更新後端單元測試：新會話建立、續聊、過期、跨使用者隔離、`history` 被拒絕
- [x] 4.2 新增/更新前端測試：conversationId 保存與續用、session 過期恢復流程
- [x] 4.3 執行 `apps/api` 與 `apps/web` build/test，確認無回歸

## 5. 上線與觀測

- [x] 5.1 以前後端同版次方式部署，避免契約不一致
- [x] 5.2 觀測 `/speaking/chat/audio` 的 4xx/5xx 與 request size，確認 `status 0` 明顯下降
- [x] 5.3 確認線上請求已不再包含 `history` 欄位
