## Context

收藏包 UI 已有正式頁面與 mock 互動，但目前沒有後端資料模型、API、AI agent 或真實保存流程。現有系統以 NestJS、Prisma、OpenAPI contract-first 與 generated API client 為主要架構；使用者已經有 `Deck`、`Card`、`CardMeaning`，收藏包需要能從這些既有單字卡延伸出句子與語塊。

AI 部分預計採用 Codex SDK 與本機 OAuth。這代表後端要把 Codex 視為 agent provider，而不是讓前端直接呼叫模型；同時必須保留明確邊界：Codex 可查資料與產生候選，但不能直接寫入正式收藏資料。

## Goals / Non-Goals

**Goals:**

- 建立收藏包正式資料模型，保存句子、搭配詞、片語、子句與它們的語意關聯。
- 建立收藏項目與既有單字卡的連結，支援從已學單字延伸語塊。
- 建立收藏包 API，支援列表、分類、搜尋、刪除與加入收藏。
- 建立聊天 session 與 message persistence，保存 Codex provider thread id，支援多輪對話與 thread resume。
- 使用 Codex SDK agent 透過自訂 tools 查詢使用者單字卡與既有收藏，回傳翻譯、修正、解釋、搜尋結果或可收藏候選。
- 讓前端收藏包列表與新增收藏聊天頁串接 generated API client。

**Non-Goals:**

- 不把收藏項目納入 FSRS 排程或每日學習卡片。
- 不自動建立新的單字卡；AI 只回傳 suggested cards，後續可另做一鍵加入卡片。
- 不實作雲端 OpenAI fallback；本次以 Codex SDK 本機 OAuth 為主要目標。
- 不保存句子高亮位置；高亮由前端依文字比對處理。
- 不讓 AI 自動寫入正式收藏；使用者按加號後才由後端 service 寫入。

## Decisions

1. **以 `CollectionItem` 單表承載四種收藏內容**

- Decision: 使用 `CollectionItem.kind` 區分 `SENTENCE`、`COLLOCATION`、`PHRASE`、`CLAUSE`。
- Why: 四種內容共用欄位高度一致，單表能讓搜尋、去重、列表分頁與關聯建模更簡單。
- Alternative: 四張主表分開存；缺點是 relations、搜尋與候選保存會變成多套邏輯。

2. **以 relation graph 表示句子與語塊關聯**

- Decision: 使用 `CollectionItemRelation(parentId, childId, type, sortOrder)` 表示句子包含語塊、片語/子句包含搭配詞等語意關係。
- Why: 收藏包的核心是可重用表達之間的關聯，而不是固定層級樹；graph relation 能支援一句話多個搭配詞、同一搭配詞出現在多個句子。
- Alternative: 在 `CollectionItem` 直接存 JSON breakdown；缺點是難搜尋、難重用、難避免重複。

3. **高亮位置不寫入資料庫**

- Decision: 後端只保存語意關聯，不保存 `startChar`、`endChar` 或 `surfaceText`。
- Why: 高亮是 UI 呈現細節，前端可用 parent text + child text 做 fallback；資料庫保存字元位置會讓資料受顯示策略綁定。
- Alternative: 存位置可處理同一片段多次出現；但 v1 尚未需要，未來可加欄位或專用 annotation 表。

4. **收藏項目透過 join table 連到既有卡片**

- Decision: 使用 `CollectionItemCard(collectionItemId, cardId, role)` 表示來源單字、內含單字或 AI 建議來源。
- Why: 使用者已學單字是收藏包建議的重要上下文，但收藏項目本身不應綁死在單一 deck 或單一 card。
- Alternative: 只存 source word 字串；缺點是無法準確回到使用者卡片與複習狀態。

5. **聊天 session 保存 provider thread id 與 messages**

- Decision: 新增 `CollectionChatSession` 與 `CollectionChatMessage`，保存 `providerThreadId`、使用者訊息與 AI 回覆 metadata。
- Why: Codex SDK 多輪對話需要 resume thread；固定 system prompt + tools 查動態資料有助於 cache 與上下文穩定。
- Alternative: 每次 chat 都 stateless；缺點是多輪追問與 cache 命中都較差。

6. **Codex SDK 使用單次 run + native tools + output schema**

- Decision: 每次使用者 message 只做一次主要 `thread.run`，讓 Codex 在同一輪內呼叫 tools 並輸出結構化結果。
- Why: 避免 planning run + final run 造成兩次模型呼叫、重複 token 與較差 cache 命中。
- Alternative: 手動 tool loop 兩段式 prompt；較容易實作但效率與 cache 較差，只作為 SDK tool callback 不可用時的 fallback。

7. **按加號才正式入庫**

- Decision: Chat endpoint 回傳候選，`POST /collections` 才 upsert 收藏項目、relations 與 card links。
- Why: AI 產生的是建議，不應在使用者未確認前污染正式收藏包。
- Alternative: AI 回覆時先寫 draft 表；可追蹤候選但增加狀態管理，v1 先不做。

## Risks / Trade-offs

- [Codex SDK API 與筆記中的介面可能不同] → 將 SDK 包在 provider adapter，service 層依賴 `CollectionAiProvider` 介面；若 tool callback 名稱不同，只改 adapter。
- [本機 OAuth 不適合雲端部署] → v1 明確定位本機優先，OAuth 失效回可操作錯誤；provider 介面保留未來 OpenAI API fallback 空間。
- [AI 候選分類或關聯錯誤] → 後端 normalize、enum validate、去重；正式寫入只在使用者按加號後發生。
- [關聯 graph 查詢可能變複雜] → v1 限定 relation type 與查詢深度，只回 UI 需要的一層關聯。
- [前端從 mock 改 API 後 UX 變慢] → 列表與聊天頁加入 loading、empty、error 狀態；已存在候選由後端標記，避免前端猜測。

## Migration Plan

1. 新增 OpenAPI 契約與 generated API client。
2. 新增 Prisma models 與 migration，並補上 `User`、`Card` relations。
3. 實作 NestJS collection module、service、controller、DTO 與 tests。
4. 實作 Codex SDK provider 與 collection tools，測試以 provider mock 為主。
5. 調整前端 collection store/page 串接 API，移除 mock 寫入路徑。
6. 執行 Prisma generate、API client generate、後端測試、前端測試與 build。

Rollback:

- 若後端 migration 已套用但功能需回退，保留資料表不使用，前端可暫時回到 mock 或隱藏入口。
- 若 Codex SDK 不可用，chat endpoint 回服務錯誤，但收藏列表與手動保存 API 仍可運作。

## Open Questions

- Codex SDK 實際套件名稱、版本與 tool callback API 需在 implementation 時以本機安裝結果確認。
