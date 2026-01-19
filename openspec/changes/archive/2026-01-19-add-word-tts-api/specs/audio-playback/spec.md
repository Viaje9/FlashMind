# audio-playback Spec Delta

## ADDED Requirements

### Requirement: 單字語音合成服務

系統 SHALL 提供單字專用的文字轉語音（TTS）服務，使用 Google Translate TTS 進行朗讀。

#### Scenario: 呼叫單字語音合成 API

- **WHEN** 前端發送 `POST /tts/word` 請求
- **AND** 請求包含 `text` 欄位（要朗讀的英文單字）
- **AND** 使用者已登入
- **THEN** 系統透過後端 Proxy 呼叫 Google Translate TTS
- **AND** 回傳 MP3 格式的音訊資料

#### Scenario: 未登入時拒絕

- **WHEN** 未登入使用者呼叫單字語音合成 API
- **THEN** 回傳 401 Unauthorized 錯誤

#### Scenario: 輸入為空時拒絕

- **WHEN** 請求的 `text` 欄位為空
- **THEN** 回傳 400 Bad Request 錯誤

---

### Requirement: 前端單字語音播放

系統 SHALL 在前端提供單字專用的語音播放功能，與句子播放分開處理。

#### Scenario: 播放卡片正面單字

- **WHEN** 使用者在卡片編輯器點擊正面的播放按鈕
- **THEN** 系統呼叫 `/tts/word` API 取得音訊
- **AND** 播放該音訊

#### Scenario: 播放例句

- **WHEN** 使用者在卡片編輯器點擊例句的播放按鈕
- **THEN** 系統呼叫 `/tts/synthesize` API 取得音訊（Azure TTS）
- **AND** 播放該音訊

#### Scenario: 單字音訊快取

- **WHEN** 使用者播放相同單字的語音
- **AND** 該單字的音訊已在記憶體中快取
- **THEN** 直接從快取播放
- **AND** 不再呼叫 API

## MODIFIED Requirements

### Requirement: 語音合成服務

系統 SHALL 提供文字轉語音（TTS）服務，支援英文文字的語音播放。此服務專用於句子朗讀（例句），使用 Azure Speech Services。

#### Scenario: 呼叫語音合成 API

- **WHEN** 前端發送 `POST /tts/synthesize` 請求
- **AND** 請求包含 `text` 欄位（要朗讀的英文句子）
- **AND** 使用者已登入
- **THEN** 系統呼叫 Azure Speech Services 合成語音
- **AND** 回傳 MP3 格式的音訊資料

#### Scenario: 未登入時拒絕

- **WHEN** 未登入使用者呼叫語音合成 API
- **THEN** 回傳 401 Unauthorized 錯誤

#### Scenario: 輸入為空時拒絕

- **WHEN** 請求的 `text` 欄位為空
- **THEN** 回傳 400 Bad Request 錯誤
