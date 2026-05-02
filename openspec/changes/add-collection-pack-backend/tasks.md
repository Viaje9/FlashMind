## 1. Prisma Schema 與 Migration

- [x] 1.1 新增 `CollectionItemKind`、`CollectionRelationType`、`CollectionChatRole` 等 Prisma enum
- [x] 1.2 新增 `CollectionItem`、`CollectionItemRelation`、`CollectionItemCard` models
- [x] 1.3 新增 `CollectionChatSession`、`CollectionChatMessage` models
- [x] 1.4 補上 `User` 與 `Card` 到收藏包 models 的 relation 欄位
- [x] 1.5 建立 Prisma migration 並執行 `pnpm --filter ./apps/api prisma:generate`

## 2. OpenAPI Contract 與 API Client

- [x] 2.1 在 `openapi/api.yaml` 新增 `Collections` tag 與收藏包 schemas
- [x] 2.2 新增 `GET /collections`，支援 `kind`、`q`、`cursor`、`limit`
- [x] 2.3 新增 `POST /collections` 與 `DELETE /collections/{id}`
- [x] 2.4 新增 `POST /collections/chat-sessions`
- [x] 2.5 新增 `POST /collections/chat-sessions/{sessionId}/messages`
- [x] 2.6 重新產生 `packages/api-client` 並確認 operationId 符合命名規範

## 3. 後端 Collection Module

- [x] 3.1 建立 `apps/api/src/modules/collection` module、controller、service 與 dto 目錄
- [x] 3.2 實作 collection item mapper，輸出前端需要的句子、語塊、來源單字與關聯資料
- [x] 3.3 實作列表查詢，支援使用者隔離、分類、搜尋與 cursor-based pagination
- [x] 3.4 實作刪除收藏項目，並確認 relation cascade 行為正確
- [x] 3.5 將 CollectionModule 註冊到 API app module

## 4. Collection Persistence Service

- [x] 4.1 實作 `normalizedText` helper，涵蓋 trim、大小寫、空白與 apostrophe 正規化
- [x] 4.2 實作收藏候選 upsert，避免同使用者、同類型、同正規化文字重複
- [x] 4.3 實作句子候選保存時同步 upsert 關聯搭配詞、片語與子句
- [x] 4.4 實作 `CollectionItemRelation` 建立與去重
- [x] 4.5 實作 `CollectionItemCard` 建立與使用者權限檢查
- [x] 4.6 實作 suggested cards 回傳但不自動建立單字卡

## 5. Codex SDK Provider 與 Tools

- [x] 5.1 安裝並設定 Codex SDK dependency，以本機 OAuth 為主要執行方式
- [x] 5.2 建立 `CollectionAiProvider` 介面與 `CodexCollectionAiProvider` adapter
- [x] 5.3 實作收藏包 agent system instructions 與 output schema
- [x] 5.4 實作單次 `thread.run` + tools + output schema 流程，避免 planning/final 雙呼叫
- [x] 5.5 實作 provider thread 建立與 resume，並把 provider thread id 保存到 session
- [x] 5.6 實作 Codex OAuth、逾時與格式錯誤映射為既有 error wrapper

## 6. Collection Tools 與 Chat Session

- [x] 6.1 實作 `get_user_vocabulary_summary` tool
- [x] 6.2 實作 `search_user_cards` tool，查詢 `Card.front` 與 `CardMeaning.zhMeaning`
- [x] 6.3 實作 `search_collection_items` tool，查詢既有收藏並標記 existing
- [x] 6.4 實作 `check_existing_collection_items` tool 或等價後端比對流程
- [x] 6.5 實作建立聊天 session API
- [x] 6.6 實作送出聊天訊息 API，保存 user message、assistant message 與 metadata
- [x] 6.7 確認 `TRANSLATE_ONLY` 不回收藏候選、裸句子 fallback 回分析候選

## 7. 前端 API 串接

- [x] 7.1 將收藏包 store 從 mock data 改為呼叫 generated API client
- [x] 7.2 列表頁串接 `GET /collections`，處理 loading、empty、error 狀態
- [x] 7.3 新增收藏頁建立或載入 chat session
- [x] 7.4 新增收藏頁送出訊息後顯示 API 回傳的 assistant message 與候選
- [x] 7.5 建議卡片按加號呼叫 `POST /collections`，成功後更新狀態
- [x] 7.6 建議卡片移除操作呼叫 `DELETE /collections/{id}` 或還原本次加入狀態
- [x] 7.7 保留前端句子高亮 fallback，不將高亮位置依賴後端資料

## 8. Tests

- [x] 8.1 新增 collection service 單元測試，覆蓋 upsert、去重、relations 與 card links
- [x] 8.2 新增 collection tool service 單元測試，覆蓋使用者隔離與查詢條件
- [x] 8.3 新增 collection chat service 單元測試，mock Codex provider 驗證 intent 與候選行為
- [x] 8.4 新增 controller/API 測試，覆蓋列表、建立 session、送出訊息、加入收藏、刪除
- [x] 8.5 更新前端收藏包頁面與 store 測試，覆蓋 API loading、成功、錯誤與加入狀態

## 9. 驗證與收尾

- [x] 9.1 執行 `openspec validate add-collection-pack-backend --strict`
- [x] 9.2 執行 `pnpm --filter ./apps/api test`
- [x] 9.3 執行 `pnpm --filter ./apps/web exec vitest run` 相關收藏包測試
- [x] 9.4 執行 `pnpm --filter ./apps/web build`（已執行；目前仍因既有 `SIGABRT` 中止，未回傳 Angular template error）
- [x] 9.5 手動檢查 `/collections` 與 `/collections/new` 可讀取 API、聊天、加入與刪除收藏
