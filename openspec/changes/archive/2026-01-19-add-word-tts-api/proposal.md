# Change: 新增單字 TTS API（使用 Google Translate）

## Why

目前所有 TTS 請求都使用 Azure Speech Services，但單字朗讀與句子朗讀的需求不同：
- 單字朗讀頻率高、文字短，適合用免費的 Google Translate TTS
- 句子朗讀需要較高品質，適合繼續使用 Azure TTS

分流可降低 Azure API 成本，同時保持句子朗讀品質。

## What Changes

- 新增 `POST /tts/word` API：使用 Google Translate TTS 朗讀單字
- 現有 `POST /tts/synthesize` 保留：繼續使用 Azure TTS 處理句子
- 前端 TtsStore 新增方法：區分單字與句子播放
- 卡片編輯器調整：正面使用單字 API，例句使用句子 API

## Impact

- Affected specs: `audio-playback`
- Affected code:
  - `apps/api/src/modules/tts/` - 新增 Google TTS 服務
  - `openapi/api.yaml` - 新增 `/tts/word` 端點
  - `apps/web/src/app/components/tts/tts.store.ts` - 新增 `playWord()` 方法
  - `apps/web/src/app/pages/card-editor/` - 調整播放邏輯
