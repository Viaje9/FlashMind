## 1. 後端 — 牌組統計修正

- [x] 1.1 在 `deck.service.ts` 的 `findAllByUserId` 方法中，將 `newCount`、`reviewCount`、`totalCount` 改為使用 `prisma.card.count` 實際查詢
- [x] 1.2 在 `deck.service.ts` 的 `findById` 方法中，將統計數據改為實際查詢，並從 `ReviewLog` 取得 `lastStudiedAt`
- [x] 1.3 在 `deck.service.ts` 加入 `CardState` import（from `@prisma/client`）

## 2. 後端 — 卡片列表 API 擴充

- [x] 2.1 在 `card.service.ts` 的 `CardListItem` interface 新增 `state` 和 `due` 欄位
- [x] 2.2 在 `card.service.ts` 的 `findAllByDeckId` 方法中，回傳 `card.state` 和 `card.due`

## 3. OpenAPI spec 與 API client

- [x] 3.1 在 `openapi/api.yaml` 的 `CardListItem` schema 新增 `state`（enum）和 `due`（nullable datetime）欄位
- [x] 3.2 執行 `pnpm --filter web generate:api` 重新產生前端 API client

## 4. 前端 — 卡片列表項目元件

- [x] 4.1 在 `card-list-item.component.ts` 新增 `state` 和 `due` input
- [x] 4.2 在 `card-list-item.component.ts` 新增 `reviewInfo` computed，根據 state/due 計算顯示文字和顏色 class
- [x] 4.3 在 `card-list-item.component.html` 的描述文字下方，新增行內式複習時間顯示（schedule icon + 文字）

## 5. 前端 — 牌組詳情頁整合

- [x] 5.1 在 `deck-detail.component.html` 的 `fm-card-list-item` 綁定 `[state]` 和 `[due]` 屬性

## 6. 驗證

- [x] 6.1 在瀏覽器中驗證牌組列表頁的統計數據正確顯示
- [x] 6.2 在瀏覽器中驗證牌組詳情頁的卡片列表顯示複習時間資訊
- [x] 6.3 確認新卡片顯示「新卡片・尚未學習」（主色文字）
