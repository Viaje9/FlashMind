# deck-management Specification

## Purpose
TBD - created by archiving change add-deck-management. Update Purpose after archive.
## Requirements
### Requirement: 檢視牌組列表

使用者 SHALL 能夠檢視所有自己建立的牌組。

#### Scenario: 顯示牌組列表

- **WHEN** 使用者進入牌組列表頁面
- **THEN** 顯示所有牌組的列表
- **AND** 每個牌組顯示：名稱、新卡數、待複習數、已完成數
- **AND** 新卡數、待複習數、總卡片數 SHALL 從資料庫實際查詢計算，不得使用硬編碼值

#### Scenario: 牌組統計數據計算

- **WHEN** 系統計算牌組統計數據
- **THEN** 新卡數（newCount）SHALL 為該牌組中 state 為 NEW 的卡片數量
- **AND** 待複習數（reviewCount）SHALL 為該牌組中 state 非 NEW 且 due 小於等於當前時間的卡片數量
- **AND** 總卡片數（totalCount）SHALL 為該牌組中所有卡片的數量

#### Scenario: 牌組詳情統計數據

- **WHEN** 使用者進入牌組詳情頁
- **THEN** 牌組摘要的新卡數和待複習數 SHALL 從資料庫實際查詢計算
- **AND** 上次學習時間 SHALL 從最近一筆 ReviewLog 取得

#### Scenario: 顯示學習進度

- **WHEN** 使用者檢視牌組列表
- **THEN** 每個牌組顯示學習進度條與百分比
- **AND** 進度百分比計算為已完成數除以總卡片數

#### Scenario: 開始學習快捷入口

- **WHEN** 使用者檢視牌組列表
- **THEN** 每個牌組提供「開始學習」按鈕
- **AND** 點擊後進入該牌組的學習模式

#### Scenario: 空狀態顯示

- **WHEN** 使用者進入牌組列表頁面
- **AND** 使用者尚未建立任何牌組
- **THEN** 顯示空狀態提示「尚無牌組」
- **AND** 顯示引導使用者建立牌組的按鈕

---

### Requirement: 建立新牌組

使用者 SHALL 能夠建立新牌組。

#### Scenario: 開啟建立表單

- **WHEN** 使用者在牌組列表頁點擊右下角 + 按鈕
- **THEN** 導航至建立牌組頁面
- **AND** 顯示建立表單

#### Scenario: 填寫牌組名稱

- **WHEN** 使用者填寫牌組名稱欄位
- **THEN** 名稱為必填欄位
- **AND** 最大長度為 100 字元

#### Scenario: 設定每日新卡數

- **WHEN** 使用者設定每日新卡數
- **THEN** 預設值為 20
- **AND** 步進為 5
- **AND** 範圍為 5 至 100

#### Scenario: 設定每日複習數

- **WHEN** 使用者設定每日複習數
- **THEN** 預設值為 100
- **AND** 步進為 10
- **AND** 範圍為 10 至 500

#### Scenario: 設定每日重置時間

- **WHEN** 使用者建立牌組時未設定重置時間
- **THEN** `dailyResetHour` 預設值 SHALL 為 4
- **AND** `dailyResetHour` 範圍 SHALL 為 0 至 23

#### Scenario: FSRS 參數使用預設值

- **WHEN** 使用者建立牌組
- **THEN** FSRS 參數 SHALL 使用以下預設值：
  - `learningSteps`: `"1m,10m"`
  - `relearningSteps`: `"10m"`
  - `requestRetention`: `0.9`
  - `maximumInterval`: `36500`
- **AND** 建立表單不顯示 FSRS 參數欄位

#### Scenario: 顯示設定提示

- **WHEN** 使用者瀏覽建立牌組表單
- **THEN** 顯示提示文字「可於牌組設定調整」

#### Scenario: 儲存成功

- **WHEN** 使用者填寫完畢並點擊「儲存」
- **AND** 牌組名稱已填寫
- **THEN** 牌組建立成功
- **AND** 導向該牌組的卡片列表頁面

#### Scenario: 儲存失敗（名稱未填）

- **WHEN** 使用者點擊「儲存」
- **AND** 牌組名稱為空
- **THEN** 顯示驗證錯誤訊息「請輸入牌組名稱」
- **AND** 不建立牌組

#### Scenario: 取消建立

- **WHEN** 使用者點擊「取消」
- **THEN** 返回牌組列表頁面
- **AND** 不儲存任何資料

---

### Requirement: 編輯牌組設定

使用者 SHALL 能夠編輯現有牌組的設定，包含每日重置時間與 FSRS 演算法參數。

#### Scenario: 進入設定頁面

- **WHEN** 使用者在牌組詳情頁點擊設定按鈕
- **THEN** 導航至牌組設定頁面
- **AND** 表單預填現有設定（含 `dailyResetHour` 與 FSRS 參數）

#### Scenario: 修改牌組名稱

- **WHEN** 使用者在設定頁面修改名稱
- **THEN** 可修改牌組名稱
- **AND** 名稱為必填

#### Scenario: 修改每日新卡數與複習數

- **WHEN** 使用者在設定頁面修改數值
- **THEN** 可修改每日新卡數
- **AND** 可修改每日複習數
- **AND** 遵循原有的步進和範圍限制

#### Scenario: 修改每日重置時間

- **WHEN** 使用者在設定頁面修改每日重置時間
- **THEN** 可修改 `dailyResetHour`（0-23）
- **AND** 步進為 1
- **AND** 單位顯示為「時」

#### Scenario: 修改目標保留率

- **WHEN** 使用者在設定頁面修改目標保留率
- **THEN** 可修改 `requestRetention`（0.70-0.97）
- **AND** 步進為 0.01
- **AND** 顯示為百分比格式（如「90%」）

#### Scenario: 修改最大複習間隔

- **WHEN** 使用者在設定頁面修改最大複習間隔
- **THEN** 可修改 `maximumInterval`（30-36500）
- **AND** 步進為 30
- **AND** 單位顯示為「天」

#### Scenario: 修改學習步驟

- **WHEN** 使用者在設定頁面修改學習步驟
- **THEN** 可修改 `learningSteps`
- **AND** 格式提示為「如：1m, 10m」
- **AND** 支援 m（分鐘）、h（小時）、d（天）單位

#### Scenario: 修改重學步驟

- **WHEN** 使用者在設定頁面修改重學步驟
- **THEN** 可修改 `relearningSteps`
- **AND** 格式提示為「如：10m」
- **AND** 支援 m（分鐘）、h（小時）、d（天）單位

#### Scenario: 重置 FSRS 參數為預設值

- **WHEN** 使用者點擊「重置為預設值」按鈕
- **THEN** 所有 FSRS 參數回復為預設值：
  - `learningSteps`: `"1m,10m"`
  - `relearningSteps`: `"10m"`
  - `requestRetention`: `0.9`
  - `maximumInterval`: `36500`
- **AND** 表單欄位更新為預設值
- **AND** 需點擊「儲存」才會生效

#### Scenario: 儲存按鈕位於 Header 右側

- **WHEN** 使用者在牌組設定頁面
- **THEN** 「儲存」按鈕 SHALL 位於頁面 Header 右側，與標題「牌組設定」同一行
- **AND** 按鈕使用 primary 樣式
- **AND** 當表單無效或正在儲存時，按鈕 SHALL 為 disabled 狀態

#### Scenario: 無取消按鈕

- **WHEN** 使用者在牌組設定頁面
- **THEN** 頁面 SHALL NOT 顯示「取消」按鈕
- **AND** 使用者可透過返回按鈕離開，由 CanDeactivate guard 處理未儲存變更

#### Scenario: 儲存設定成功

- **WHEN** 使用者修改完畢並點擊「儲存」
- **THEN** 設定更新成功（含 `dailyResetHour` 與 FSRS 參數）
- **AND** 新設定立即生效於下次學習
- **AND** 導航回牌組詳情頁

### Requirement: 刪除牌組

使用者 SHALL 能夠刪除現有牌組。

#### Scenario: 刪除按鈕位於最下方

- **WHEN** 使用者在牌組設定頁面
- **THEN** 「刪除牌組」按鈕 SHALL 位於頁面最下方
- **AND** 按鈕 SHALL 使用深紅色低調樣式（深紅背景、淺紅文字、深紅邊框）
- **AND** 按鈕為全寬
- **AND** 按鈕與上方表單區域 SHALL 有足夠間距以降低誤觸風險

#### Scenario: 點擊刪除按鈕

- **WHEN** 使用者在牌組設定頁點擊刪除按鈕
- **THEN** 彈出確認對話框
- **AND** 對話框標題為「刪除牌組」

#### Scenario: 確認對話框說明

- **WHEN** 確認對話框顯示
- **THEN** 說明文字包含「將刪除所有卡片與學習紀錄」
- **AND** 顯示牌組名稱

#### Scenario: 確認刪除

- **WHEN** 使用者在確認對話框點擊「確認」
- **THEN** 牌組及其所有卡片刪除
- **AND** 學習紀錄一併刪除
- **AND** 返回牌組列表頁面

#### Scenario: 取消刪除

- **WHEN** 使用者在確認對話框點擊「取消」
- **THEN** 對話框關閉
- **AND** 牌組保持不變

