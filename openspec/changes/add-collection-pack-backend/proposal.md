## Why

收藏包目前只有前端 mock UI，使用者可以看見句子、搭配詞、片語與子句的互動雛形，但無法保存真實資料、查詢既有收藏，或讓 AI 根據使用者既有單字卡產生有連結的收藏建議。

這次變更要把收藏包從 prototype UI 推進到可用產品能力：後端提供持久化、關聯資料、聊天 session 與 Codex SDK agent，前端則改為串接正式 API。

## What Changes

- 新增收藏包資料模型，保存句子、搭配詞、片語、子句與它們之間的語意關聯。
- 新增收藏項目與既有單字卡的關聯，支援「從已學單字延伸語塊」。
- 新增收藏包 API，支援列表、分類、搜尋、刪除與加入收藏。
- 新增收藏包聊天 session API，保存多輪訊息與 Codex provider thread id。
- 新增 Codex SDK agent layer，透過自訂 tools 查詢使用者單字卡與既有收藏，回傳翻譯、修正、解釋、搜尋結果或可收藏候選。
- 調整收藏包前端，從 mock state 改為使用 generated API client 串接後端。
- 不新增 FSRS 排程、不自動建立單字卡、不實作雲端 OpenAI fallback；本次 Codex SDK 以本機 OAuth 為主要目標。

## Capabilities

### New Capabilities

- `collection-pack-backend`: 收藏包後端持久化、API、聊天 session、Codex SDK agent 與候選收藏保存。

### Modified Capabilities

- `collection-pack-ui`: 收藏包 UI 從純 mock data 改為串接收藏包後端 API，並保留前端處理語塊高亮。

## Impact

- 影響 `apps/api`：新增 collection module、Prisma models、Codex SDK provider、service/controller/dto/tests。
- 影響 `openapi/api.yaml` 與 `packages/api-client`：新增收藏包 API 契約與 generated client 方法。
- 影響 `apps/web`：收藏包 store/page 從 mock data 改為呼叫 API，並處理 loading、empty、error 與加入收藏狀態。
- 影響 `apps/api/package.json` / lockfile：新增 Codex SDK dependency（以實際套件名稱與版本為準）。
- 影響 Prisma migration：新增收藏包與聊天 session 相關資料表。
