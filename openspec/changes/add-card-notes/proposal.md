## Why

學習者目前只能在卡片既有詞義與 AI 對話之間切換，缺少能長期保存個人理解、記憶提示與補充內容的位置。卡片備註可讓使用者在學習當下快速記錄，並在卡片編輯頁持續整理同一份內容。

## What Changes

- 為每張卡片新增一份可為空的純文字備註，並透過資料庫、API 與匯入匯出完整保存。
- 在卡片編輯頁提供備註欄位，建立及編輯卡片時皆可維護。
- 在翻開學習卡片後提供獨立備註浮窗，可與卡片 AI 助手同時開啟、上下拖曳及調整高度。
- 學習頁備註採延遲自動儲存，提供儲存狀態與失敗重試，且不影響卡片詞義。
- 備註內容由正向與反向 StudyCard 共用；浮窗位置與高度則在瀏覽器端記憶。

## Capabilities

### New Capabilities

- `card-notes`: 卡片備註的持久化、API 契約、匯入匯出、卡片編輯與學習浮窗互動。

### Modified Capabilities

無。

## Impact

- Prisma `Card` schema 與 migration。
- OpenAPI 卡片、學習、匯入與匯出契約及產生的 Angular API client。
- NestJS card／deck／study service 與相關測試。
- Angular 卡片編輯頁、學習頁與新的備註浮窗元件。
- 手機版安全區、浮窗狀態記憶與自動儲存行為。
