## ADDED Requirements

### Requirement: 口說 AI 訊息提供選取翻譯入口

系統 SHALL 在 `/speaking` 頁面針對 assistant 訊息逐字稿提供文字選取後的翻譯入口。

#### Scenario: 選取 assistant 文字後顯示翻譯按鈕

- **WHEN** 使用者在 assistant 訊息中選取非空白文字
- **THEN** 系統顯示自訂操作按鈕「翻譯」
- **AND** 操作按鈕定位於選取範圍附近
- **AND** 使用者清除選取時操作按鈕立即隱藏

#### Scenario: 非 assistant 訊息不啟用選取翻譯

- **WHEN** 使用者在 user 訊息或非逐字稿區域選取文字
- **THEN** 系統不顯示此功能的「翻譯」操作按鈕

### Requirement: iOS PWA 優先使用自訂選取操作

系統 SHALL 在 iOS PWA（standalone）中優先提供產品自訂選取操作，讓使用者可直接觸發翻譯。

#### Scenario: iOS standalone 顯示自訂翻譯操作

- **GIVEN** 使用者使用 iOS 裝置且應用以 PWA standalone 模式執行
- **WHEN** 使用者在 assistant 訊息中選取文字
- **THEN** 系統顯示自訂操作按鈕「翻譯」
- **AND** 系統優先攔截原生 context menu 互動，避免操作流程依賴原生選單

#### Scenario: 無法完全攔截原生選單時仍可翻譯

- **WHEN** 裝置限制導致原生選單仍出現
- **THEN** 使用者仍可透過系統提供的自訂「翻譯」入口完成翻譯流程
- **AND** 不得因原生選單存在而阻斷翻譯能力

### Requirement: 選取翻譯以 tooltip 呈現狀態與結果

系統 SHALL 在使用者點擊「翻譯」後，以 tooltip 顯示翻譯載入狀態與翻譯結果。

#### Scenario: 翻譯成功

- **WHEN** 使用者點擊選取操作中的「翻譯」
- **THEN** 系統送出選取文字至 `POST /speaking/translate`
- **AND** tooltip 先顯示載入中狀態
- **AND** 成功後顯示繁體中文翻譯文字

#### Scenario: 重複選取相同片段使用快取

- **WHEN** 使用者在同一則訊息重複翻譯相同文字片段
- **THEN** 系統可重用既有翻譯結果
- **AND** 不重複呼叫翻譯 API

### Requirement: 選取翻譯流程需具備錯誤與競態保護

系統 SHALL 處理翻譯失敗與快速重新選取等邊界情境，避免顯示錯誤或過期結果。

#### Scenario: 翻譯失敗

- **WHEN** 翻譯 API 回傳錯誤或逾時
- **THEN** tooltip 顯示錯誤訊息「翻譯失敗，請稍後再試」
- **AND** 使用者可在同一選取範圍重試

#### Scenario: 選取變更時丟棄舊回應

- **WHEN** 使用者在翻譯請求尚未完成前改變選取文字
- **THEN** 系統不得以舊請求結果覆蓋新選取的 tooltip 內容
- **AND** tooltip 僅呈現目前有效選取範圍的狀態與結果
