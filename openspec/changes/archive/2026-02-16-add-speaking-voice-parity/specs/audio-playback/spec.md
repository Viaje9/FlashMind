## MODIFIED Requirements

### Requirement: Speaking 模組可重用既有播放能力

系統 SHALL 允許 speaking 頁重用既有 audio playback 的播放狀態模式與 UI 行為，以支援 assistant 語音回覆與歷史語音播放。

#### Scenario: speaking 訊息可播放語音

- **WHEN** speaking 對話訊息包含可播放音檔
- **THEN** 前端可重用既有播放中/完成/錯誤狀態模式
- **AND** 使用者可從 speaking 對話區與歷史對話中播放語音

#### Scenario: 語音試聽可沿用播放行為

- **WHEN** 使用者在 `/settings/speaking` 觸發 voice preview
- **THEN** 系統可沿用既有播放互動模式呈現試聽結果

#### Scenario: 不新增 TTS 契約

- **WHEN** 本變更交付
- **THEN** 系統不新增新的 `/tts/*` endpoint
- **AND** 既有 `audio-playback` 與 `tts` 契約保持不變
