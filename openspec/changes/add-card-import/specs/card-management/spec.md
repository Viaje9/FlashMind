## ADDED Requirements

### Requirement: 匯入卡片

使用者 SHALL 能夠透過 JSON 格式批次匯入卡片至牌組。

#### Scenario: 匯入入口

- **WHEN** 使用者在牌組詳情頁
- **THEN** PageHeader 右側顯示「匯入」按鈕
- **AND** 點擊後導航至匯入頁面

#### Scenario: 匯入頁面顯示

- **WHEN** 使用者進入匯入頁面
- **THEN** 顯示 JSON 輸入區塊
- **AND** 提供 textarea 讓使用者貼上 JSON
- **AND** 提供「選擇檔案」按鈕上傳 .json 檔案
- **AND** 顯示 JSON 格式範例說明

#### Scenario: JSON 格式定義

- **WHEN** 使用者準備匯入 JSON
- **THEN** JSON 格式符合以下結構：
```json
{
  "cards": [
    {
      "front": "必填：正面文字",
      "meanings": [
        {
          "zhMeaning": "必填：中文解釋",
          "enExample": "選填：英文例句",
          "zhExample": "選填：中文例句翻譯"
        }
      ]
    }
  ]
}
```
- **AND** `cards` 為陣列，每個元素代表一張卡片
- **AND** `front` 為必填欄位
- **AND** `meanings` 為陣列，至少需要一筆詞義
- **AND** `zhMeaning` 為必填欄位
- **AND** `enExample` 和 `zhExample` 為選填欄位

#### Scenario: 前端解析與預覽

- **WHEN** 使用者輸入或上傳 JSON 後
- **THEN** 系統解析 JSON 內容
- **AND** 顯示卡片預覽列表
- **AND** 每張卡片顯示正面文字與第一筆詞義摘要
- **AND** 顯示即將匯入的卡片總數

#### Scenario: JSON 格式錯誤

- **WHEN** 使用者輸入的 JSON 格式不正確
- **THEN** 顯示錯誤訊息說明問題
- **AND** 不顯示預覽列表
- **AND** 「確認匯入」按鈕停用

#### Scenario: 卡片內容驗證錯誤

- **WHEN** JSON 格式正確但卡片內容不符規範
- **THEN** 在預覽列表中標示有問題的卡片
- **AND** 顯示具體錯誤訊息（如「缺少正面內容」）
- **AND** 仍可選擇匯入（錯誤卡片將被跳過）

#### Scenario: 確認匯入

- **WHEN** 使用者在預覽畫面點擊「確認匯入」按鈕
- **AND** 至少有一張有效卡片
- **THEN** 系統呼叫匯入 API
- **AND** 顯示載入狀態

#### Scenario: 匯入成功

- **WHEN** 匯入 API 回傳結果
- **THEN** 顯示匯入結果摘要
- **AND** 摘要包含：總數、成功數、失敗數
- **AND** 若有失敗項目，顯示失敗原因

#### Scenario: 匯入結果返回

- **WHEN** 使用者在匯入結果畫面
- **THEN** 顯示「返回牌組」按鈕
- **AND** 點擊後導航回牌組詳情頁

#### Scenario: 取消匯入

- **WHEN** 使用者在匯入頁面點擊「取消」或返回按鈕
- **THEN** 導航回牌組詳情頁
- **AND** 不執行任何匯入操作

#### Scenario: 頁首操作

- **WHEN** 使用者在匯入頁面
- **THEN** 頁首顯示「匯入卡片」標題
- **AND** 頁首左側顯示返回按鈕
