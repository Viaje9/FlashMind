## MODIFIED Requirements

### Requirement: 今日學習進度顯示

系統 SHALL 在牌組詳情頁的統計卡片及牌組列表頁的卡片中顯示今日練習進度。

#### Scenario: 顯示新卡進度

- **WHEN** 使用者進入牌組詳情頁或牌組列表頁
- **THEN** 統計卡片的「新卡片」數字下方 SHALL 顯示今日新卡進度
- **AND** 進度格式為 `N / M`（N = 今日已學新卡數，M = 每日新卡上限）
- **AND** SHALL 顯示進度條，寬度比例為 N / M

#### Scenario: 顯示複習進度

- **WHEN** 使用者進入牌組詳情頁或牌組列表頁
- **THEN** 統計卡片的「待複習」數字下方 SHALL 顯示今日複習進度
- **AND** 進度格式為 `N / M`（N = 今日已複習數，M = 每日複習上限）
- **AND** SHALL 顯示進度條，寬度比例為 N / M

#### Scenario: 進度已達上限

- **WHEN** 今日已學數量等於或超過每日上限
- **THEN** 進度條 SHALL 填滿（100%）
- **AND** 進度文字仍顯示實際數字（可能超過上限）

#### Scenario: 尚未開始學習

- **WHEN** 今日尚未學習任何卡片
- **THEN** 進度條 SHALL 為空（0%）
- **AND** 進度文字顯示 `0 / M`

#### Scenario: 牌組列表 API 提供每日進度數據

- **WHEN** 系統回傳牌組列表
- **THEN** 每個牌組項目 SHALL 包含 `dailyNewCards`、`dailyReviewCards`、`todayNewStudied`、`todayReviewStudied` 欄位
- **AND** `todayNewStudied` SHALL 為今日學習日內 prevState 為 NEW 的 reviewLog 數量
- **AND** `todayReviewStudied` SHALL 為今日學習日內 prevState 非 NEW 的 reviewLog 數量
- **AND** 學習日起始時間 SHALL 使用 `getStartOfStudyDay` 根據牌組的 `dailyResetHour` 計算
