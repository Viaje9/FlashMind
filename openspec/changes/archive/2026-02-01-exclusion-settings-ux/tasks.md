## 1. 牌組設定頁面按鈕配置調整

- [x] 1.1 修改 `deck-settings.component.html`：將「儲存」按鈕移至 `fm-page-header` 的 `.fm-header-right` slot，使用 `variant="primary"`，與標題「牌組設定」同一行靠右顯示
- [x] 1.2 移除「取消」按鈕及對應的 `onCancel()` 方法
- [x] 1.3 修改 `deck-settings.component.html`：移除「危險區域」section heading 與說明文字，將「刪除牌組」按鈕移至頁面最底部，使用自訂深紅色低調樣式（`bg-red-950/60`、`text-red-300`、`border-red-900/30`）與全寬顯示
- [x] 1.4 調整刪除按鈕與表單區域的間距（`pt-16`），降低誤觸風險

## 2. 表單未儲存變更偵測

- [x] 2.1 在 `DeckSettingsComponent` 中新增 `originalValues` signal，於 `loadDeck` 完成後儲存所有表單欄位的初始值（name、dailyNewCards、dailyReviewCards、dailyResetHour、enableReverse、FSRS 參數）
- [x] 2.2 新增 `hasUnsavedChanges` computed signal，比對所有 FormControl 當前值與 `originalValues` 是否一致
- [x] 2.3 確保 `onSave` 成功後重置 `originalValues` 為當前值

## 3. 離開確認機制

- [x] 3.1 在 `DeckSettingsComponent` 實作 `canDeactivate` 方法供 guard 呼叫
- [x] 3.2 建立 `unsavedChangesGuard`（functional guard），檢查 component 的 `hasUnsavedChanges()`，若有變更則開啟確認對話框
- [x] 3.3 確認對話框：標題「尚未儲存」、訊息「設定有未儲存的變更，確定要離開嗎？」、按「確定」捨棄變更直接離開、按「取消」留在頁面
- [x] 3.4 將 guard 註冊至 deck-settings 的路由設定（`canDeactivate`）
- [x] 3.5 處理返回按鈕的 routerLink：改為程式化導航（`onBack()`），讓 CanDeactivate guard 能攔截
