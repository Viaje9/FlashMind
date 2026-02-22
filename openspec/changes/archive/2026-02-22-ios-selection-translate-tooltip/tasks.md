## 1. 選取互動與 iOS PWA 覆蓋基礎

- [x] 1.1 在 speaking 訊息區加入文字選取偵測（僅 assistant 逐字稿），並建立選取清除/失焦收合流程。
- [x] 1.2 實作 iOS standalone 偵測與 `contextmenu` 攔截策略，讓自訂「翻譯」操作可優先使用。
- [x] 1.3 在 `speaking.component.html` 新增自訂選取操作按鈕（翻譯）與定位邏輯，避免影響既有播放/翻譯按鈕。

## 2. Tooltip 翻譯流程與狀態機

- [x] 2.1 新增選取片段翻譯狀態（idle/loading/success/error）與 request token 機制，避免舊回應覆蓋新選取。
- [x] 2.2 串接既有 `translateSpeakingText` API 以翻譯選取文字，並加入 `messageId + selectedText` 快取。
- [x] 2.3 建立 tooltip UI（載入、成功、失敗、重試）與 viewport 邊界修正，確保行動裝置可讀性。
- [x] 2.4 實作裝置限制 fallback：即使原生選單仍顯示，使用者仍可走自訂翻譯流程。

## 3. 測試與驗收

- [x] 3.1 撰寫 speaking store / domain 測試（Red）覆蓋片段翻譯快取、錯誤處理與競態丟棄。
- [x] 3.2 完成元件測試（Green）驗證 assistant 選取才顯示「翻譯」、清除選取會隱藏。
- [x] 3.3 補 E2E 測試流程（含 iOS 導向情境）：選取文字 → 點翻譯 → 顯示 tooltip 翻譯結果。
- [x] 3.4 執行回歸檢查，確認既有整則訊息翻譯按鈕與語音播放互動不受影響。
