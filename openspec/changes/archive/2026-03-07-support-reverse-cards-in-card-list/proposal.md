## Why

目前牌組詳情頁的卡片列表以底層 `Card` 為單位顯示，因此在啟用反向學習時仍只會看到 1,000 筆列表項目；但牌組統計與學習排程已經把正向與反向視為兩個獨立的可學習面向。這會造成列表總數、`新卡片` 篩選結果與牌組統計之間的語意不一致，使用者也無法直接檢視哪些反向卡仍未練習或即將到期。

## What Changes

- 擴充牌組卡片列表 API，在 `enableReverse = true` 時將每張底層卡片展開為 `FORWARD` 與 `REVERSE` 兩筆列表項目；未啟用反向時維持僅回傳正向項目。
- 調整卡片列表項目 schema，讓每筆項目回傳底層 `cardId`、列表項目的 `direction`，以及對應方向的 `state` / `due`。
- 牌組詳情頁改以展開後的學習項目作為列表資料來源，讓「全部」數量、搜尋、到期篩選與「尚未練習的新卡片」篩選都以方向對應的排程資料判斷。
- 前端在每筆列表項目加上方向標示，明確區分「正面卡片」與「反面卡片」。
- 既有編輯/刪除操作仍作用於底層卡片；當使用者從反面列表項目觸發刪除時，確認文案需清楚說明會刪除整張卡片（含正反兩個學習方向）。

## Capabilities

### New Capabilities

- （無）

### Modified Capabilities

- `card-management`: 牌組詳情頁卡片列表改為以學習方向展開，並提供可辨識正面/反面卡片的顯示與操作規則。

## Impact

- 規格：`openspec/specs/card-management/spec.md`（新增/調整需求情境）
- OpenAPI：`CardListItem` 需新增 `cardId` 與 `direction` 欄位，並明確定義 `state` / `due` 為該方向的排程狀態
- 後端：`apps/api/src/modules/card/card.service.ts` 需依牌組 `enableReverse` 展開列表項目，並更新對應單元測試
- 前端：`apps/web/src/app/pages/deck-detail/` 的列表數量、篩選邏輯、編輯/刪除事件與列表項目 UI 需改為處理方向化資料
