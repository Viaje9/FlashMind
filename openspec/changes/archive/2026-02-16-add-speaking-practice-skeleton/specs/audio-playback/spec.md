## ADDED Requirements

### Requirement: Speaking 頁重用既有音訊播放互動模式

系統 SHALL 允許 speaking 頁重用既有音訊播放 UI/狀態模式，且本變更不新增 TTS 契約。

#### Scenario: speaking 頁可沿用播放狀態模式

- **WHEN** speaking 頁需要呈現音訊播放互動
- **THEN** 系統可重用既有 audio-playback capability 的載入、播放中、完成與失敗狀態模式

#### Scenario: 不新增 TTS API 契約

- **WHEN** 本次 speaking skeleton 交付
- **THEN** 系統不新增新的 `/tts/*` 端點
- **AND** 既有 `audio-playback` 契約保持不變
