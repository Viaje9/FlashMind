## 1. 擴充方向篩選 domain

- [x] 1.1 先為 `apps/web/src/app/pages/deck-detail/deck-detail-filter.domain.ts` 補上方向篩選的單元測試，覆蓋 `全部卡面`、`正面卡片`、`反面卡片` 與不存在反面卡時的顯示條件
- [x] 1.2 擴充 deck detail filter domain，新增卡面方向 enum／型別與交集過濾邏輯，讓搜尋、既有 filter 與方向條件可同時運作
- [x] 1.3 補上排序與方向篩選共存的測試案例，確認新增條件不影響既有依到期日排序行為

## 2. 整合牌組詳情頁 UI 與狀態

- [x] 2.1 在 `deck-detail.component.ts` 新增方向篩選 state、選項文案與 `REVERSE` 可見性判斷，當列表沒有反面卡時隱藏下拉選單
- [x] 2.2 在 `deck-detail.component.html` 加入卡面方向下拉選單與對應 `data-testid`，並調整既有 filter/sort 區塊排版以兼容桌機與手機
- [x] 2.3 將 `filteredCards` 計算改為同時套用搜尋字串、既有篩選條件與卡面方向，確認空狀態與列表數量顯示一致

## 3. 驗證與回歸

- [x] 3.1 補上 deck detail 頁面的元件或整合測試，覆蓋反面卡存在時顯示方向下拉、只有正面卡時隱藏，以及方向切換後的列表結果
- [x] 3.2 執行 `apps/web` 相關測試並修正失敗案例，確認卡片列表既有搜尋、Filter 與排序功能未回歸
- [x] 3.3 檢查 testId、文案與互動命名是否符合專案規範，必要時同步更新相關文件或 Storybook 展示
