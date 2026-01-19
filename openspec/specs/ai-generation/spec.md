# ai-generation Specification

## Purpose
TBD - created by archiving change add-ai-content-features. Update Purpose after archive.
## Requirements
### Requirement: AI 生成卡片內容

系統 SHALL 提供 AI 生成卡片背面內容的功能，降低使用者建卡成本。

#### Scenario: 觸發 AI 生成

- **WHEN** 使用者在卡片編輯器中輸入正面文字
- **AND** 點擊「AI 生成」按鈕
- **THEN** 系統呼叫 AI 服務生成詞義與例句

#### Scenario: 顯示載入狀態

- **WHEN** AI 生成進行中
- **THEN** 顯示載入指示器（如 spinner）
- **AND** 「AI 生成」按鈕進入停用狀態

#### Scenario: 生成成功

- **WHEN** AI 生成完成
- **THEN** 生成的詞義自動填入詞義區塊
- **AND** 每筆詞義包含：中文解釋
- **AND** 每筆詞義可能包含：英文例句
- **AND** 每筆詞義可能包含：中文例句翻譯
- **AND** 載入狀態結束

#### Scenario: 生成失敗

- **WHEN** AI 生成失敗（網路錯誤、API 錯誤等）
- **THEN** 顯示錯誤訊息
- **AND** 提供「重試」選項
- **AND** 載入狀態結束

#### Scenario: 編輯生成內容

- **WHEN** AI 生成完成
- **THEN** 使用者可編輯所有生成的內容
- **AND** 使用者可刪除不需要的詞義區塊

#### Scenario: 正面為空時不可生成

- **WHEN** 正面欄位為空
- **THEN** 「AI 生成」按鈕停用或隱藏
- **AND** 無法觸發 AI 生成

---

### Requirement: AI 生成 API

後端 SHALL 提供 AI 內容生成的 API 端點。

#### Scenario: 呼叫生成 API

- **WHEN** 前端發送 `POST /ai/generate-card-content` 請求
- **AND** 請求包含 `text` 欄位（正面文字）
- **AND** 使用者已登入
- **THEN** 系統呼叫 OpenAI API 生成內容
- **AND** 回傳生成的詞義陣列

#### Scenario: 未登入時拒絕

- **WHEN** 未登入使用者呼叫 AI 生成 API
- **THEN** 回傳 401 Unauthorized 錯誤

#### Scenario: 輸入為空時拒絕

- **WHEN** 請求的 `text` 欄位為空
- **THEN** 回傳 400 Bad Request 錯誤
- **AND** 錯誤訊息說明需要輸入文字

