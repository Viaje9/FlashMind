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
