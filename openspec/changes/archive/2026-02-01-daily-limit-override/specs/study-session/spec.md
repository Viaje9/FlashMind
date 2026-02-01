## MODIFIED Requirements

### Requirement: Start Study Session

系統 SHALL 提供開始學習功能，讓使用者取得今日應學習的卡片。若牌組啟用反向學習，SHALL 同時回傳正向與反向 StudyCard，並根據學習日起始時間扣除今日已學額度。卡片數量上限 SHALL 使用有效每日上限（考慮覆寫值）。

#### Scenario: Successfully start study session

- **WHEN** 使用者請求開始學習指定牌組
- **THEN** 系統依序回傳：正向待複習卡片 → 反向待複習卡片 → 正向新卡片 → 反向新卡片
- **AND** 待複習卡片按 due 升序排列
- **AND** 新卡片按建立時間排列
- **AND** 新卡數量 SHALL 不超過有效新卡上限減去今日已學新卡數
- **AND** 複習卡數量 SHALL 不超過有效複習上限減去今日已複習數
- **AND** 今日已學數量 SHALL 根據牌組的 `dailyResetHour` 計算學習日起始時間
- **AND** 有效上限 SHALL 為 `max(overrideValue, dailyDefaultValue)`（若覆寫有效）或 `dailyDefaultValue`（若覆寫無效）

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

### Requirement: Study Summary with Reverse

系統 SHALL 在學習統計摘要中反映反向學習的數據，且每日上限 SHALL 使用有效上限值。

#### Scenario: 啟用反向時統計加計反向

- **WHEN** 牌組的 `enableReverse` 為 `true`
- **THEN** `newCount` SHALL 為正向新卡數加反向新卡數
- **AND** `reviewCount` SHALL 為正向待複習數加反向待複習數
- **AND** `todayStudied` SHALL 包含正向與反向的評分次數

#### Scenario: 未啟用反向時統計僅計正向

- **WHEN** 牌組的 `enableReverse` 為 `false`
- **THEN** `newCount` SHALL 只計算正向新卡數
- **AND** `reviewCount` SHALL 只計算正向待複習數

#### Scenario: 回傳有效每日限額與今日已學數量

- **WHEN** 前端呼叫 `GET /decks/{deckId}/study/summary`
- **THEN** SHALL 回傳 `dailyNewCards` 為有效新卡上限（考慮覆寫）
- **AND** SHALL 回傳 `dailyReviewCards` 為有效複習上限（考慮覆寫）
- **AND** SHALL 回傳 `todayNewStudied`（今日已學新卡數）
- **AND** SHALL 回傳 `todayReviewStudied`（今日已複習數）

#### Scenario: 今日已學新卡數計算

- **WHEN** 系統計算 `todayNewStudied`
- **THEN** SHALL 計算今日學習日起始時間（根據 `dailyResetHour`）之後，該牌組中 `prevState = NEW` 的 ReviewLog 數量

#### Scenario: 今日已複習數計算

- **WHEN** 系統計算 `todayReviewStudied`
- **THEN** SHALL 計算今日學習日起始時間之後，該牌組中 `prevState != NEW` 的 ReviewLog 數量

#### Scenario: 啟用反向學習時的已學數計算

- **WHEN** 牌組啟用反向學習
- **THEN** `todayNewStudied` SHALL 包含正向與反向的新卡學習次數
- **AND** `todayReviewStudied` SHALL 包含正向與反向的複習次數
