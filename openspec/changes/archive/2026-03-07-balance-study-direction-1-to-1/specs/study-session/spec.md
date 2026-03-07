## MODIFIED Requirements

### Requirement: Start Study Session

系統 SHALL 提供開始學習功能，讓使用者取得今日應學習的卡片。若牌組啟用反向學習，系統 SHALL 將正向與反向卡面視為等權候選，並在有效每日上限內盡量以 `1:1` 比例混合出牌。卡片數量上限 SHALL 使用有效每日上限（考慮覆寫值），且同一張底層卡片的正向與反向 StudyCard SHALL 至少間隔 5 張。

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
- **THEN** 系統 SHALL 查詢正向排程的待複習卡片與新卡片
- **AND** 系統 SHALL 查詢反向排程的待複習卡片與新卡片
- **AND** 正向與反向候選 SHALL 在有效每日上限內優先以 `1:1` 比例組成今日學習池
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
- **AND** 啟用反向學習 SHALL NOT 讓有效新卡或有效複習上限翻倍

#### Scenario: 單側不足時由另一側補位

- **WHEN** 牌組啟用反向學習且正向或反向候選不足以達成 `1:1`
- **THEN** 系統 SHALL 先盡量交錯放入雙方候選
- **AND** 剩餘名額 SHALL 由仍有候選的一側補滿
- **AND** 系統 SHALL NOT 因其中一側不足而提前停止回傳可學卡片

#### Scenario: 反向有卡但正向無卡時仍可學習

- **WHEN** 牌組啟用反向學習
- **AND** 今日只有反向候選符合排程
- **THEN** 系統 SHALL 回傳反向 StudyCard
- **AND** 系統 SHALL NOT 要求必須同時存在正向候選

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

系統 SHALL 在學習統計摘要中反映反向學習的數據，且每日上限 SHALL 使用有效上限值。當牌組啟用反向學習時，統計中的學習次數語意 SHALL 以「卡面作答次數」為單位，而不是以底層卡片數量為單位。

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
- **THEN** `todayNewStudied` SHALL 包含正向與反向的新卡作答次數
- **AND** `todayReviewStudied` SHALL 包含正向與反向的複習作答次數
- **AND** 每一次正向或反向作答 SHALL 各自消耗同一份每日總量中的 1 次額度
