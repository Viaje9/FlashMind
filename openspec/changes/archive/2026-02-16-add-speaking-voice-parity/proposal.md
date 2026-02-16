## Why

`speaking-practice-skeleton` 先前刻意只做文字骨架，因此 `/speaking` 仍非完整語音工作流。這與 SpeakUpEnglish 的核心使用方式（錄音上傳、語音回覆、摘要/翻譯/助手）有落差。

本次 change 目標是補齊語音 parity：將口說主流程改為純麥克風模式，並把 SpeakUpEnglish 的核心能力完整遷移到 FlashMind。

## What Changes

- ADDED: `speaking-practice` capability（純麥克風模式、語音端點、歷史治理、設定能力）
- MODIFIED: `ai-generation` capability（補 speaking 對話/摘要/翻譯/助手情境，不影響卡片生成）
- MODIFIED: `audio-playback` capability（speaking 重用播放互動，不新增 `/tts/*` 契約）
- MODIFIED: web routing/home/settings 導航（維持 `/settings/speaking` canonical）

## Impact

- Affected code
  - `apps/api`: 擴充 speaking controller/service/dto 與測試
  - `apps/web`: speaking recorder/store/repository/pages/settings/history
  - `openapi/api.yaml`: speaking 新增語音與延伸端點契約
  - `packages/api-client`: 重新生成 speaking methods/models
- Affected APIs
  - 新增 `POST /speaking/chat/audio`
  - 新增 `POST /speaking/summarize`
  - 新增 `POST /speaking/translate`
  - 新增 `POST /speaking/assistant/chat`
  - 新增 `POST /speaking/voice-preview`
  - 保留 `POST /speaking/chat`（相容 fallback）
- Config
  - 新增 `OPENAI_SPEAKING_AUDIO_MODEL`
  - 新增 `OPENAI_SPEAKING_TEXT_MODEL`
  - 新增 `OPENAI_SPEAKING_DEFAULT_VOICE`
  - 保留 `OPENAI_SPEAKING_MODEL`
- DB
  - 本階段仍不做 Prisma schema migration；對話資料維持前端 IndexedDB

## Out of Scope

- 音訊串流回覆（SSE/WebSocket）
- 後端 conversation/message 永久儲存
- 使用者自填 OpenAI API key
