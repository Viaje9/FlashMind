## MODIFIED Requirements

### Requirement: 檢視牌組內卡片

使用者 SHALL 能夠檢視牌組內的所有卡片。

#### Scenario: 顯示牌組摘要

- **WHEN** 使用者進入牌組詳情頁
- **THEN** 顯示牌組摘要資訊
- **AND** 摘要包含：新卡數、待複習數、建立時間、上次複習時間

#### Scenario: 顯示卡片列表

- **WHEN** 使用者進入牌組詳情頁
- **THEN** 顯示該牌組內所有卡片的列表
- **AND** 每張卡片顯示正面文字
- **AND** 每張卡片顯示第一筆詞義的中文解釋（作為摘要）
- **AND** 每張卡片顯示複習時間資訊（行內式，位於摘要下方）

#### Scenario: 卡片複習時間顯示 — 新卡片

- **WHEN** 卡片學習狀態為 NEW
- **THEN** 複習時間顯示「新卡片・尚未學習」
- **AND** 文字顏色為主色（primary）

#### Scenario: 卡片複習時間顯示 — 即將到期

- **WHEN** 卡片學習狀態非 NEW
- **AND** 下次複習時間在未來 24 小時內
- **THEN** 複習時間顯示「X 小時後到期」或「X 分鐘後到期」
- **AND** 文字顏色為綠色（emerald）

#### Scenario: 卡片複習時間顯示 — 已逾期

- **WHEN** 卡片學習狀態非 NEW
- **AND** 下次複習時間已過
- **THEN** 複習時間顯示「已逾期 X 天」或「今天到期」
- **AND** 文字顏色為紅色（red）

#### Scenario: 卡片複習時間顯示 — 未來複習

- **WHEN** 卡片學習狀態非 NEW
- **AND** 下次複習時間超過 24 小時
- **THEN** 複習時間顯示「X 天後」
- **AND** 文字顏色為灰色（slate）

#### Scenario: 卡片列表 API 回傳學習狀態

- **WHEN** 前端呼叫卡片列表 API（GET /api/decks/:deckId/cards）
- **THEN** 每張卡片回傳 `state` 欄位（NEW、LEARNING、REVIEW、RELEARNING）
- **AND** 每張卡片回傳 `due` 欄位（ISO 8601 UTC 時間戳，新卡片為 null）

#### Scenario: 開始學習入口

- **WHEN** 使用者檢視牌組詳情頁
- **THEN** 提供「開始學習」按鈕
- **AND** 點擊後進入該牌組的學習模式

#### Scenario: 卡片列表為空

- **WHEN** 使用者進入牌組詳情頁
- **AND** 牌組內尚無任何卡片
- **THEN** 顯示空狀態提示「尚無卡片」
- **AND** 顯示引導使用者新增卡片的按鈕
