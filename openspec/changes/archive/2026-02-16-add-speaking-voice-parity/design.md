## Context

現有系統已具備：

- `ai` 模組（卡片內容生成）
- `tts` 模組（文字語音播放）
- `speaking` 文字骨架（`POST /speaking/chat`）

本次設計以 `speaking` namespace 擴充語音與口說能力，避免與卡片生成語義混雜，並沿用 ADR-016 包裝格式與錯誤規範。

## Goals / Non-Goals

**Goals**

- 提供純麥克風口說主流程（不以文字輸入為主流程）
- 新增 `/speaking/chat/audio` 與相關 speaking 端點
- 完整遷移摘要、翻譯、AI 助手、voice preview
- IndexedDB 音訊與訊息拆儲，提供容量上限淘汰策略
- 維持 canonical 設定路徑 `/settings/speaking`

**Non-Goals**

- 後端 DB 落地 speaking conversation/message
- 語音串流協定與即時 partial transcript
- `/speaking/settings` 路由

## Decisions

1. **API 邊界採用 `/speaking/*`**

- Decision: speaking 對話、摘要、翻譯、助手、preview 全放在 speaking namespace。
- Rationale: 保持語義邊界清楚，降低與 `ai-generation` 混淆。

2. **端點策略：保留文字 + 新增語音主端點**

- Decision: 保留 `POST /speaking/chat`，新增 `POST /speaking/chat/audio`。
- Rationale: 兼容既有骨架與 fallback，同時讓主流程可用語音上傳。

3. **Prompt 策略：A2 英語夥伴 + 可覆蓋 `systemPrompt`**

- Decision: 後端內建預設 prompt，前端可透過 settings 傳入 `systemPrompt`。
- Rationale: 保留 SpeakUpEnglish 教學語氣並保有產品調校彈性。

4. **模型與聲音可配置**

- Decision:
  - `OPENAI_SPEAKING_AUDIO_MODEL`（預設 `gpt-4o-mini-audio-preview`）
  - `OPENAI_SPEAKING_TEXT_MODEL`（預設 `gpt-4o-mini`）
  - `OPENAI_SPEAKING_DEFAULT_VOICE`（預設 `nova`）
  - `OPENAI_SPEAKING_MODEL` 保留相容文字端點
- Rationale: 成本/品質可運維調整。

5. **安全控制沿用 `AuthGuard + WhitelistGuard`**

- Decision: 全 speaking 端點沿用現有 guard。
- Rationale: 持續灰度策略與權限一致性。

6. **前端儲存採 IndexedDB 三層結構**

- Decision: `conversations` + `messages` + `audio` 三個 store。
- Rationale: 避免重複儲存音訊，提升歷史載入與刪除效率。

7. **路由策略固定**

- Decision: `/speaking`、`/speaking/history`、`/settings/speaking`。
- Rationale: 設定入口統一，不新增 `/speaking/settings`。

## API Contract Draft

### `POST /speaking/chat/audio`

- Request: `multipart/form-data`
  - `audioFile` (binary, required)
  - `history` (json string)
  - `voice` (enum)
  - `systemPrompt` (optional)
  - `memory` (optional)
  - `autoMemoryEnabled` (optional boolean string)
- Response: `{ data: { transcript, audioBase64, model, usage, memoryUpdate? } }`

### Usage 擴充欄位

- `promptTokens`
- `completionTokens`
- `totalTokens`
- `promptTextTokens`
- `promptAudioTokens`
- `completionTextTokens`
- `completionAudioTokens`

## Data Flow

1. `/speaking` 錄音完成（MediaRecorder）
2. 前端轉 WAV 並組 `multipart/form-data`
3. API client 呼叫 `POST /speaking/chat/audio`
4. Nest speaking service 呼叫 OpenAI chat completions（text + audio modalities）
5. 回傳 transcript + audio base64 + usage + memoryUpdate
6. 前端分別存 `messages` 與 `audio`，更新 conversation metadata

## Risks / Trade-offs

- 模型成本偏高：以環境變數切換模型，並保留文字 fallback。
- 純麥克風在權限受限裝置不可用：前端以阻擋提示明確引導（HTTPS/權限）。
- IndexedDB 音訊膨脹：採 200MB 上限，超限淘汰最舊會話。
- 網路不穩導致語音請求失敗：保留最近錄音作為 retry payload。

## Rollout

1. 先維持白名單灰度開放。
2. 監看語音請求成功率、平均延遲、用量成本。
3. 穩定後再評估全量開放與後端歷史同步。
