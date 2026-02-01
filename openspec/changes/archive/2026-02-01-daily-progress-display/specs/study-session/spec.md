## MODIFIED Requirements

### Requirement: Study Summary with Reverse（修改）

系統 SHALL 在學習統計摘要中額外回傳每日限額與今日已學細項。

#### Scenario: 回傳擴充的學習摘要

- **WHEN** 前端呼叫 `GET /decks/{deckId}/study/summary`
- **THEN** 除原有的 `totalCards`、`newCount`、`reviewCount`、`todayStudied` 外
- **AND** SHALL 額外回傳 `dailyNewCards`（number，牌組每日新卡上限）
- **AND** SHALL 額外回傳 `dailyReviewCards`（number，牌組每日複習上限）
- **AND** SHALL 額外回傳 `todayNewStudied`（number，今日已學新卡數）
- **AND** SHALL 額外回傳 `todayReviewStudied`（number，今日已複習數）
