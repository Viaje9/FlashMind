## MODIFIED Requirements

### Requirement: 前端語音播放

系統 SHALL 在前端提供語音播放功能，讓使用者聆聽英文發音，並在 speaking 情境下具備 iOS/PWA 可用的穩定播放策略。

#### Scenario: 點擊播放按鈕

- **WHEN** 使用者點擊語音播放按鈕
- **THEN** 系統呼叫對應音訊來源並播放

#### Scenario: 播放載入中

- **WHEN** 語音正在載入
- **THEN** 播放按鈕顯示載入狀態
- **AND** 按鈕暫時停用

#### Scenario: 播放中狀態

- **WHEN** 語音正在播放
- **THEN** 播放按鈕或訊息 avatar 顯示播放中狀態

#### Scenario: 播放完成

- **WHEN** 語音播放完成
- **THEN** 播放 UI 恢復初始狀態

#### Scenario: 音訊快取

- **WHEN** 使用者播放相同文字或相同語音 payload
- **AND** 音訊已存在快取
- **THEN** 系統直接使用快取播放
- **AND** 不再重複請求或重複解碼

#### Scenario: 播放失敗

- **WHEN** 語音載入或播放失敗
- **THEN** 系統顯示錯誤提示
- **AND** 播放 UI 恢復可重試狀態

#### Scenario: iOS/PWA 自動播放受限時 fallback

- **WHEN** 系統嘗試自動播放 assistant 語音且瀏覽器限制 autoplay
- **THEN** 系統執行解鎖與重試策略（user gesture unlock、visibility-aware retry）
- **AND** 若仍失敗則提供手動播放入口
