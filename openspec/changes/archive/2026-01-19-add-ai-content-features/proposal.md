# Change: 新增 AI 內容生成與語音播放功能

## Why

FlashMind 的核心差異化功能是降低建卡成本並提升學習效果。透過 AI 自動生成詞義與例句，用戶不需手動輸入所有內容；透過 TTS 語音播放，用戶可以聽到正確的發音，加強記憶效果。

## What Changes

- **ADDED** `ai-generation` capability：透過 OpenAI API 生成卡片背面內容（詞義、例句）
- **ADDED** `audio-playback` capability：透過 Azure Speech Services 播放英文文字的語音
- **MODIFIED** `card-management`：在卡片編輯器新增「AI 生成」按鈕與「語音播放」按鈕

## Impact

- Affected specs: `ai-generation` (新增), `audio-playback` (新增), `card-management` (修改)
- Affected code:
  - 後端：新增 `ai` module 與 `tts` module
  - 前端：修改 CardEditor 元件，新增 AI 與 TTS 服務
  - OpenAPI：新增 `/ai/generate-card-content` 與 `/tts/synthesize` 端點
  - 環境變數：新增 `OPENAI_API_KEY`、`AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`

## Related User Stories

| ID | 描述 |
|----|------|
| US-022 | 新增卡片（英文例句提供播放語音按鈕） |
| US-023 | AI 生成卡片內容 |
| US-033 | 卡片操作（播放正面文字的語音） |

## Architecture Overview

```
┌─────────────┐      ┌─────────────┐      ┌──────────────────────┐
│   Frontend  │ ──▶  │   Backend   │ ──▶  │  External Services   │
│  (Angular)  │      │  (NestJS)   │      │                      │
└─────────────┘      └─────────────┘      │  - OpenAI API        │
                            │              │  - Azure Speech TTS  │
                            ▼              └──────────────────────┘
                     API Keys 安全儲存
                     (環境變數)
```

## API Design

遵循 ADR-016 規範：

| 端點 | 方法 | operationId | 用途 |
|------|------|-------------|------|
| `/ai/generate-card-content` | POST | `generateCardContent` | 根據正面文字生成詞義與例句 |
| `/tts/synthesize` | POST | `synthesizeSpeech` | 將文字轉換為語音（回傳 MP3） |
