## MODIFIED Requirements

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
- **AND** 每筆詞義包含：中文解釋（含詞性標註，格式為「解釋 (詞性)」）
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

## ADDED Requirements

### Requirement: AI 生成詞性標註格式

AI 生成的中文解釋 SHALL 包含詞性標註，以幫助使用者理解單字的用法。

#### Scenario: 詞性標註格式

- **WHEN** AI 生成詞義
- **THEN** 中文解釋格式為「解釋 (詞性)」
- **AND** 詞性使用正體中文或標準縮寫（如 v.、n.、adj.、adv.）
- **AND** 詞性標註位於中文解釋後方，以空格分隔

#### Scenario: 多詞性單字

- **WHEN** 單字具有多種詞性（如 run 可作名詞或動詞）
- **THEN** 每種詞性對應一筆獨立的詞義
- **AND** 各詞義的詞性標註清楚區分

#### Scenario: 詞性標註範例

- **GIVEN** 輸入單字為 "run"
- **WHEN** AI 生成詞義
- **THEN** 可能產生：
  - `"跑步 (v.)"` 配合例句 "I run every morning."
  - `"賽跑 (n.)"` 配合例句 "He finished the run in 10 minutes."
