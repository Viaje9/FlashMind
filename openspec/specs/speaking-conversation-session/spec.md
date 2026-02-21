# speaking-conversation-session Specification

## Purpose

TBD - created by archiving change stateful-speaking-conversation. Update Purpose after archive.

## Requirements

### Requirement: Speaking audio chat SHALL 支援 stateful 會話

系統 MUST 在 `POST /speaking/chat/audio` 支援 stateful 會話模式，讓前端可只上傳當回合 `audioFile` 與會話識別，不必每回合重送完整歷史內容。

#### Scenario: 首回合未帶 conversationId 時建立新會話

- **WHEN** 已登入白名單使用者呼叫 `POST /speaking/chat/audio` 且未提供 `conversationId`
- **THEN** 系統建立新的 speaking 會話上下文
- **AND** 回傳 `200` 與 `data.conversationId`

#### Scenario: 後續回合使用既有 conversationId

- **WHEN** 已登入白名單使用者呼叫 `POST /speaking/chat/audio` 並提供有效 `conversationId`
- **THEN** 系統使用該會話既有上下文生成回覆
- **AND** 回傳 `200` 與相同 `data.conversationId`

### Requirement: Stateful 主流程 SHALL 不接受 history 上傳

系統 MUST 以 stateful 會話作為唯一流程，前端不得上傳 `history` 欄位（含 base64 歷史語音）。

#### Scenario: 不提供 history 仍可成功回覆

- **WHEN** 使用者提供有效 `audioFile` 與有效 `conversationId` 且未提供 `history`
- **THEN** 系統仍可完成語音對話回覆
- **AND** 不要求前端補送完整歷史 base64

#### Scenario: 提供 history 時拒絕請求

- **WHEN** 客戶端請求包含 `history` 欄位
- **THEN** 系統回傳 `400 Bad Request`
- **AND** 錯誤碼為 `VALIDATION_ERROR`

### Requirement: 會話上下文 SHALL 可控且可清理

系統 MUST 對 speaking 會話上下文實作容量控制與過期清理，避免上下文無限成長造成請求失敗或服務資源耗盡。

#### Scenario: 會話內容超出上限時裁切舊內容

- **WHEN** 會話累積內容超過系統設定上限
- **THEN** 系統裁切最舊上下文並保留最近回合
- **AND** 仍可正常處理新回合請求

#### Scenario: 會話逾期時清理

- **WHEN** 會話超過 TTL 或被清理策略淘汰
- **THEN** 系統不得再使用該舊上下文
- **AND** 後續請求依會話不存在流程處理

### Requirement: 無效會話 SHALL 回傳可辨識錯誤

系統 MUST 在 `conversationId` 無效、過期或不屬於目前使用者時，回傳可辨識錯誤，以利前端導引使用者重啟會話。

#### Scenario: conversationId 已過期或不存在

- **WHEN** 使用者提供不存在或已過期的 `conversationId`
- **THEN** 系統回傳 `409` 錯誤
- **AND** 錯誤碼為 `SPEAKING_SESSION_EXPIRED`

#### Scenario: conversationId 不屬於目前使用者

- **WHEN** 使用者提供屬於其他使用者的 `conversationId`
- **THEN** 系統回傳 `404` 或 `403`
- **AND** 不得洩漏其他會話內容

### Requirement: 回應契約 SHALL 回傳 conversationId

系統 MUST 在 `POST /speaking/chat/audio` 成功回應中包含 `conversationId`，讓前端可持續沿用同一會話。

#### Scenario: 成功回應包含會話識別

- **WHEN** speaking audio chat 請求成功
- **THEN** 回應 `data` 包含 `conversationId`
- **AND** 既有欄位（`transcript`、`audioBase64`、`model`、`usage`）維持可用
