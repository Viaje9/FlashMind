## Context

FlashMind 已有 Speaking 的即時 AI 對話與收藏包的伺服器端聊天紀錄，但沒有以文字為主、會保存文法修正並管理不重複主題的獨立學習模式。此功能橫跨 OpenAPI、Prisma、NestJS、generated client 與 Angular，因此需要先固定資料邊界與 AI 輸出格式。

## Goals / Non-Goals

**Goals:**

- 建立可獨立進入的主題文字對話模式。
- 由 AI 產生新主題與開場訊息，並盡量避開使用者過去的主題。
- 每輪同時保存使用者原句、結構化修正結果及 AI 的自然回覆。
- 支援查閱、繼續及以相同主題建立新場次。
- 提示只在使用者主動要求時產生。

**Non-Goals:**

- 不做語音錄製、TTS、FSRS 排程或自動新增單字卡。
- 不使用 embeddings、向量資料庫或人工維護的大型主題題庫。
- 不評分使用者、不設計關卡、完成條件或連續學習獎勵。
- 不在第一版提供主題分類、難度設定或自訂主題。

## Decisions

### 將主題與對話場次分開保存

使用 `TopicConversationTopic` 保存使用者擁有的主題，使用 `TopicConversationSession` 保存每一次練習，再以 `TopicConversationMessage` 保存訊息。重新練習時只建立新 session，因此同一主題可以有多份互不覆蓋的歷史。

替代方案是把主題欄位直接複製到每一個 session；檔案較少但難以表達「同一主題再練一次」，也不利於主題層級去重，因此不採用。

### 使用提示詞加資料庫唯一鍵完成第一版去重

建立新主題前，service 讀取既有主題的標題與情境交給 AI 排除；AI 回傳後，後端將標題正規化，並用 `(userId, normalizedTitle)` 唯一鍵防止完全重複。若衝突則重新產生，最多嘗試三次。

替代方案是用 embedding 做語意距離判斷。此方案需要額外呼叫、索引及閾值調校；需求是「盡量不重複」而非嚴格保證，第一版不值得增加此複雜度。

### AI 回傳結構化結果，聊天與修正分開呈現

AI provider 提供三個操作：建立主題、延續對話、產生提示。延續對話固定回傳 `reply` 與 `correction`；修正包含狀態、建議句及繁體中文說明。AI 回覆內容只延續角色對話，不混入教學講義。

使用者訊息先保存，再呼叫 AI；成功後以 transaction 保存修正 metadata、assistant 訊息及 session 更新時間。若 AI 失敗，原句仍保留，使用者可再次送出，不會遺失輸入。

### 第一版固定使用 CEFR B1

主題開場、正常回覆、修正建議與提示都在 system instructions 中指定 CEFR B1，使用常見日常詞彙與清楚句型，同時要求保持自然。第一版不增加使用者 Level 欄位或設定頁；等需要支援多程度時再把 Level 納入 session 與 API 契約。

### 使用伺服器資料庫作為歷史來源

主題、場次、訊息與修正全部保存於 PostgreSQL，並由登入使用者 ID 隔離。這與收藏包伺服器端 session 模式一致，也能跨裝置查閱；不沿用 Speaking 的 IndexedDB 歷史。

### 保持 contract-first 與薄前端 store

所有 endpoint 先定義於 `openapi/api.yaml`，再產生 Angular client。前端 `topic-conversation.domain.ts` 僅放純 mapping／顯示規則並以單元測試保護；store 負責 API 與 signal state，page 負責路由與元件組合。

### 使用 SSE 與 optimistic message 改善手機等待體驗

主題對話新增 `messages/stream` SSE endpoint。後端仍以同一份結構化輸出保存 AI 回覆與文法修正，但會在解析 `reply` 欄位時先傳送 `assistant_delta`；完成後再傳送含正式訊息 ID 與修正的 `result`。

前端送出時立即清空 composer，先加入暫存的 user 與 assistant 訊息，收到 delta 時只更新暫存 assistant 內容，收到 result 後再以伺服器資料取代。訊息列表底部使用固定 clearance，包含 composer 高度、safe area 與額外 24px 留白，避免最新回覆剛好貼齊或被固定輸入區遮住。

## Risks / Trade-offs

- [AI 仍可能產生語意相近但名稱不同的主題] → 在 prompt 提供既有標題與情境，保留資料庫精確去重；有實際重複率證據後再考慮 embedding。
- [歷史主題持續增加會讓 prompt 變長] → 第一版只送最近 100 個主題；資料量成長後可改成分類摘要。
- [AI JSON 格式或服務失敗] → 使用 structured output schema、timeout 與一致的服務錯誤；不把未驗證輸出寫入資料庫。
- [同時建立新主題造成競態] → 唯一鍵攔截，service 重試產生。
- [文法正確仍被過度改寫] → correction schema 明確區分 `correct`、`improved`、`corrected`，UI 對 `correct` 不顯示不必要改寫。

## Migration Plan

1. 套用 Prisma migration，新增三個資料表與角色 enum。
2. 部署包含新 module 與 endpoints 的 API。
3. 重新產生並部署 API client 與 Angular 頁面。
4. 此為純新增功能，回滾時可先移除入口與 module；資料表可保留，避免遺失歷史。

## Open Questions

- 正式顯示名稱先採「主題對話」，後續可依實際使用回饋調整，不影響資料模型或 API。
