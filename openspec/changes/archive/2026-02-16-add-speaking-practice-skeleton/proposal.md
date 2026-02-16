## Why

FlashMind 目前以單字牌組為主，缺少可直接練習口說的入口與對話流程。為了在不破壞既有架構的前提下快速驗證產品方向，需要先以低風險骨架把 SpeakUpEnglish 的核心能力遷入。

## What Changes

- 新增口說練習骨架能力，提供 `/speaking` 與 `/speaking/history` 前端流程。
- 新增後端 `POST /speaking/chat` API（文字版 payload，真實 OpenAI 呼叫）。
- 新增 OpenAPI Speaking 契約與對應 API Client。
- 調整 Home 與 Settings 導航，將口說入口導向 `speaking` 流程。
- 口說歷史先由前端 IndexedDB 管理，不新增 Prisma schema。

## Capabilities

### New Capabilities

- `speaking-practice`: 口說練習入口、對話流程、歷史與設定路徑規範。

### Modified Capabilities

- `ai-generation`: 新增口說對話情境，明確區分卡片生成與 speaking chat 的用途。
- `audio-playback`: 補充口說頁可重用既有音訊播放互動模式的銜接規範。

## Impact

- Affected code:
  - `apps/api`: 新增 `speaking` module、DTO、service/controller 與測試。
  - `apps/web`: 新增 speaking pages、domain/store/repository、路由與首頁入口。
  - `openapi/api.yaml`: 新增 Speaking 路徑與 schema。
  - `packages/api-client`: 重新產生 generated client。
- Affected APIs:
  - 新增 `POST /speaking/chat`。
- Dependencies/Config:
  - 新增 `OPENAI_SPEAKING_MODEL`（預設 `gpt-4o-mini`）。
- 本階段不做 DB migration，不落後端 conversation 資料。
