## ADDED Requirements

### Requirement: 語音合成服務

系統 SHALL 提供文字轉語音（TTS）服務，支援英文文字的語音播放。

#### Scenario: 呼叫語音合成 API

- **WHEN** 前端發送 `POST /tts/synthesize` 請求
- **AND** 請求包含 `text` 欄位（要朗讀的英文文字）
- **AND** 使用者已登入
- **THEN** 系統呼叫 Azure Speech Services 合成語音
- **AND** 回傳 MP3 格式的音訊資料

#### Scenario: 未登入時拒絕

- **WHEN** 未登入使用者呼叫語音合成 API
- **THEN** 回傳 401 Unauthorized 錯誤

#### Scenario: 輸入為空時拒絕

- **WHEN** 請求的 `text` 欄位為空
- **THEN** 回傳 400 Bad Request 錯誤

---

### Requirement: 前端語音播放

系統 SHALL 在前端提供語音播放功能，讓使用者聆聽英文發音。

#### Scenario: 點擊播放按鈕

- **WHEN** 使用者點擊語音播放按鈕
- **THEN** 系統呼叫 TTS API 取得音訊
- **AND** 播放該音訊

#### Scenario: 播放載入中

- **WHEN** 語音正在載入
- **THEN** 播放按鈕顯示載入狀態
- **AND** 按鈕暫時停用

#### Scenario: 播放中狀態

- **WHEN** 語音正在播放
- **THEN** 播放按鈕顯示播放中狀態

#### Scenario: 播放完成

- **WHEN** 語音播放完成
- **THEN** 播放按鈕恢復初始狀態

#### Scenario: 音訊快取

- **WHEN** 使用者播放相同文字的語音
- **AND** 該文字的音訊已在記憶體中快取
- **THEN** 直接從快取播放
- **AND** 不再呼叫 API

#### Scenario: 播放失敗

- **WHEN** 語音載入或播放失敗
- **THEN** 顯示錯誤提示
- **AND** 播放按鈕恢復初始狀態
