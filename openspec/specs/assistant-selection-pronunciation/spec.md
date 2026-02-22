# assistant-selection-pronunciation Specification

## Purpose

TBD - created by archiving change assistant-selection-pronunciation. Update Purpose after archive.

## Requirements

### Requirement: AI 助手訊息提供選取發音入口

系統 SHALL 在 `/speaking` 頁面的 AI 助手面板中，針對 assistant 訊息提供文字選取後的發音入口。

#### Scenario: 選取 assistant 訊息後顯示發音按鈕

- **WHEN** 使用者在 AI 助手 assistant 訊息中選取非空白文字
- **THEN** 系統顯示自訂操作按鈕「發音」
- **AND** 操作按鈕定位於選取範圍附近
- **AND** 使用者清除選取時操作按鈕立即隱藏

#### Scenario: 非 assistant 訊息不啟用選取發音

- **WHEN** 使用者在 AI 助手 user 訊息或面板外區域選取文字
- **THEN** 系統不顯示此功能的「發音」操作按鈕

### Requirement: iOS PWA 優先使用自訂選取操作

系統 SHALL 在 iOS PWA（standalone）中優先提供產品自訂選取流程，確保 AI 助手選取發音可用。

#### Scenario: iOS standalone 顯示自訂發音操作

- **GIVEN** 使用者使用 iOS 裝置且應用以 PWA standalone 模式執行
- **WHEN** 使用者在 AI 助手 assistant 訊息中選取文字
- **THEN** 系統顯示自訂操作按鈕「發音」
- **AND** 系統優先攔截原生 context menu 互動，避免流程依賴原生選單

#### Scenario: 無法完全攔截原生選單時仍可發音

- **WHEN** 裝置限制導致原生選單仍出現
- **THEN** 使用者仍可透過系統提供的「發音」入口播放選取文字
- **AND** 不得因原生選單存在而阻斷發音能力

### Requirement: 選取發音按鈕呈現播放狀態

系統 SHALL 在使用者點擊「發音」後，以選取操作按鈕本身呈現狀態，且不開啟發音 tooltip。

#### Scenario: 點擊發音後按鈕顯示載入中

- **WHEN** 使用者點擊選取操作中的「發音」
- **THEN** 系統以選取文字觸發語音合成與播放
- **AND** 選取操作按鈕顯示載入中狀態（例如點點點）
- **AND** 系統不顯示發音 tooltip

#### Scenario: 音檔回來後自動播放並切換按鈕狀態

- **WHEN** 語音合成成功回傳音檔
- **THEN** 系統自動開始播放該音檔
- **AND** 播放期間按鈕顯示「暫停」
- **AND** 播放結束後按鈕顯示「播放」

#### Scenario: 重複選取相同片段可重用音訊快取

- **WHEN** 使用者重複播放同一則 AI 助手訊息中的相同文字片段
- **THEN** 系統可重用既有音訊快取
- **AND** 不重複呼叫語音合成 API

### Requirement: 選取發音流程需具備錯誤與競態保護

系統 SHALL 處理發音失敗與快速重新選取等邊界情境，避免顯示錯誤或過期狀態。

#### Scenario: 發音失敗

- **WHEN** 語音合成或播放失敗
- **THEN** 發音按鈕恢復為可重試狀態「發音」
- **AND** 使用者可在同一選取範圍再次點擊重試

#### Scenario: 選取變更時丟棄舊狀態

- **WHEN** 使用者在發音請求尚未完成前改變選取文字
- **THEN** 系統不得以舊請求結果覆蓋新選取範圍的發音按鈕狀態
- **AND** 發音按鈕僅反映目前有效選取範圍的狀態
