## Why

目前牌組設定頁面（deck-settings）的按鈕配置不夠理想：「儲存」與「取消」垂直排列，「刪除」放在上方的「危險區域」。此外，當使用者修改設定後直接按返回鍵離開，未儲存的變更會直接遺失，沒有任何提示。需要改善按鈕排列與新增離開確認機制。

## What Changes

- 調整牌組設定頁面按鈕配置：
  - 「儲存」按鈕移至頁面 Header 右側，與標題「牌組設定」同一行
  - 移除「取消」按鈕（由離開確認機制取代）
  - 「刪除牌組」按鈕移至頁面最下方，使用深紅色低調樣式降低誤觸風險
- 新增離開確認機制：
  - 偵測表單是否有未儲存的變更
  - 使用者按返回鍵離開時，若有未儲存變更，跳出確認對話框
  - 對話框提供「取消」（留在頁面）與「確定」（捨棄變更直接離開）兩個選項

## Capabilities

### New Capabilities

- `unsaved-changes-guard`: 表單未儲存變更的離開確認機制

### Modified Capabilities

- `deck-management`: 牌組設定頁面按鈕配置調整（儲存移至 Header、移除取消、刪除移至底部深紅色）

## Impact

- 前端：`apps/web/src/app/pages/deck-settings/deck-settings.component.html` 按鈕排版調整
- 前端：`apps/web/src/app/pages/deck-settings/deck-settings.component.ts` 新增表單髒值偵測與離開確認邏輯
- 前端：可能需要新增路由守衛（CanDeactivate guard）或使用對話框處理離開確認
