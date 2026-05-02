## Context

FlashMind 目前已有 `/home`、`/decks`、`/speaking` 等主要入口，並以深色介面作為實際使用時的主要視覺語言。收藏包功能已在 `prototype/收藏包/code.html` 中驗證資訊架構，接下來需要將 UI 寫回 Angular 專案，但本階段不接 API、不新增資料庫，也不處理真正的 AI 分析流程。

這次變更的主要利害關係是前端資訊架構與 UI 一致性：收藏包需要看起來像 FlashMind 的正式頁面，而不是嵌入一份獨立 prototype。

## Goals / Non-Goals

**Goals:**

- 新增收藏包列表頁，讓使用者可以瀏覽句子、搭配詞、片語、子句。
- 新增聊天式「新增收藏」頁面 UI，模擬使用者輸入內容後，AI 列出可收藏的句子與語塊。
- 使用靜態 mock data 與前端狀態模擬分類、搜尋、加入與移除。
- 沿用既有 routing、page header、button、search input 等共用 UI 元件；收藏包特有卡片在 feature 內共置。
- 保持 FlashMind 目前深色視覺，包含 `background-dark`、`surface-dark`、`card-dark`、primary cyan、slate 灰階與既有圓角節奏。

**Non-Goals:**

- 不串接 OpenAI、Claude 或任何後端 API。
- 不新增 OpenAPI 契約、NestJS module、Prisma schema 或資料庫 migration。
- 不建立正式收藏資料模型與持久化儲存。
- 不把收藏包卡片抽成 `packages/ui` 通用元件，除非實作時發現已有跨功能共用需求。
- 不處理口說頁內收藏按鈕的真實整合；本階段只提供收藏包 UI 與可達入口。

## Decisions

1. **使用新 route 承載收藏包**

- Decision: 新增 `/collections` 作為收藏包列表頁，並新增 `/collections/new` 作為聊天式新增收藏頁。
- Why: 列表與新增流程資訊密度不同，拆成頁面可避免在單一 component 中堆疊太多狀態，也符合目前 `decks/new`、`cards/new` 的路由心智。
- Alternative: 用同頁 modal/overlay 顯示新增收藏；缺點是 prototype 已轉向聊天式頁面，固定底部輸入與長內容在 modal 中較容易遮擋。

2. **feature-local 元件優先**

- Decision: 列表與新增頁各自放在 `apps/web/src/app/pages/collection-pack-list/`、`apps/web/src/app/pages/collection-pack-new/`，收藏包專屬的卡片、tabs、domain mock、store 與 view helper 放在 `apps/web/src/app/components/collection-pack/`。
- Why: 頁面資料夾維持一個 component template 的共置方式，符合目前專案頁面結構；收藏卡、語塊拆解、高亮句子與聊天建議卡目前只屬於收藏包，先放 feature component 內可降低共用元件庫負擔。
- Alternative: 直接加入 `packages/ui`；缺點是 API 會太早定型，且這些元件仍依賴收藏包特定資料結構。

3. **mock domain 明確定義 UI 資料結構**

- Decision: 新增前端 domain 型別描述 `sentence/collocation/phrase/clause`、來源單字、中文意思、關聯語塊與聊天建議狀態。
- Why: 即使不接 API，UI 仍需要穩定資料形狀，後續接 API 時可對齊或替換資料來源。
- Alternative: 直接在 template 寫死資料；缺點是分類、搜尋與加入/移除互動難以維護。

4. **分類 tabs 使用既有深色系但 active 採 primary cyan**

- Decision: tabs 外層使用深色容器，active tab 使用 primary cyan 實底與深色文字。
- Why: prototype 驗證過純深色同色系 active 狀態不明顯；primary cyan 與現有主操作色一致，辨識度較好。
- Alternative: 只用邊框或亮度差表示 active；缺點是在深色背景下辨識度不足。

5. **句子高亮在 UI 層處理**

- Decision: 句子卡片依 mock data 中的拆解片段進行文字高亮；若片段找不到，退回顯示原句，不阻斷頁面。
- Why: 本階段沒有後端保障 AI 拆解結果，UI 需要容錯。
- Alternative: 要求資料完全正確才 render；缺點是 prototype/mock 階段容易因單筆資料錯誤造成整張卡片異常。

## Risks / Trade-offs

- [UI mock data 與未來 API response 形狀可能不一致] → 將 mock 型別集中在 domain 檔，後續接 API 時只需調整 mapper。
- [收藏包頁面太像 prototype 而不符合專案風格] → 實作時優先使用現有 Tailwind token 與 `packages/ui` 元件，避免搬運 prototype CSS。
- [聊天式新增頁容易被底部輸入框遮擋內容] → 採 sticky/fixed composer 時需保留底部 padding，並以行動 viewport 檢查。
- [feature-local 元件未來可能重複] → 等到口說頁收藏入口與正式功能整合後，再評估抽到 `packages/ui`。
- [只做 UI 會讓使用者誤以為資料已保存] → 明確以 mock 狀態呈現，避免加入任何會暗示真實雲端儲存的文案。

## Migration Plan

1. 新增收藏包 UI route 與 home 入口。
2. 建立收藏包 mock domain、列表頁與新增收藏頁。
3. 拆出收藏項目卡、AI 拆解區塊、分類 tabs、聊天建議卡等 feature-local 元件。
4. 套用 FlashMind 深色視覺並對照 `prototype/收藏包/code.html` 的資訊架構。
5. 加入基本元件/頁面測試或 domain 測試，確保分類、搜尋、加入與移除 mock 互動可預期。
6. 執行 `pnpm --filter ./apps/web build` 驗證前端可建置。

Rollback:

- 若收藏包 UI 造成路由或 build 問題，可移除新增 route、`collection-pack-list` / `collection-pack-new` page 目錄與 `components/collection-pack` feature 目錄，保留 prototype 檔案不影響正式 app。

## Open Questions

- 收藏包正式 route 名稱是否維持 `/collections`，或改成 `/collection-pack` 更直覺？
- Home 入口是否要與 Decks/Speaking 並列，或先只從 Speaking 相關入口進入？
- 新增收藏聊天頁未來是否需要支援從口說頁帶入上下文文字？
