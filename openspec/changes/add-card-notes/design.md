## Context

`Card` 目前保存正面與多筆詞義，學習 API 會將同一張底層卡片映射為正向或反向 `StudyCard`。學習頁的卡片 AI 助手已具備手機安全區限制、垂直拖曳、高度調整與版面記憶；Speaking 頁另有 AI 與小抄筆記可同時開啟的既有模式。此變更需跨 Prisma、OpenAPI、NestJS 與 Angular，並確保學習中的快速輸入不會覆蓋整包詞義。

## Goals / Non-Goals

**Goals:**

- 為每張底層 `Card` 保存一份可為空的純文字備註。
- 讓卡片建立／編輯頁與學習頁維護同一份備註。
- 在翻卡後提供可與 AI 同時開啟的獨立備註浮窗。
- 提供延遲自動儲存、失敗狀態、版面記憶及手機安全區限制。
- 讓匯入與匯出保留備註，且舊格式仍可正常匯入。

**Non-Goals:**

- 多筆備註、版本歷史、多人同步衝突合併。
- 富文字或 Markdown 編輯器與 AI 自動撰寫備註。
- 依備註搜尋、排序或篩選卡片。
- 在尚未翻卡時顯示備註內容或入口。

## Decisions

### 備註屬於底層 Card

在 Prisma `Card` 新增 nullable `Text` 欄位 `note`。正向與反向 StudyCard 只共享此欄位，不在排程方向上建立兩份備註。相較獨立 `CardNote` 資料表，單欄位符合「每張卡一份備註」需求，查詢與遷移成本更低；若未來需要歷史或多筆備註，再升級為關聯模型。

### 更新 API 使用可選 note 欄位

OpenAPI 的建立、更新、卡片詳情、StudyCard、匯入與匯出模型加入 optional nullable `note`。更新請求未提供 `note` 時保持原值；提供空字串或 null 時清除備註。後端只更新 `note`，不觸發 `meanings` 的整包替換。

### 備註內容與浮窗版面分開保存

備註內容經卡片 API 寫入 PostgreSQL。浮窗 top 與 height 使用獨立的 `localStorage` keys，且在讀取後仍需依目前 viewport 與 safe-area 重新 clamp。這可讓內容跨裝置同步，同時保留單一裝置上的操作習慣。

### 學習頁採獨立備註元件與延遲儲存

新增 study note panel component，負責文字草稿、600ms debounce、儲存狀態、拖曳及縮放。元件在輸入時立即更新本地草稿，debounce 後透過 study store 送出僅含 `note` 的 PATCH；關閉或元件銷毀時立即送出尚未儲存的版本。瀏覽器被作業系統強制終止時無法保證網路完成，屬於 best-effort。

### AI 與備註浮窗可同時存在

備註元件與既有 AI 助手各自維護 open、top 與 height。兩者使用獨立 fixed overlay 並沿用 Speaking 的層級模式，可拖曳分開而不互斥；兩者仍受相同 iPhone safe-area 上界約束。切換下一張卡片時元件隨翻卡狀態關閉，但下次開啟會讀取記憶的版面。

### 第一版使用純文字

編輯頁與浮窗均使用 textarea，保留換行但不解析 Markdown。純文字可避免編輯／預覽模式與內容清理的額外複雜度，也符合快速記憶提示的主要用途。

## Risks / Trade-offs

- [快速切換卡片時 debounce 尚未完成] → 元件關閉與銷毀時立即 flush，study store 以 cardId 更新正確卡片。
- [兩個浮窗在小螢幕重疊] → 維持可同時開啟並允許各自拖曳、縮放，不強制互斥。
- [localStorage 保存的位置在旋轉螢幕後超界] → 每次開啟與 resize 都依 viewport、safe-area 重新 clamp。
- [舊匯出檔沒有 note] → `note` 保持 optional，舊版資料視為 null。
- [自動儲存失敗造成誤以為已保存] → 顯示明確失敗狀態並保留草稿，後續輸入或手動重試可再次送出。

## Migration Plan

1. 新增 nullable `Card.note` migration，既有資料不需回填。
2. 更新 OpenAPI 並重新產生 API client。
3. 部署後端回傳與更新欄位，再部署前端入口。
4. 回滾前端與後端時可保留資料庫欄位；nullable 欄位不影響舊程式。

## Open Questions

無。第一版依已確認的單一純文字備註、雙浮窗並存及自動儲存範圍實作。
