## MODIFIED Requirements

### Requirement: 前端語音播放

系統 SHALL 在前端提供語音播放功能，讓使用者聆聽英文發音，並支援由 AI 助手選取文字片段觸發播放。對於 `/speaking` 頁面，系統 MUST 以共享音軌提供主對話與 AI 助手片段發音，並在錄音或等待回應期間以靜音方式維持音軌連續性。

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

#### Scenario: AI 助手選取片段播放

- **WHEN** 使用者在 `/speaking` 的 AI 助手面板選取文字並點擊「發音」
- **THEN** 系統呼叫 `/tts/synthesize` 取得該片段音訊
- **AND** 音檔回來後系統自動播放
- **AND** 發音按鈕狀態切換為「暫停 / 播放」

#### Scenario: AI 助手選取片段播放失敗可重試

- **WHEN** AI 助手選取片段的語音播放失敗
- **THEN** 系統顯示可重試狀態
- **AND** 使用者再次點擊重試時系統 MUST 重新嘗試播放

#### Scenario: 口說頁錄音時啟用共享音軌

- **WHEN** 使用者在 `/speaking` 按下錄音按鈕開始錄音
- **THEN** 系統 MUST 先啟用共享音軌
- **AND** 後續主對話語音與 AI 助手片段發音 MUST 沿用該共享音軌播放

#### Scenario: 錄音與等待回應期間保持靜音而非暫停

- **WHEN** `/speaking` 處於錄音中或等待語音回應中
- **THEN** 系統 MUST 將共享音軌切換為靜音
- **AND** 系統 MUST NOT 以暫停中斷共享音軌

#### Scenario: 離開口說頁時停用共享音軌

- **WHEN** 使用者離開 `/speaking` 頁面
- **THEN** 系統 MUST 停用共享音軌 keep-alive
- **AND** 系統 MUST 不得持續影響口說頁外的播放路徑
