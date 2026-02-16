## 1. OpenSpec / Contract

- [x] 1.1 建立 `add-speaking-voice-parity` change artifacts（proposal/design/tasks + specs）
- [x] 1.2 更新 `openapi/api.yaml` speaking 端點與 schemas（含 multipart `/speaking/chat/audio`）
- [x] 1.3 重新產生 `packages/api-client/src/generated`（含 speaking 新 methods/models）

## 2. API（Nest）

- [x] 2.1 擴充 `apps/api/src/modules/speaking`（controller/service/dto）
- [x] 2.2 新增 `POST /speaking/chat/audio`（FileInterceptor、8MB 限制）
- [x] 2.3 新增 `POST /speaking/summarize`
- [x] 2.4 新增 `POST /speaking/translate`
- [x] 2.5 新增 `POST /speaking/assistant/chat`
- [x] 2.6 新增 `POST /speaking/voice-preview`
- [x] 2.7 保持 `AuthGuard + WhitelistGuard` 與 ADR-016 錯誤格式
- [x] 2.8 新增環境變數 `OPENAI_SPEAKING_AUDIO_MODEL`、`OPENAI_SPEAKING_TEXT_MODEL`、`OPENAI_SPEAKING_DEFAULT_VOICE`

## 3. Web（Angular）

- [x] 3.1 `/speaking` 改為純麥克風模式（start/pause/resume/stop/cancel/send/retry）
- [x] 3.2 新增 speaking recorder state machine（MediaRecorder）
- [x] 3.3 speaking store 串接 audio chat + summarize + translate + assistant + preview settings
- [x] 3.4 speaking repository 升級為 conversations/messages/audio 三層 store
- [x] 3.5 IndexedDB 音訊容量上限策略（200MB，淘汰最舊會話）
- [x] 3.6 `/speaking/history` 支援列出、載入、刪除、摘要複製
- [x] 3.7 `/settings/speaking` 擴充 voice/systemPrompt/memory/autoMemoryEnabled 並共用同一份 repository
- [x] 3.8 維持 `/settings/speaking` canonical，不新增 `/speaking/settings`

## 4. Test / Validation

- [x] 4.1 更新 `speaking.domain.spec.ts`
- [x] 4.2 驗證 speaking backend tests（`pnpm --filter ./apps/api test -- speaking`）
- [x] 4.3 驗證 api 全量測試（`pnpm --filter ./apps/api test`）
- [x] 4.4 驗證 web build（`pnpm --filter ./apps/web build`）
