## MODIFIED Requirements

### Requirement: 編輯牌組設定（修改）

牌組設定頁面的按鈕配置 SHALL 調整如下。

#### Scenario: 儲存按鈕位於 Header 右側

- **WHEN** 使用者在牌組設定頁面
- **THEN** 「儲存」按鈕 SHALL 位於頁面 Header 右側，與標題「牌組設定」同一行
- **AND** 按鈕使用 primary 樣式
- **AND** 當表單無效或正在儲存時，按鈕 SHALL 為 disabled 狀態

#### Scenario: 無取消按鈕

- **WHEN** 使用者在牌組設定頁面
- **THEN** 頁面 SHALL NOT 顯示「取消」按鈕
- **AND** 使用者可透過返回按鈕離開，由 CanDeactivate guard 處理未儲存變更

#### Scenario: 刪除按鈕位於最下方

- **WHEN** 使用者在牌組設定頁面
- **THEN** 「刪除牌組」按鈕 SHALL 位於頁面最下方
- **AND** 按鈕 SHALL 使用深紅色低調樣式（深紅背景、淺紅文字、深紅邊框）
- **AND** 按鈕為全寬
- **AND** 按鈕與上方表單區域 SHALL 有足夠間距以降低誤觸風險
- **AND** 移除原本的「危險區域」section heading
