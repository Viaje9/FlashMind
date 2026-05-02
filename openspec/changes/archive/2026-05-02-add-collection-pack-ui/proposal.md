## Why

使用者在口說練習或查句子時，會想保存「之後還想再用」的英文表達，但目前專案只有單字牌組與口說入口，缺少一個能承接句子、搭配詞、片語與子句的收藏介面。現在已有 `prototype/收藏包/code.html` 作為方向，需要先把 UI 寫回正式專案，讓後續再接 API 與 AI 分析流程。

## What Changes

- 新增「收藏包」前端入口與頁面 UI，沿用 FlashMind 既有深色視覺、header、按鈕、卡片與表單風格。
- 新增收藏列表 UI，支援全部、句子、搭配詞、片語、子句等分類 tabs。
- 新增收藏項目卡片 UI，可呈現英文內容、中文意思、類型標籤、來源單字與關聯拆解。
- 新增句子卡片的 AI 拆解呈現，顯示關聯搭配詞、片語或子句，並在英文句子中高亮語塊。
- 新增「新增收藏」聊天式頁面 UI，讓使用者輸入中英文內容，並看到 AI 建議可收藏的句子或語塊。
- 以靜態 mock data 與前端狀態模擬互動；本次不串接 API、不新增資料庫、不改 OpenAPI 契約。

## Capabilities

### New Capabilities

- `collection-pack-ui`: 定義收藏包前端 UI 與互動要求，涵蓋收藏列表、分類瀏覽、句子拆解、語塊關聯與聊天式新增收藏頁。

### Modified Capabilities

- 無。

## Impact

- Affected code:
  - `apps/web/src/app/pages/**`
  - `apps/web/src/app/components/**`
  - 可能新增收藏包專用 page/component/domain mock 檔案
  - `apps/web/src/app/app.routes.ts`
- Affected APIs: 無，本次不新增或修改後端 API。
- Dependencies/Systems:
  - 沿用 Angular 21、Tailwind CSS v4、Signal 狀態與既有 UI 元件。
  - 參考 `prototype/收藏包/code.html` 的資訊架構與互動。
  - 需維持 FlashMind 現有深色介面風格，避免建立獨立 prototype 色系。
