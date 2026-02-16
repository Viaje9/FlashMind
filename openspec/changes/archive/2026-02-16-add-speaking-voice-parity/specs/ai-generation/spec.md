## MODIFIED Requirements

### Requirement: Speaking chat 使用 A2 英語夥伴提示詞

系統 SHALL 在 speaking 對話場景使用 A2 英語夥伴提示詞生成回覆，並支援 systemPrompt 覆蓋；此能力不改變卡片生成用途。

#### Scenario: 語音口說對話使用 A2 英語夥伴策略

- **WHEN** 使用者呼叫 `POST /speaking/chat/audio` 或 `POST /speaking/chat`
- **THEN** 系統以 A2 英語夥伴提示詞生成可持續對話回覆
- **AND** 若 request 帶入 `systemPrompt`，系統以該設定覆蓋預設提示詞

#### Scenario: speaking summarize 與 translate 採專用提示詞

- **WHEN** 使用者呼叫 `POST /speaking/summarize` 或 `POST /speaking/translate`
- **THEN** 系統使用 speaking 專用摘要/翻譯提示詞生成結果

#### Scenario: 不影響卡片內容生成

- **WHEN** 使用者呼叫 `POST /ai/generate-card-content`
- **THEN** 系統仍依既有卡片生成規範回傳詞義與例句
- **AND** speaking prompt 調整不改變該端點行為
