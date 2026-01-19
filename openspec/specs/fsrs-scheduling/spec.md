# fsrs-scheduling Specification

## Purpose
TBD - created by archiving change add-study-mode-fsrs. Update Purpose after archive.
## Requirements
### Requirement: FSRS Integration
系統 SHALL 整合 ts-fsrs 套件實作 FSRS 演算法進行卡片排程。

#### Scenario: Initialize new card
- **WHEN** 卡片首次進入學習
- **THEN** 系統使用 ts-fsrs 的 `createEmptyCard()` 初始化 FSRS 狀態
- **AND** 設定 state 為 NEW

#### Scenario: Calculate next review date
- **WHEN** 使用者對卡片評分
- **THEN** 系統使用 ts-fsrs 的 `fsrs().next(card, now, rating)` 計算下次複習日期
- **AND** 更新卡片的 FSRS 欄位（due, stability, difficulty, etc.）

---

### Requirement: Rating to FSRS Mapping
系統 SHALL 將使用者評分對應到 FSRS Rating。

#### Scenario: Map Known to Good
- **WHEN** 使用者評分為「知道」
- **THEN** 系統使用 Rating.Good (3)
- **AND** 卡片間隔為三種評分中最長

#### Scenario: Map Unfamiliar to Hard
- **WHEN** 使用者評分為「不熟」
- **THEN** 系統使用 Rating.Hard (2)
- **AND** 卡片間隔介於「知道」與「不知道」之間

#### Scenario: Map Unknown to Again
- **WHEN** 使用者評分為「不知道」
- **THEN** 系統使用 Rating.Again (1)
- **AND** 卡片間隔為三種評分中最短
- **AND** 卡片進入 Relearning 狀態

---

### Requirement: Due Card Selection
系統 SHALL 正確選取待複習卡片。

#### Scenario: Select cards due for review
- **WHEN** 系統查詢學習卡片
- **THEN** 選取所有 due <= 當前時間 的卡片
- **AND** 這些卡片的 state 為 LEARNING, REVIEW 或 RELEARNING

#### Scenario: Select new cards
- **WHEN** 系統查詢學習卡片
- **AND** 待複習卡片數量未達每日上限
- **THEN** 補充 state = NEW 的新卡片
- **AND** 新卡數量不超過 dailyNewCards

---

### Requirement: Daily Limits
系統 SHALL 遵循每日學習數量上限。

#### Scenario: Apply daily new card limit
- **WHEN** 系統選取學習卡片
- **THEN** 新卡數量不超過牌組設定的 dailyNewCards（預設 20）

#### Scenario: Apply daily review card limit
- **WHEN** 系統選取學習卡片
- **THEN** 複習卡數量不超過牌組設定的 dailyReviewCards（預設 100）

---

### Requirement: FSRS State Persistence
系統 SHALL 持久化 FSRS 狀態。

#### Scenario: Update card after review
- **WHEN** 使用者完成卡片評分
- **THEN** 系統更新資料庫中的 FSRS 欄位：
  - state（NEW/LEARNING/REVIEW/RELEARNING）
  - due（下次複習日期）
  - stability（穩定性）
  - difficulty（難度）
  - elapsedDays（距上次複習天數）
  - scheduledDays（排程天數）
  - reps（複習次數）
  - lapses（遺忘次數）
  - lastReview（上次複習時間）

#### Scenario: Persist review log
- **WHEN** 使用者完成卡片評分
- **THEN** 系統建立 ReviewLog 記錄：
  - cardId
  - rating
  - reviewedAt
  - 評分前後的 FSRS 狀態

