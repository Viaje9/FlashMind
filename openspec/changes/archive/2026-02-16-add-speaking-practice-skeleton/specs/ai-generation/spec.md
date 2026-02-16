## ADDED Requirements

### Requirement: Speaking chat 的 A2 英語夥伴回覆

系統 SHALL 在 speaking chat 情境中使用 A2 英語夥伴風格提示詞生成回覆，且不影響卡片內容生成功能。

#### Scenario: speaking chat 使用 A2 口說提示詞

- **WHEN** 使用者呼叫 `POST /speaking/chat`
- **THEN** 系統使用 A2 英語夥伴提示詞生成 assistant reply
- **AND** 回覆內容以簡短、可持續對話為目標

#### Scenario: 不影響卡片生成端點

- **WHEN** 使用者呼叫 `POST /ai/generate-card-content`
- **THEN** 系統仍依既有卡片生成規範回傳詞義與例句
- **AND** speaking chat 的提示詞策略不改變該端點行為
