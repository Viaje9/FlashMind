## 1. 過濾規則與測試

- [x] 1.1 新增 deck detail 卡片過濾 domain（例如 `deck-detail-filter.domain.ts`），定義三種 filter（七天內、三天內、新卡）與預設全部的判斷邏輯
- [x] 1.2 先撰寫 domain 單元測試（含邊界：`now + 3 days`、`now + 7 days`、`due = null`、`state = NEW`），確認 Red 後再實作到 Green
- [x] 1.3 加入搜尋字串與 filter 交集的測試案例，確保同時生效

## 2. 頁面 UI 與狀態整合

- [x] 2.1 在 `deck-detail.component.html` 將搜尋區塊改為「搜尋輸入框 + 右側 Filter 控制項」，並補齊 `data-testid` 命名
- [x] 2.2 在 `deck-detail.component.ts` 新增 filter state（預設全部）與事件處理，改用 domain 函式產生 `filteredCards`
- [x] 2.3 實作三個選項文案與值對應（七天內到期、尚未練習的新卡片、三天內到期），確認未選擇時行為等同舊版

## 3. 驗證與文件同步

- [x] 3.1 補上 deck detail 頁面整合測試或元件測試，覆蓋三個 filter 與搜尋+filter 組合情境
- [x] 3.2 執行 `apps/web` 相關測試並修正失敗案例，確認不影響既有卡片列表功能
- [x] 3.3 檢查 testId 規範與可讀性，必要時補充 Storybook/文件範例（若該 Filter 元件有獨立展示需求）
