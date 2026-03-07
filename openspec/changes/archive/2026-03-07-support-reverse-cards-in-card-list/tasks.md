## 1. API 契約與後端列表邏輯

- [x] 1.1 更新卡片列表 OpenAPI 契約與 generated model，讓 `CardListItem` 回傳 `cardId`、`direction`、方向對應的 `state` 與 `due`
- [x] 1.2 先補 `CardService` 單元測試，覆蓋 `enableReverse = false` 僅回傳正向項目，以及 `enableReverse = true` 會展開正向/反向兩筆項目的情境
- [x] 1.3 修改 `apps/api/src/modules/card/card.service.ts`，在查詢列表時依牌組 `enableReverse` 展開方向化項目，並為反向項目映射 `reverseState` / `reverseDue`

## 2. 前端列表資料與篩選規則

- [x] 2.1 先補 `deck-detail-filter.domain.ts` 單元測試，驗證「全部 / 新卡 / 即將到期」皆以列表項目自身的 `state` / `due` 判斷，且正面與反面項目可同時出現
- [x] 2.2 調整 `CardStore`、`DeckDetailComponent` 與相關型別，讓列表數量、搜尋與篩選皆基於展開後的列表項目
- [x] 2.3 修改編輯與刪除事件，讓列表項目使用 `cardId` 對應到底層卡片操作；反面項目刪除時沿用底層卡片刪除流程

## 3. 列表 UI 與文案

- [x] 3.1 更新牌組詳情頁卡片列表 UI，為每筆列表項目顯示方向標示，區分「正面卡片」與「反面卡片」
- [x] 3.2 調整刪除確認文案，明確說明刪除任一方向項目都會刪除整張卡片（含正反向學習資料）
- [x] 3.3 補上 deck detail 頁面或列表元件測試，覆蓋展開後列表數量、方向標示與反面項目的互動行為
