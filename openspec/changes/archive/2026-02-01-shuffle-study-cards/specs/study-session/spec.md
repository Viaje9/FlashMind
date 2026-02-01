## MODIFIED Requirements

### Requirement: Start Study Session

系統 SHALL 提供開始學習功能，讓使用者取得今日應學習的卡片。若牌組啟用反向學習，SHALL 同時回傳正向與反向 StudyCard，並根據學習日起始時間扣除今日已學額度。卡片數量上限 SHALL 使用有效每日上限（考慮覆寫值）。回傳的卡片順序 SHALL 為隨機混合排序（新卡與複習卡混雜），且同一張底層卡片的正向與反向 StudyCard SHALL 至少間隔 5 張。

#### Scenario: Successfully start study session

- **WHEN** 使用者請求開始學習指定牌組
- **THEN** 系統回傳所有符合條件的卡片（新卡與複習卡混合），順序為隨機排列
- **AND** 新卡數量 SHALL 不超過有效新卡上限減去今日已學新卡數
- **AND** 複習卡數量 SHALL 不超過有效複習上限減去今日已複習數
- **AND** 今日已學數量 SHALL 根據牌組的 `dailyResetHour` 計算學習日起始時間
- **AND** 有效上限 SHALL 為 `max(overrideValue, dailyDefaultValue)`（若覆寫有效）或 `dailyDefaultValue`（若覆寫無效）

#### Scenario: 隨機混合排序

- **WHEN** 系統選取完所有符合條件的卡片
- **THEN** 系統 SHALL 將新卡與複習卡隨機混合排列
- **AND** 每次呼叫 SHALL 可能產生不同的卡片順序

#### Scenario: 正反向間隔約束

- **WHEN** 牌組啟用反向學習且同一張卡片同時出現正向與反向 StudyCard
- **THEN** 該卡片的正向與反向 StudyCard 在回傳陣列中 SHALL 至少間隔 5 張
- **AND** 若卡片總數不足以滿足間隔 5，系統 SHALL 盡量拉開到最大可能距離

#### Scenario: 啟用反向學習時回傳雙向卡片

- **WHEN** 牌組的 `enableReverse` 為 `true`
- **THEN** 系統 SHALL 額外查詢反向排程的待複習卡片（`reverseState != NEW` 且 `reverseDue <= now`）
- **AND** 系統 SHALL 額外查詢反向排程的新卡片（`reverseState == NEW`）
- **AND** 反向 StudyCard 的 `direction` 欄位為 `REVERSE`
- **AND** 反向 StudyCard 的 `state` 來自 `reverseState` 欄位

#### Scenario: 未啟用反向學習時只回傳正向卡片

- **WHEN** 牌組的 `enableReverse` 為 `false`
- **THEN** 系統 SHALL 只回傳正向 StudyCard
- **AND** 所有 StudyCard 的 `direction` 欄位為 `FORWARD`
- **AND** 卡片順序 SHALL 為隨機排列

#### Scenario: 正向與反向共用每日額度

- **WHEN** 牌組啟用反向學習
- **THEN** 正向與反向 SHALL 共用同一份有效新卡額度
- **AND** 正向與反向 SHALL 共用同一份有效複習額度
- **AND** 正向卡片優先取用額度，反向卡片取用剩餘額度

#### Scenario: Daily new card quota partially used

- **WHEN** 使用者今日已學 N 張新卡後離開並重新進入
- **THEN** 系統 SHALL 回傳最多「有效新卡上限 - N」張新卡

#### Scenario: Daily review card quota partially used

- **WHEN** 使用者今日已複習 M 張卡片後離開並重新進入
- **THEN** 系統 SHALL 回傳最多「有效複習上限 - M」張複習卡

#### Scenario: New card quota exhausted

- **WHEN** 使用者今日已學新卡數達到有效新卡上限
- **THEN** 系統 SHALL 不查詢也不回傳新卡

#### Scenario: Review card quota exhausted

- **WHEN** 使用者今日已複習數達到有效複習上限
- **THEN** 系統 SHALL 不查詢也不回傳複習卡

#### Scenario: No cards to study

- **WHEN** 使用者請求開始學習但牌組無卡片或今日已完成學習
- **THEN** 系統回傳空陣列

#### Scenario: Unauthorized access

- **WHEN** 使用者請求學習不屬於自己的牌組
- **THEN** 系統回傳 403 Forbidden
