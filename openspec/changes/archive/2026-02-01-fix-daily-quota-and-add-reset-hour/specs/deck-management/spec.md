## MODIFIED Requirements

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

使用者 SHALL 能夠編輯現有牌組的設定，包含每日重置時間。

#### Scenario: 進入設定頁面

- **WHEN** 使用者在牌組詳情頁點擊設定按鈕
- **THEN** 導航至牌組設定頁面
- **AND** 表單預填現有設定（含 `dailyResetHour`）

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

#### Scenario: 儲存設定成功

- **WHEN** 使用者修改完畢並點擊「儲存」
- **THEN** 設定更新成功（含 `dailyResetHour`）
- **AND** 新設定立即生效於下次學習
- **AND** 導航回牌組詳情頁
