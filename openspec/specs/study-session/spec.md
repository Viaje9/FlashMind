# study-session Specification

## Purpose
TBD - created by archiving change add-study-mode-fsrs. Update Purpose after archive.
## Requirements
### Requirement: Start Study Session
系統 SHALL 提供開始學習功能，讓使用者取得今日應學習的卡片。

#### Scenario: Successfully start study session
- **WHEN** 使用者請求開始學習指定牌組
- **THEN** 系統依序回傳：待複習卡片（due <= now）、新卡片（state = NEW）
- **AND** 待複習卡片按 due 升序排列
- **AND** 新卡片按建立時間排列
- **AND** 回傳數量不超過每日上限（dailyReviewCards + dailyNewCards）

#### Scenario: No cards to study
- **WHEN** 使用者請求開始學習但牌組無卡片或今日已完成學習
- **THEN** 系統回傳空陣列

#### Scenario: Unauthorized access
- **WHEN** 使用者請求學習不屬於自己的牌組
- **THEN** 系統回傳 403 Forbidden

---

### Requirement: Flip Card Learning
系統 SHALL 提供翻卡學習體驗。

#### Scenario: View card front
- **WHEN** 使用者開始學習一張卡片
- **THEN** 系統顯示卡片正面（單字/問題）

#### Scenario: Flip to card back
- **WHEN** 使用者點擊或滑動翻卡
- **THEN** 系統顯示卡片背面（中文解釋、例句、例句翻譯）
- **AND** 翻卡動畫流暢（目標 60fps）

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

