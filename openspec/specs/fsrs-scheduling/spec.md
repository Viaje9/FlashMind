# fsrs-scheduling Specification

## Purpose
TBD - created by archiving change add-study-mode-fsrs. Update Purpose after archive.
## Requirements
### Requirement: FSRS Integration
系統 SHALL 整合 ts-fsrs 套件實作 FSRS 演算法進行卡片排程。排程計算 SHALL 使用對應牌組的 FSRS 參數設定。

#### Scenario: Initialize new card
- **WHEN** 卡片首次進入學習
- **THEN** 系統使用 ts-fsrs 的 `createEmptyCard()` 初始化 FSRS 狀態
- **AND** 設定 state 為 NEW

#### Scenario: Calculate next review date with deck settings
- **WHEN** 使用者對卡片評分
- **THEN** 系統根據該卡片所屬牌組的 FSRS 設定建立排程器
- **AND** 使用 `fsrs(deckParams).next(card, now, rating)` 計算下次複習日期
- **AND** 更新卡片的 FSRS 欄位（due, stability, difficulty, etc.）

#### Scenario: Use default parameters when deck has no custom settings
- **WHEN** 使用者對卡片評分
- **AND** 該牌組的 FSRS 欄位皆為預設值
- **THEN** 系統使用 ts-fsrs 預設參數進行排程計算
- **AND** 行為與未設定前完全一致

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

---

### Requirement: Per-Deck FSRS Parameters
系統 SHALL 支援為每個牌組設定獨立的 FSRS 演算法參數。

#### Scenario: Deck stores FSRS parameters
- **WHEN** 牌組被建立或更新
- **THEN** 系統 SHALL 持久化以下 FSRS 參數：
  - `learningSteps`：學習步驟（預設 `"1m,10m"`）
  - `relearningSteps`：重學步驟（預設 `"10m"`）
  - `requestRetention`：目標保留率（預設 `0.9`）
  - `maximumInterval`：最大複習間隔天數（預設 `36500`）

#### Scenario: FSRS scheduler uses deck parameters
- **WHEN** 系統為某牌組的卡片計算排程
- **THEN** 系統 SHALL 使用該牌組的 `requestRetention` 作為目標保留率
- **AND** 使用該牌組的 `maximumInterval` 作為最大間隔
- **AND** 使用該牌組的 `learningSteps` 作為學習步驟
- **AND** 使用該牌組的 `relearningSteps` 作為重學步驟

#### Scenario: Cache FSRS instances
- **WHEN** 系統為同一組參數建立 FSRS 排程器
- **THEN** 系統 SHALL 快取該實例以避免重複建立
- **AND** 相同參數的牌組 SHALL 共用同一個排程器實例

---

### Requirement: Learning Steps Validation
系統 SHALL 驗證學習步驟的格式。

#### Scenario: Valid learning steps format
- **WHEN** 使用者設定 learningSteps 為 `"1m,10m"`
- **THEN** 系統接受該設定
- **AND** 解析為 ts-fsrs 格式 `["1m", "10m"]`

#### Scenario: Valid step units
- **WHEN** 使用者設定步驟值
- **THEN** 系統 SHALL 接受以下單位：`m`（分鐘）、`h`（小時）、`d`（天）
- **AND** 數字部分 SHALL 為正整數

#### Scenario: Invalid learning steps format
- **WHEN** 使用者設定 learningSteps 為無效格式（如 `"abc"` 或 `"10x"`）
- **THEN** 系統 SHALL 回傳 400 錯誤
- **AND** 錯誤訊息說明正確格式

---

### Requirement: Request Retention Validation
系統 SHALL 驗證目標保留率的範圍。

#### Scenario: Valid retention range
- **WHEN** 使用者設定 requestRetention 為 0.70 至 0.97 之間的值
- **THEN** 系統接受該設定

#### Scenario: Retention out of range
- **WHEN** 使用者設定 requestRetention 小於 0.70 或大於 0.97
- **THEN** 系統 SHALL 回傳 400 錯誤
- **AND** 錯誤訊息說明有效範圍

---

### Requirement: Maximum Interval Validation
系統 SHALL 驗證最大複習間隔的範圍。

#### Scenario: Valid interval range
- **WHEN** 使用者設定 maximumInterval 為 30 至 36500 之間的整數
- **THEN** 系統接受該設定

#### Scenario: Interval out of range
- **WHEN** 使用者設定 maximumInterval 小於 30 或大於 36500
- **THEN** 系統 SHALL 回傳 400 錯誤
- **AND** 錯誤訊息說明有效範圍

