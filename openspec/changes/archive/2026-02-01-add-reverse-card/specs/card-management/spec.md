## MODIFIED Requirements

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

---

### Requirement: 檢視牌組內卡片

使用者 SHALL 能夠檢視牌組內的所有卡片。

#### Scenario: 顯示牌組摘要

- **WHEN** 使用者進入牌組詳情頁
- **THEN** 顯示牌組摘要資訊
- **AND** 摘要包含：新卡數、待複習數、建立時間、上次複習時間

#### Scenario: 顯示卡片列表

- **WHEN** 使用者進入牌組詳情頁
- **THEN** 顯示該牌組內所有卡片的列表
- **AND** 每張卡片顯示正面文字
- **AND** 每張卡片顯示第一筆詞義的中文解釋（作為摘要）
- **AND** 每張卡片顯示複習時間資訊（行內式，位於摘要下方）

#### Scenario: 卡片複習時間顯示 — 新卡片

- **WHEN** 卡片學習狀態為 NEW
- **THEN** 複習時間顯示「新卡片・尚未學習」
- **AND** 文字顏色為主色（primary）

#### Scenario: 卡片複習時間顯示 — 即將到期

- **WHEN** 卡片學習狀態非 NEW
- **AND** 下次複習時間在未來 24 小時內
- **THEN** 複習時間顯示「X 小時後到期」或「X 分鐘後到期」
- **AND** 文字顏色為綠色（emerald）

#### Scenario: 卡片複習時間顯示 — 已逾期

- **WHEN** 卡片學習狀態非 NEW
- **AND** 下次複習時間已過
- **THEN** 複習時間顯示「已逾期 X 天」或「今天到期」
- **AND** 文字顏色為紅色（red）

#### Scenario: 卡片複習時間顯示 — 未來複習

- **WHEN** 卡片學習狀態非 NEW
- **AND** 下次複習時間超過 24 小時
- **THEN** 複習時間顯示「X 天後」
- **AND** 文字顏色為灰色（slate）

#### Scenario: 卡片列表 API 回傳學習狀態

- **WHEN** 前端呼叫卡片列表 API（GET /api/decks/:deckId/cards）
- **THEN** 每張卡片回傳 `state` 欄位（NEW、LEARNING、REVIEW、RELEARNING）
- **AND** 每張卡片回傳 `due` 欄位（ISO 8601 UTC 時間戳，新卡片為 null）

#### Scenario: 開始學習入口

- **WHEN** 使用者檢視牌組詳情頁
- **THEN** 提供「開始學習」按鈕
- **AND** 點擊後進入該牌組的學習模式

#### Scenario: 卡片列表為空

- **WHEN** 使用者進入牌組詳情頁
- **AND** 牌組內尚無任何卡片
- **THEN** 顯示空狀態提示「尚無卡片」
- **AND** 顯示引導使用者新增卡片的按鈕

---

### Requirement: 新增卡片

使用者 SHALL 能夠新增單張卡片至牌組。

#### Scenario: 新增卡片頁面顯示

- **WHEN** 使用者進入新增卡片頁面
- **THEN** 顯示正面輸入欄位與詞義編輯區塊

#### Scenario: 新增卡片

- **WHEN** 使用者填寫卡片內容並點擊「儲存」
- **THEN** 系統呼叫建立 API
- **AND** 系統建立卡片（含正向與反向 FSRS 初始狀態）

---

### Requirement: 編輯卡片

使用者 SHALL 能夠編輯現有卡片。

#### Scenario: 進入編輯頁面

- **WHEN** 使用者在卡片列表點擊卡片項目的編輯按鈕
- **THEN** 導航至編輯卡片頁面
- **AND** 表單預填現有卡片內容

#### Scenario: 修改正面內容

- **WHEN** 使用者在編輯頁面修改正面
- **THEN** 可修改正面內容
- **AND** 正面仍為必填

#### Scenario: 修改詞義區塊

- **WHEN** 使用者在編輯頁面修改詞義
- **THEN** 可修改所有詞義區塊的欄位
- **AND** 可新增詞義區塊
- **AND** 可刪除詞義區塊（保留至少一筆）

#### Scenario: 儲存編輯成功

- **WHEN** 使用者修改完畢並點擊「儲存」
- **AND** 驗證通過
- **THEN** 卡片更新成功
- **AND** 返回牌組詳情頁（卡片列表）

---

### Requirement: 刪除卡片

使用者 SHALL 能夠刪除現有卡片。

#### Scenario: 點擊刪除按鈕

- **WHEN** 使用者在卡片列表點擊卡片項目的刪除按鈕
- **THEN** 彈出確認對話框

#### Scenario: 確認對話框內容

- **WHEN** 確認對話框顯示
- **THEN** 對話框標題為「刪除卡片」
- **AND** 說明文字顯示將刪除的卡片正面內容

#### Scenario: 確認刪除

- **WHEN** 使用者在確認對話框點擊「確認」
- **THEN** 系統刪除該卡片（含其正向與反向 FSRS 排程資料與 ReviewLog）
- **AND** 卡片從列表移除
- **AND** 對話框關閉

#### Scenario: 取消刪除

- **WHEN** 使用者在確認對話框點擊「取消」
- **THEN** 對話框關閉
- **AND** 卡片保持不變
