## 1. 核心 Shuffle 邏輯

- [x] 1.1 建立 `shuffleWithSpacing` 純函式，接收 `StudyCard[]` 與 `minSpacing` 參數，回傳隨機混合且滿足正反向間隔約束的陣列
- [x] 1.2 定義模組常數 `MIN_FORWARD_REVERSE_SPACING = 5`
- [x] 1.3 撰寫 `shuffleWithSpacing` 的單元測試：驗證回傳包含相同卡片、正反向間隔 ≥ 5、卡片數不足時 best-effort 間隔

## 2. 整合至 Study Service

- [x] 2.1 修改 `study.service.ts` 的 `getStudyCards` 方法，將四個陣列合併後呼叫 `shuffleWithSpacing` 取代固定排序
- [x] 2.2 更新 `study.service` 既有單元測試，將順序斷言改為驗證 shuffle 屬性（包含正確卡片、數量正確、間隔約束）
