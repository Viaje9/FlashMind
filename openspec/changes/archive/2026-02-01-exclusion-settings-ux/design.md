## Context

牌組設定頁面目前的按鈕配置：
- 頁面上方「危險區域」區塊中有「刪除牌組」按鈕（ghost variant，紅色文字）
- 頁面底部「儲存設定」與「取消」按鈕垂直排列（各佔一行）

使用者希望：
1. 「儲存」按鈕移至 Header 右側，與標題同一行
2. 移除「取消」按鈕，因為有離開確認機制可取代
3. 「刪除」移至最下方，使用深紅色低調樣式降低誤觸
4. 按返回鍵離開時，若有未儲存變更需彈出確認框

## Goals / Non-Goals

**Goals:**
- 改善牌組設定頁面的按鈕排列，提升操作直覺性
- 「儲存」按鈕放在 Header 右側，方便隨時儲存
- 「刪除」按鈕以深紅色低調樣式凸顯危險性，並放在最底部降低誤觸
- 偵測表單異動，在使用者離開前提示確認
- 確認框提供「取消」（留在頁面）與「確定」（捨棄變更離開）選項

**Non-Goals:**
- 不修改其他頁面的按鈕配置
- 不新增瀏覽器 `beforeunload` 事件處理（僅處理 Angular 路由離開）
- 不修改刪除確認對話框的邏輯

## Decisions

### D1: 按鈕排列方式

```
[ ← ] 牌組設定                [儲存]     ← Header 內，儲存按鈕靠右
─────────────────────────────────────
（表單內容）

              （間距）

[ 🔴 刪除牌組 ]               ← 深紅色低調按鈕，全寬，放在最底部
```

- 「儲存」按鈕使用 `variant="primary"`，放在 `fm-page-header` 的 `.fm-header-right` slot 中
- 移除「取消」按鈕（離開確認機制已能處理未儲存的情況）
- 「刪除牌組」按鈕使用自訂深紅色樣式（`bg-red-950/60`、`text-red-300`、`border-red-900/30`），與表單區域保持較大間距（`pt-16`）
- 移除原本的「危險區域」section heading 與說明文字

### D2: 表單髒值偵測方式

使用手動比對方式偵測表單是否有變更：
- 在 `loadDeck` 載入資料後，將初始值存入一個 `originalValues` signal
- 提供一個 `hasUnsavedChanges` computed signal，比對所有 FormControl 當前值與初始值是否一致
- 理由：目前表單使用多個獨立 FormControl 而非 FormGroup，手動比對最直接

### D3: 離開確認機制 — CanDeactivate Guard

使用 Angular 的 `CanDeactivate` 路由守衛：
- 建立 `UnsavedChangesGuard`，在路由離開時檢查 component 的 `hasUnsavedChanges()`
- 若有未儲存變更，使用 `DialogService` 開啟確認對話框
- 對話框內容：
  - 標題：「尚未儲存」
  - 訊息：「設定有未儲存的變更，確定要離開嗎？」
  - 確定按鈕：捨棄變更直接離開
  - 取消按鈕：留在當前頁面
- 此 guard 僅套用於 deck-settings 路由

### D4: 確認框的「確定」行為 — 捨棄變更離開

使用者按「確定」時：
1. 直接允許路由離開
2. 不執行儲存操作
3. 未儲存的變更將被捨棄

## Risks / Trade-offs

- **風險**：CanDeactivate guard 只能攔截 Angular 路由內的導航，無法攔截瀏覽器的返回、關閉分頁等操作。但作為 PWA 應用，使用者主要透過 app 內按鈕導航，此限制可接受。
- **取捨**：選擇不使用 Angular `FormGroup.dirty` 而用手動比對，因為目前已是多個獨立 FormControl 的架構，改為 FormGroup 改動範圍過大。
