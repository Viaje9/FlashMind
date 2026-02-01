## MODIFIED Requirements

### Requirement: Start Study Session
系統 SHALL 提供開始學習功能，讓使用者取得今日應學習的卡片，並根據學習日起始時間扣除今日已學額度。

#### Scenario: Successfully start study session
- **WHEN** 使用者請求開始學習指定牌組
- **THEN** 系統依序回傳：待複習卡片（due <= now）、新卡片（state = NEW）
- **AND** 待複習卡片按 due 升序排列
- **AND** 新卡片按建立時間排列
- **AND** 新卡數量 SHALL 不超過 `dailyNewCards` 減去今日已學新卡數
- **AND** 複習卡數量 SHALL 不超過 `dailyReviewCards` 減去今日已複習數
- **AND** 今日已學數量 SHALL 根據牌組的 `dailyResetHour` 計算學習日起始時間

#### Scenario: Daily new card quota partially used
- **WHEN** 使用者今日已學 N 張新卡後離開並重新進入
- **THEN** 系統 SHALL 回傳最多 `dailyNewCards - N` 張新卡

#### Scenario: Daily review card quota partially used
- **WHEN** 使用者今日已複習 M 張卡片後離開並重新進入
- **THEN** 系統 SHALL 回傳最多 `dailyReviewCards - M` 張複習卡

#### Scenario: New card quota exhausted
- **WHEN** 使用者今日已學新卡數達到 `dailyNewCards` 上限
- **THEN** 系統 SHALL 不查詢也不回傳新卡

#### Scenario: Review card quota exhausted
- **WHEN** 使用者今日已複習數達到 `dailyReviewCards` 上限
- **THEN** 系統 SHALL 不查詢也不回傳複習卡

#### Scenario: No cards to study
- **WHEN** 使用者請求開始學習但牌組無卡片或今日已完成學習
- **THEN** 系統回傳空陣列

#### Scenario: Unauthorized access
- **WHEN** 使用者請求學習不屬於自己的牌組
- **THEN** 系統回傳 403 Forbidden
