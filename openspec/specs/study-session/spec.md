# study-session Specification

## Purpose
TBD - created by archiving change add-study-mode-fsrs. Update Purpose after archive.
## Requirements
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

---

### Requirement: Flip Card Learning

系統 SHALL 提供翻卡學習體驗，並根據 StudyCard 的 direction 調整正反面顯示。

#### Scenario: View forward card front

- **WHEN** 使用者開始學習一張 `direction = FORWARD` 的 StudyCard
- **THEN** 系統顯示卡片正面，內容為 `front`（英文單字/問題）

#### Scenario: Flip forward card to back

- **WHEN** 使用者點擊或滑動翻開正向卡
- **THEN** 系統顯示卡片背面（中文解釋、例句、例句翻譯）
- **AND** 翻卡動畫流暢（目標 60fps）

#### Scenario: View reverse card front

- **WHEN** 使用者開始學習一張 `direction = REVERSE` 的 StudyCard
- **THEN** 系統顯示卡片正面，內容為所有 `zhMeaning` 以全形分號連接（中文提示）

#### Scenario: Flip reverse card to back

- **WHEN** 使用者點擊或滑動翻開反向卡
- **THEN** 系統顯示卡片背面，翻譯區域顯示 `front`（英文答案）
- **AND** 顯示完整的詞義資訊（含 enExample/zhExample）
- **AND** 翻卡動畫流暢（目標 60fps）

#### Scenario: Study card response includes direction

- **WHEN** 系統回傳學習卡片
- **THEN** 每張 StudyCard SHALL 包含 `direction` 欄位（`FORWARD` 或 `REVERSE`）

---

### Requirement: Submit Review with Direction

系統 SHALL 在提交學習評分時接收 direction 參數，用以更新對應方向的 FSRS 排程。

#### Scenario: 提交正向評分

- **WHEN** 使用者對正向 StudyCard 進行評分
- **THEN** 前端 SHALL 傳送 `direction: 'FORWARD'` 至 submitReview API
- **AND** 系統 SHALL 更新正向 FSRS 排程欄位（`state`/`due`/`stability`/...）
- **AND** 系統 SHALL 建立 ReviewLog 並記錄 `direction = 'FORWARD'`

#### Scenario: 提交反向評分

- **WHEN** 使用者對反向 StudyCard 進行評分
- **THEN** 前端 SHALL 傳送 `direction: 'REVERSE'` 至 submitReview API
- **AND** 系統 SHALL 更新反向 FSRS 排程欄位（`reverseState`/`reverseDue`/`reverseStability`/...）
- **AND** 系統 SHALL 建立 ReviewLog 並記錄 `direction = 'REVERSE'`

#### Scenario: direction 預設為 FORWARD

- **WHEN** submitReview API 未收到 `direction` 參數
- **THEN** 系統 SHALL 預設使用 `FORWARD` 更新正向排程

---

### Requirement: Answer Rating
系統 SHALL 支援三種評分手勢，並根據評分更新 FSRS 排程。

#### Scenario: Rate as Known (Good)
- **WHEN** 使用者在卡片背面右滑（知道）
- **THEN** 系統以 Rating.Good 更新卡片排程
- **AND** 顯示視覺回饋
- **AND** 進入下一張卡片

#### Scenario: Rate as Unfamiliar (Hard)
- **WHEN** 使用者在卡片背面上滑（不熟）
- **THEN** 系統以 Rating.Hard 更新卡片排程
- **AND** 顯示視覺回饋
- **AND** 進入下一張卡片

#### Scenario: Rate as Unknown (Again)
- **WHEN** 使用者在卡片背面左滑（不知道）
- **THEN** 系統以 Rating.Again 更新卡片排程
- **AND** 將卡片加入本次學習的「重試佇列」
- **AND** 顯示視覺回饋
- **AND** 進入下一張卡片

#### Scenario: Review failed cards again
- **WHEN** 使用者完成所有新卡和複習卡
- **AND** 重試佇列不為空
- **THEN** 系統依序顯示重試佇列中的卡片
- **AND** 重複直到重試佇列清空

#### Scenario: Undo rating
- **WHEN** 使用者點擊返回按鈕
- **THEN** 系統回到上一張卡片
- **AND** 允許使用者修改評分

---

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

---

### Requirement: Complete Study Session
系統 SHALL 在學習完成後顯示統計結果。

#### Scenario: Show completion screen
- **WHEN** 使用者完成所有卡片（包含重試佇列）
- **THEN** 系統顯示結束畫面
- **AND** 顯示學習統計：學習張數、各評分分布（知道/不熟/不知道）
- **AND** 提供「返回牌組」按鈕

#### Scenario: Track study statistics
- **WHEN** 使用者完成學習
- **THEN** 系統記錄學習紀錄（時間、卡片數、評分分布）

---

### Requirement: Study Progress Display
系統 SHALL 顯示學習進度。

#### Scenario: Show progress during study
- **WHEN** 使用者正在學習
- **THEN** 系統顯示牌組名稱
- **AND** 顯示學習進度（例：12/50）
- **AND** 顯示進度條
