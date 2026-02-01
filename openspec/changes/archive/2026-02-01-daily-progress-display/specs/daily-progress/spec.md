## ADDED Requirements

### Requirement: 今日學習進度 API

系統 SHALL 在學習摘要 API 中回傳每日限額與今日已學細項，讓前端得以呈現今日練習進度。

#### Scenario: 回傳每日限額與今日已學數量

- **WHEN** 前端呼叫 `GET /decks/{deckId}/study/summary`
- **THEN** 回傳資料 SHALL 包含 `dailyNewCards`（牌組每日新卡上限）
- **AND** 回傳資料 SHALL 包含 `dailyReviewCards`（牌組每日複習上限）
- **AND** 回傳資料 SHALL 包含 `todayNewStudied`（今日已學新卡數）
- **AND** 回傳資料 SHALL 包含 `todayReviewStudied`（今日已複習數）

#### Scenario: 今日已學新卡數計算

- **WHEN** 系統計算 `todayNewStudied`
- **THEN** SHALL 計算今日學習日起始時間（根據 `dailyResetHour`）之後，該牌組中 `prevState = NEW` 的 ReviewLog 數量

#### Scenario: 今日已複習數計算

- **WHEN** 系統計算 `todayReviewStudied`
- **THEN** SHALL 計算今日學習日起始時間之後，該牌組中 `prevState != NEW` 的 ReviewLog 數量

#### Scenario: 啟用反向學習時的計算

- **WHEN** 牌組啟用反向學習
- **THEN** `todayNewStudied` SHALL 包含正向與反向的新卡學習次數
- **AND** `todayReviewStudied` SHALL 包含正向與反向的複習次數

---

### Requirement: 今日學習進度顯示

系統 SHALL 在牌組詳情頁的統計卡片中顯示今日練習進度。

#### Scenario: 顯示新卡進度

- **WHEN** 使用者進入牌組詳情頁
- **THEN** 統計卡片的「新卡片」數字下方 SHALL 顯示今日新卡進度
- **AND** 進度格式為 `N / M`（N = 今日已學新卡數，M = 每日新卡上限）
- **AND** SHALL 顯示進度條，寬度比例為 N / M

#### Scenario: 顯示複習進度

- **WHEN** 使用者進入牌組詳情頁
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
