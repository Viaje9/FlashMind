## ADDED Requirements

### Requirement: 收藏包聊天回應可包含建議單字卡候選

收藏包後端 SHALL 在聊天訊息 API 回應中支援建議單字卡候選，並讓候選資料可直接預填既有新增快閃卡表單。

#### Scenario: 回傳建議單字卡

- **WHEN** Codex agent 判斷使用者輸入需要補充尚未建立的主要單字
- **THEN** `CollectionChatMessageResult.suggestedCards` SHALL 包含該單字候選
- **AND** 每筆候選 SHALL 包含 `front`
- **AND** 每筆候選 SHALL 包含至少一筆 `meanings`
- **AND** 每筆 `meaning` SHALL 支援 `zhMeaning`、`enExample`、`zhExample`

#### Scenario: 單字候選可說明建議原因

- **WHEN** 後端回傳單字卡候選
- **THEN** 候選 SHALL 可包含建議原因
- **AND** 前端 SHALL 能以該原因說明為什麼這個單字值得新增

#### Scenario: 不自動建立單字卡

- **WHEN** 聊天 API 回傳 `suggestedCards`
- **THEN** 後端 SHALL NOT 建立 Card
- **AND** 後端 SHALL NOT 建立 CardMeaning
- **AND** 後端 SHALL NOT 修改任何牌組卡片數量

### Requirement: Codex agent 不得建議已存在的單字卡

Codex agent SHALL 使用後端提供的單字卡搜尋結果判斷單字是否已存在，避免回傳重複的新增單字候選。

#### Scenario: 找到既有單字卡

- **WHEN** `searchUserCards` 或相關單字卡摘要中已存在候選單字
- **THEN** Codex agent SHALL NOT 將該單字放入 `suggestedCards`
- **AND** 若該單字與句子或語塊候選相關，系統 SHALL 使用既有卡片 id 作為 `sourceCardIds`

#### Scenario: 找不到既有單字卡

- **WHEN** 主要單字無法對應到使用者可存取的卡片
- **AND** 該單字有助於使用者理解或收藏本次句子/語塊
- **THEN** Codex agent MAY 將該單字放入 `suggestedCards`
- **AND** 候選不得包含捏造的既有 card id

#### Scenario: 單純翻譯不回傳單字候選

- **WHEN** 使用者明確要求只翻譯或不要卡片
- **THEN** 後端回應中的 `suggestedCards` SHALL 為空陣列
- **AND** 後端回應中的收藏候選 SHALL 為空陣列

### Requirement: 聊天 metadata 保存單字候選

收藏包後端 SHALL 保存 AI 回覆中的單字候選 metadata，讓重新載入聊天 session 時可重建 UI 狀態。

#### Scenario: 保存 AI 訊息

- **WHEN** 後端保存 assistant 聊天訊息
- **THEN** 訊息 metadata SHALL 包含本輪 `suggestedCards`
- **AND** metadata SHALL 使用可序列化 JSON

#### Scenario: 重新載入聊天訊息

- **WHEN** 前端重新取得收藏包聊天訊息
- **THEN** 系統 SHALL 回傳先前 assistant 訊息中的單字候選
- **AND** 前端 SHALL 能重新呈現單字候選卡
