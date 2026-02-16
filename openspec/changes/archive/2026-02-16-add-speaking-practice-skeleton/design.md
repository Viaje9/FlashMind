## Context

目前系統已具備 `ai`（卡片內容生成）與 `tts`（語音播放）能力，但尚未有「口說練習」的獨立流程。這次變更要在既有 Angular + Nest + OpenAPI 架構中新增 speaking 骨架，並維持 ADR-016 的 API 包裝與錯誤格式一致性。

## Goals / Non-Goals

**Goals:**

- 建立 `speaking` 命名空間，新增 `POST /speaking/chat` 契約與實作。
- 提供 `/speaking`、`/speaking/history` 前端骨架，接通後端聊天流程。
- 對話歷史先存前端 IndexedDB，避免首版引入 DB migration。
- 保持 canonical 設定路徑為 `/settings/speaking`。

**Non-Goals:**

- 音訊上傳對話（`audioBase64`）與語音回傳。
- summarize / translate / voice preview / ai-chat 等進階端點。
- 後端 conversation/message 永久保存。
- 串流回覆（SSE/WebSocket）。

## Decisions

1. **API 邊界使用 `/speaking/*`**

- Decision: 口說功能獨立於既有 `/ai`、`/tts`。
- Rationale: 語義清楚，後續擴充（摘要、翻譯）不污染既有能力。
- Alternative: 重用 `/ai`；缺點是責任邊界混雜。

2. **首版僅提供 `POST /speaking/chat`**

- Decision: 先打通最短主路徑。
- Rationale: 先驗證互動價值與整體流程，再擴充附加端點。
- Alternative: 一次補齊 SpeakUp 全端點；風險與改動面過大。

3. **Prompt 沿用 SpeakUp A2 口說夥伴風格，允許前端傳入 `systemPrompt`**

- Decision: service 內建預設 prompt，request 可覆蓋。
- Rationale: 保留產品差異化，且可從設定頁調整。
- Alternative: 固定 prompt；彈性不足。

4. **模型可配置**

- Decision: 使用 `OPENAI_SPEAKING_MODEL`，預設 `gpt-4o-mini`。
- Rationale: 平衡成本與品質，並可用環境變數逐步調整。
- Alternative: 寫死模型；運維彈性不足。

5. **安全沿用 `AuthGuard + WhitelistGuard`**

- Decision: speaking API 與現有 AI/TTS 保持一致。
- Rationale: 首版風險控管與灰度策略一致。
- Alternative: 僅登入可用；失去白名單保護。

6. **前端歷史先存 IndexedDB**

- Decision: `speaking.repository` 使用 IndexedDB 保存 conversation/messages。
- Rationale: 不改 Prisma schema，降低首版耦合。
- Alternative: 直接落後端 DB；需要更多 schema/API 設計。

7. **路由與入口**

- Decision: 新增 `/speaking`、`/speaking/history`；`/settings/speaking` 作為設定入口；不新增 `/speaking/settings`。
- Rationale: 符合既有設定頁資訊架構與你指定的 canonical 路徑。

## API Contract Draft

- `SpeakingChatRequest`
  - `message: string`
  - `history?: SpeakingChatMessage[]`
  - `systemPrompt?: string`
- `SpeakingChatMessage`
  - `role: user | assistant`
  - `content: string`
- `SpeakingChatResponse.data`
  - `reply: string`
  - `model: string`
  - `usage: { promptTokens, completionTokens, totalTokens }`

## Data Flow

`/speaking` page -> `SpeakingStore.sendMessage()` -> API client `createSpeakingReply()` -> Nest `SpeakingController` -> `SpeakingService` -> OpenAI Chat Completions -> response -> store 更新訊息與 IndexedDB 歷史。

## Risks / Trade-offs

- [模型成本可能超預期] → 以環境變數控制模型並保留降級空間。
- [白名單可能限制測試覆蓋] → 開發環境可透過環境變數關閉白名單。
- [IndexedDB 非跨裝置同步] → 明確標註為首版限制，下一階段再設計後端同步。
- [未做音訊上傳導致體驗與 SpeakUp 有落差] → 先保留錄音 UI 狀態機，後續可平滑升級。

## Migration Plan

1. 擴充 OpenAPI `speaking` 端點與 schema。
2. 重新產生 `@flashmind/api-client`。
3. 新增 `apps/api` speaking module 並串接 OpenAI。
4. 新增 `apps/web` speaking route/pages/store/repository。
5. 調整 Home 與 Settings 導航到 speaking。
6. 補齊單元測試，執行 build/test 驗證。

## Open Questions

- 無。本次骨架範圍與路由策略已定案。
