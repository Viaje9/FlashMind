## ADDED Requirements

### Requirement: 設定今日學習上限覆寫

系統 SHALL 提供 API 讓使用者設定指定牌組的今日學習上限覆寫。覆寫值只能高於或等於牌組的預設上限。覆寫僅在當日學習日有效，隔天自動失效。

#### Scenario: 成功設定今日覆寫

- **WHEN** 使用者呼叫 `PUT /decks/{deckId}/daily-override` 並提供 `newCards` 和/或 `reviewCards`
- **THEN** 系統 SHALL 將 `overrideDate` 設為當前學習日的起始時間（根據 `dailyResetHour` 計算）
- **AND** 系統 SHALL 將 `overrideNewCards` 設為提供的 `newCards` 值（若有提供）
- **AND** 系統 SHALL 將 `overrideReviewCards` 設為提供的 `reviewCards` 值（若有提供）

#### Scenario: 只覆寫其中一項

- **WHEN** 使用者僅提供 `newCards` 而未提供 `reviewCards`（或反之）
- **THEN** 系統 SHALL 只更新有提供的欄位
- **AND** 未提供的欄位 SHALL 設為 null（使用牌組預設值）

#### Scenario: 覆寫值低於預設值時拒絕

- **WHEN** 使用者提供的 `newCards` 小於牌組的 `dailyNewCards`
- **THEN** 系統 SHALL 回傳 422 錯誤，錯誤碼 `OVERRIDE_BELOW_DEFAULT`
- **AND** 錯誤訊息 SHALL 說明覆寫值必須大於或等於預設值

#### Scenario: 覆寫值低於預設值時拒絕（複習卡）

- **WHEN** 使用者提供的 `reviewCards` 小於牌組的 `dailyReviewCards`
- **THEN** 系統 SHALL 回傳 422 錯誤，錯誤碼 `OVERRIDE_BELOW_DEFAULT`

#### Scenario: 覆寫隔天自動失效

- **WHEN** 學習日重置後（跨過 `dailyResetHour`）
- **THEN** 系統 SHALL 使用牌組的預設上限值
- **AND** 不需要主動清除覆寫資料，因 `overrideDate` 不再匹配當前學習日

#### Scenario: 重複設定覆寫取代前次

- **WHEN** 使用者在同一個學習日內多次設定覆寫
- **THEN** 系統 SHALL 以最新的設定取代先前的覆寫

#### Scenario: 未授權存取

- **WHEN** 使用者嘗試設定不屬於自己的牌組的覆寫
- **THEN** 系統 SHALL 回傳 403 Forbidden

### Requirement: 計算有效每日上限

系統 SHALL 在所有涉及每日上限的邏輯中使用「有效上限」（effective limit），即考慮覆寫後的實際上限值。

#### Scenario: 覆寫有效時使用覆寫值

- **WHEN** 牌組的 `overrideDate` 等於當前學習日的起始時間
- **THEN** 系統 SHALL 使用 `overrideNewCards`（若非 null）作為有效新卡上限
- **AND** 系統 SHALL 使用 `overrideReviewCards`（若非 null）作為有效複習上限
- **AND** 未覆寫的項目 SHALL 使用牌組的預設值

#### Scenario: 覆寫無效或不存在時使用預設值

- **WHEN** 牌組的 `overrideDate` 為 null 或不等於當前學習日
- **THEN** 系統 SHALL 使用 `dailyNewCards` 作為有效新卡上限
- **AND** 系統 SHALL 使用 `dailyReviewCards` 作為有效複習上限

#### Scenario: 覆寫值與預設值的安全取大

- **WHEN** 使用者設定覆寫後又修改了牌組預設值，導致預設值超過覆寫值
- **THEN** 系統 SHALL 取 `max(overrideValue, defaultValue)` 作為有效上限
- **AND** 確保覆寫永遠不會導致上限降低

### Requirement: 牌組詳情頁今日上限調整 UI

系統 SHALL 在牌組詳情頁提供調整今日學習上限的操作入口。

#### Scenario: 顯示調整入口

- **WHEN** 使用者進入牌組詳情頁
- **THEN** 今日進度區域 SHALL 顯示「調整今日上限」的操作入口

#### Scenario: 設定覆寫值

- **WHEN** 使用者點擊「調整今日上限」
- **THEN** 系統 SHALL 提供新卡上限與複習上限的輸入介面
- **AND** 輸入欄位的最小值 SHALL 為牌組的預設上限值
- **AND** 輸入欄位的預設值 SHALL 為當前有效上限

#### Scenario: 送出覆寫

- **WHEN** 使用者填入覆寫值並確認
- **THEN** 系統 SHALL 呼叫覆寫 API 並更新畫面上的進度顯示
- **AND** 進度分母 SHALL 立即反映新的有效上限

#### Scenario: 覆寫已啟用時顯示提示

- **WHEN** 當前學習日已有覆寫設定
- **THEN** 系統 SHALL 在進度區域顯示覆寫已啟用的視覺提示
- **AND** 使用者 SHALL 可以重新調整或清除覆寫
