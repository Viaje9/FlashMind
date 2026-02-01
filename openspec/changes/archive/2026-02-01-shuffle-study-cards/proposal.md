## Why

目前學習會話中卡片排序為固定順序（複習卡優先 → 新卡片），使用者無法在同一場學習中交替接觸新舊內容。隨機混合排序能讓學習節奏更有變化，避免連續大量複習或連續大量新卡造成的疲勞感。

## What Changes

- 後端 `getStudyCards` 回傳的卡片順序改為隨機混合（shuffle），不再按「複習優先 → 新卡」的固定順序
- 同一張卡片的正向與反向 StudyCard 在 shuffle 後至少間隔 5 張，避免洩題
- 前端不需修改，仍按 `currentIndex` 順序遍歷

## Capabilities

### New Capabilities

（無新增能力）

### Modified Capabilities

- `study-session`: 變更「Start Study Session」的卡片排序行為，從固定順序改為隨機混合，並加入正反向間隔約束

## Impact

- **後端**：`apps/api/src/modules/study/study.service.ts` 的 `getStudyCards` 方法需修改排序邏輯
- **API 契約**：不影響，回傳格式不變，僅順序不同
- **前端**：不影響，前端已按陣列順序遍歷
- **測試**：後端 study service 的單元測試需更新以驗證 shuffle 與間隔約束
