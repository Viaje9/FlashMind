## 1. 資料模型與契約

- [x] 1.1 先補後端 card service 測試，涵蓋建立、查詢、部分更新與清除備註
- [x] 1.2 新增 Prisma Card.note 欄位與 migration
- [x] 1.3 更新 OpenAPI 的卡片、StudyCard、匯入與匯出 note 契約並重新產生 API client

## 2. 後端資料流

- [x] 2.1 實作 card DTO/service 建立、查詢與部分更新 note，並確保不替換 meanings
- [x] 2.2 實作 study service 正反向 StudyCard 共用 note 並通過測試
- [x] 2.3 實作牌組匯入匯出 note 相容性並通過測試

## 3. 卡片編輯頁

- [x] 3.1 擴充卡片編輯表單模型與測試，支援載入及提交 note
- [x] 3.2 在卡片編輯頁加入符合既有視覺語言的純文字備註欄位

## 4. 學習頁備註浮窗

- [x] 4.1 先建立備註草稿、自動儲存與版面限制的 domain 測試
- [x] 4.2 實作獨立 study note panel，支援 600ms debounce、儲存狀態、重試與 flush
- [x] 4.3 實作備註浮窗垂直拖曳、高度調整、localStorage 記憶與 iPhone 安全區限制
- [x] 4.4 將備註入口接到翻卡狀態，並驗證可與卡片 AI 助手同時展開及切卡關閉

## 5. 驗證

- [x] 5.1 執行相關 API/Web 單元測試、OpenAPI 產生檢查與 build
- [x] 5.2 以手機版 inBrowser 驗證儲存重載、卡片編輯、雙浮窗、拖曳縮放與安全區
- [x] 5.3 檢查 migration、git diff 與 OpenSpec 任務狀態，整理交付結果
