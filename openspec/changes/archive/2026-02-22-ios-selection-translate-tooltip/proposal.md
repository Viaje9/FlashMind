## Why

目前口說練習的 AI 回覆雖可閱讀，但缺少「選取片段後立即翻譯」的低摩擦操作。對 iOS PWA 而言，原生文字選取選單無法直接銜接產品內翻譯流程，因此需要可控的自訂互動來縮短理解路徑。

## What Changes

- 在口說練習的 AI 回覆文字上新增「選取文字」互動，特別針對 iOS PWA 覆蓋原生選取後行為。
- 使用者選取文字時顯示自訂操作按鈕「翻譯」。
- 點擊「翻譯」後顯示 tooltip，內含翻譯載入狀態、翻譯結果與錯誤提示。
- 定義非 iOS 平台的相容策略（不影響既有選取能力，必要時退回原生行為）。

## Capabilities

### New Capabilities

- `speaking-selection-translate`: 在口說 AI 訊息中提供可攔截的文字選取操作，並以 tooltip 呈現即時翻譯結果（優先支援 iOS PWA）。

### Modified Capabilities

（無）

## Impact

- 前端：`apps/web` 口說頁訊息元件、文字選取事件處理、tooltip UI 與行動裝置相容處理。
- API：沿用既有翻譯能力；若現況缺少可直接使用的翻譯端點，需補充 speaking 翻譯契約與 client 使用點。
- 測試：新增 iOS/PWA 選取互動與 tooltip 翻譯流程測試（元件測試與 E2E 驗證）。
