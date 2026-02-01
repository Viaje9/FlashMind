# reverse-card Specification

## Purpose
反向學習功能，讓使用者可以從中文提示回想英文單字，支援雙向 FSRS 排程。

## Requirements

### Requirement: 反向學習資料模型

系統 SHALL 在每張卡片上存放兩組獨立的 FSRS 排程參數，分別追蹤正向與反向的記憶狀態。

#### Scenario: 卡片具備雙組 FSRS 排程欄位

- **WHEN** 系統建立卡片
- **THEN** 卡片 SHALL 具備正向 FSRS 排程欄位（`state`/`due`/`stability`/`difficulty`/`elapsedDays`/`scheduledDays`/`reps`/`lapses`/`lastReview`）
- **AND** 卡片 SHALL 具備反向 FSRS 排程欄位（`reverseState`/`reverseDue`/`reverseStability`/`reverseDifficulty`/`reverseElapsedDays`/`reverseScheduledDays`/`reverseReps`/`reverseLapses`/`reverseLastReview`）
- **AND** 正向欄位預設：`state = NEW`，其餘為 null 或 0
- **AND** 反向欄位預設：`reverseState = NEW`，其餘為 null 或 0

#### Scenario: 正向與反向排程互不干擾

- **WHEN** 使用者對卡片進行正向學習評分
- **THEN** 系統 SHALL 只更新正向 FSRS 排程欄位
- **AND** 反向 FSRS 排程欄位 SHALL NOT 被影響

#### Scenario: 反向評分不影響正向排程

- **WHEN** 使用者對卡片進行反向學習評分
- **THEN** 系統 SHALL 只更新反向 FSRS 排程欄位
- **AND** 正向 FSRS 排程欄位 SHALL NOT 被影響

---

### Requirement: 牌組層級反向學習開關

系統 SHALL 在牌組層級提供 `enableReverse` 開關，控制該牌組是否啟用反向學習。

#### Scenario: 牌組預設不啟用反向學習

- **WHEN** 使用者建立新牌組
- **THEN** 牌組的 `enableReverse` SHALL 為 `false`

#### Scenario: 啟用反向學習

- **WHEN** 使用者在牌組設定頁面開啟「啟用反向學習」toggle
- **AND** 使用者儲存設定
- **THEN** 牌組的 `enableReverse` SHALL 更新為 `true`
- **AND** 下次學習時 SHALL 包含反向 StudyCard

#### Scenario: 關閉反向學習

- **WHEN** 使用者在牌組設定頁面關閉「啟用反向學習」toggle
- **AND** 使用者儲存設定
- **THEN** 牌組的 `enableReverse` SHALL 更新為 `false`
- **AND** 下次學習時 SHALL NOT 包含反向 StudyCard
- **AND** 卡片的反向 FSRS 排程資料 SHALL 保留不刪除（以便未來重新啟用）

#### Scenario: 牌組設定頁面顯示

- **WHEN** 使用者進入牌組設定頁面
- **THEN** SHALL 顯示「啟用反向學習」toggle
- **AND** toggle 狀態反映牌組目前的 `enableReverse` 設定

---

### Requirement: 反向學習顯示邏輯

系統 SHALL 在反向學習時交換卡片的正反面顯示。

#### Scenario: 反向卡正面顯示

- **WHEN** 使用者學習一張反向 StudyCard
- **THEN** 卡片正面 SHALL 顯示所有中文翻譯（以全形分號「；」連接）
- **AND** 正面 SHALL 作為提示（要求使用者回想英文）

#### Scenario: 反向卡反面顯示

- **WHEN** 使用者翻開反向 StudyCard
- **THEN** 卡片反面 SHALL 顯示英文單字（`front` 欄位）
- **AND** SHALL 顯示完整的詞義資訊（含 enExample/zhExample）
- **AND** 翻卡動畫流暢（目標 60fps）

#### Scenario: 正向卡正面顯示（不變）

- **WHEN** 使用者學習一張正向 StudyCard
- **THEN** 卡片正面 SHALL 顯示英文單字（`front` 欄位）

#### Scenario: 正向卡反面顯示（不變）

- **WHEN** 使用者翻開正向 StudyCard
- **THEN** 卡片反面 SHALL 顯示中文翻譯與例句

---

### Requirement: 同一張卡片產生雙向 StudyCard

系統 SHALL 在啟用反向學習時，為同一張卡片產生正向與反向兩個 StudyCard。

#### Scenario: 啟用反向時回傳雙向 StudyCard

- **WHEN** 牌組的 `enableReverse` 為 `true`
- **AND** 使用者請求學習卡片
- **THEN** 每張符合排程的卡片 SHALL 可同時以 FORWARD 和 REVERSE 方向出現
- **AND** 正向 StudyCard 的 `direction` 為 `FORWARD`
- **AND** 反向 StudyCard 的 `direction` 為 `REVERSE`
- **AND** 兩個 StudyCard 的 `id` 相同（同一張卡片）
- **AND** 兩個 StudyCard 的 `state` 分別來自正向與反向排程

#### Scenario: 未啟用反向時只回傳正向 StudyCard

- **WHEN** 牌組的 `enableReverse` 為 `false`
- **AND** 使用者請求學習卡片
- **THEN** 系統 SHALL 只回傳 FORWARD 方向的 StudyCard
- **AND** SHALL NOT 查詢或回傳反向排程

---

### Requirement: ReviewLog 記錄學習方向

系統 SHALL 在 ReviewLog 中記錄每次評分的學習方向。

#### Scenario: 正向評分記錄

- **WHEN** 使用者對正向 StudyCard 進行評分
- **THEN** ReviewLog 的 `direction` SHALL 為 `FORWARD`

#### Scenario: 反向評分記錄

- **WHEN** 使用者對反向 StudyCard 進行評分
- **THEN** ReviewLog 的 `direction` SHALL 為 `REVERSE`

#### Scenario: ReviewLog 保留完整前後狀態

- **WHEN** 系統建立 ReviewLog
- **THEN** SHALL 記錄評分前的狀態（`prevState`/`prevStability`/`prevDifficulty`）
- **AND** SHALL 記錄評分後的狀態（`newState`/`newStability`/`newDifficulty`/`scheduledDays`）
- **AND** 前後狀態 SHALL 來自對應 direction 的 FSRS 排程欄位
