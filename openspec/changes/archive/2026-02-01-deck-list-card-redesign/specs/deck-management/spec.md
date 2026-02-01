## MODIFIED Requirements

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
- **AND** 每日新卡上限（dailyNewCards）SHALL 為該牌組設定的每日新卡數
- **AND** 每日複習上限（dailyReviewCards）SHALL 為該牌組設定的每日複習數
- **AND** 今日已學新卡數（todayNewStudied）SHALL 為今日學習日內 prevState 為 NEW 的 reviewLog 數量
- **AND** 今日已複習數（todayReviewStudied）SHALL 為今日學習日內 prevState 非 NEW 的 reviewLog 數量

#### Scenario: 牌組卡片顯示兩欄統計

- **WHEN** 使用者檢視牌組列表
- **THEN** 每張牌組卡片 SHALL 顯示兩欄統計：左欄藍色新卡數 + 右欄綠色待複習數
- **AND** 各欄下方 SHALL 顯示 daily 進度條（今日已學數 / 每日上限）
- **AND** 進度條下方 SHALL 顯示 `N / M` 文字

#### Scenario: 顯示學習進度

- **WHEN** 使用者檢視牌組列表
- **THEN** 每個牌組顯示學習進度條與百分比
- **AND** 進度百分比計算為已完成數除以總卡片數

#### Scenario: 開始學習快捷入口

- **WHEN** 使用者檢視牌組列表
- **THEN** 每個牌組 SHALL 顯示全寬「開始學習」按鈕
- **AND** 按鈕始終顯示，無待學習項目時為 disabled 狀態
- **AND** 點擊按鈕 SHALL 導航至 `/decks/:id/study`（直接進入學習模式）
- **AND** 點擊按鈕 SHALL NOT 觸發卡片的點擊事件

#### Scenario: 點擊卡片導航至卡片列表

- **WHEN** 使用者點擊牌組卡片的非按鈕區域
- **THEN** SHALL 導航至 `/decks/:id`（卡片列表頁面）

#### Scenario: 空狀態顯示

- **WHEN** 使用者進入牌組列表頁面
- **AND** 使用者尚未建立任何牌組
- **THEN** 顯示空狀態提示「尚無牌組」
- **AND** 顯示引導使用者建立牌組的按鈕
