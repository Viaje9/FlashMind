## ADDED Requirements

### Requirement: 表單未儲存變更偵測

系統 SHALL 偵測牌組設定表單是否有未儲存的變更。

#### Scenario: 初始載入無變更

- **WHEN** 牌組設定頁面載入完成
- **THEN** `hasUnsavedChanges` SHALL 為 `false`

#### Scenario: 修改欄位後有變更

- **WHEN** 使用者修改任一表單欄位（名稱、每日新卡數、每日複習數、重置時間、FSRS 參數、反向學習開關）
- **AND** 修改後的值與載入時的值不同
- **THEN** `hasUnsavedChanges` SHALL 為 `true`

#### Scenario: 修改後改回原值

- **WHEN** 使用者修改欄位後又改回與載入時相同的值
- **THEN** `hasUnsavedChanges` SHALL 為 `false`

#### Scenario: 儲存成功後重置變更狀態

- **WHEN** 使用者儲存設定成功
- **THEN** `hasUnsavedChanges` SHALL 為 `false`

---

### Requirement: 離開確認對話框

系統 SHALL 在使用者離開有未儲存變更的牌組設定頁面時彈出確認對話框。

#### Scenario: 有未儲存變更時按返回

- **WHEN** 使用者在牌組設定頁面有未儲存的變更
- **AND** 使用者按下返回按鈕或觸發路由離開
- **THEN** 系統 SHALL 彈出確認對話框
- **AND** 對話框標題為「尚未儲存」
- **AND** 對話框訊息為「設定有未儲存的變更，確定要離開嗎？」

#### Scenario: 確認對話框按取消

- **WHEN** 使用者在確認對話框按「取消」
- **THEN** 對話框關閉
- **AND** 使用者留在牌組設定頁面
- **AND** 表單內容保持不變

#### Scenario: 確認對話框按確定

- **WHEN** 使用者在確認對話框按「確定」
- **THEN** 系統 SHALL 捨棄未儲存的變更
- **AND** 直接允許路由離開
- **AND** 不執行儲存操作

#### Scenario: 無未儲存變更時按返回

- **WHEN** 使用者在牌組設定頁面無未儲存的變更
- **AND** 使用者按下返回按鈕或觸發路由離開
- **THEN** 系統 SHALL 直接允許離開
- **AND** 不彈出確認對話框
