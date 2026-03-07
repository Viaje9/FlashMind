## MODIFIED Requirements

### Requirement: 檢視牌組內卡片

使用者 SHALL 能夠檢視牌組內的所有可學習卡片，並透過搜尋與篩選縮小結果。

#### Scenario: 顯示卡片列表

- **WHEN** 使用者進入牌組詳情頁
- **THEN** 顯示該牌組內所有可見卡片的列表
- **AND** 每筆列表項目顯示底層卡片的正面文字
- **AND** 每筆列表項目顯示第一筆詞義的中文解釋（作為摘要）
- **AND** 每筆列表項目顯示複習時間資訊（行內式，位於摘要下方）
- **AND** 每筆列表項目顯示方向標示，用以區分「正面卡片」與「反面卡片」

#### Scenario: 未啟用反向學習時顯示單一方向列表項目

- **WHEN** 牌組的 `enableReverse` 為 `false`
- **AND** 使用者進入牌組詳情頁
- **THEN** 每張底層卡片僅顯示一筆列表項目
- **AND** 該列表項目的 `direction` 為 `FORWARD`

#### Scenario: 啟用反向學習時展開雙向列表項目

- **WHEN** 牌組的 `enableReverse` 為 `true`
- **AND** 使用者進入牌組詳情頁
- **THEN** 每張底層卡片 SHALL 顯示一筆 `FORWARD` 列表項目與一筆 `REVERSE` 列表項目
- **AND** 正向列表項目的 `state` / `due` 來自 `state` / `due`
- **AND** 反向列表項目的 `state` / `due` 來自 `reverseState` / `reverseDue`

#### Scenario: 未選擇篩選時顯示全部可見學習項目

- **WHEN** 使用者尚未選擇任何篩選條件
- **THEN** 卡片列表顯示所有可見列表項目
- **AND** 列表數量顯示符合目前搜尋條件與方向展開後的項目總數

#### Scenario: 過濾尚未練習的新卡片

- **WHEN** 使用者選擇「尚未練習的新卡片」篩選
- **THEN** 卡片列表僅顯示學習狀態為 NEW 的列表項目
- **AND** 正向列表項目以 `state = NEW` 判斷
- **AND** 反向列表項目以 `reverseState = NEW` 對應後的列表項目狀態判斷

#### Scenario: 過濾近期到期的卡片

- **WHEN** 使用者選擇任一到期篩選條件
- **THEN** 卡片列表僅顯示學習狀態非 NEW 且 `due` 落在指定時間範圍內的列表項目
- **AND** 正向與反向列表項目皆以各自方向對應的 `due` 值判斷

#### Scenario: 搜尋與篩選同時生效

- **WHEN** 使用者輸入搜尋關鍵字
- **AND** 使用者選擇任一篩選條件
- **THEN** 卡片列表僅顯示同時符合搜尋條件與篩選條件的列表項目

#### Scenario: 卡片列表 API 回傳方向化項目

- **WHEN** 前端呼叫卡片列表 API（GET /api/decks/:deckId/cards）
- **THEN** 每筆列表項目回傳底層卡片的 `cardId`
- **AND** 每筆列表項目回傳 `direction` 欄位（`FORWARD` 或 `REVERSE`）
- **AND** 每筆列表項目回傳該方向的 `state` 欄位（`NEW`、`LEARNING`、`REVIEW`、`RELEARNING`）
- **AND** 每筆列表項目回傳該方向的 `due` 欄位（ISO 8601 UTC 時間戳，新卡片為 null）

#### Scenario: 從任一方向列表項目編輯卡片

- **WHEN** 使用者從正面或反面列表項目點擊編輯
- **THEN** 系統 SHALL 導向相同的底層卡片編輯頁面

#### Scenario: 從任一方向列表項目刪除卡片

- **WHEN** 使用者從正面或反面列表項目點擊刪除
- **THEN** 系統 SHALL 刪除同一張底層卡片
- **AND** 該卡片對應的正向與反向列表項目一併從列表移除
- **AND** 確認文案清楚說明會刪除整張卡片（含正反向學習資料）
