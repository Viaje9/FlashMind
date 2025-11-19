# 任務清單：快閃卡核心體驗與牌組管理

**輸入**：`/specs/001-app-prompt/` 中的設計文件  
**前置條件**：plan.md（必備）、spec.md（使用者故事必備）、research.md、data-model.md、contracts/  
**測試**：依憲法之 TDD 規定，所有故事必須先撰寫單元、契約與端對端測試，再進入實作。  
**組織方式**：依使用者故事分組，確保每個故事可獨立開發與驗證。

## 階段一：初始化（共用基礎）

**目的**：準備開發環境設定與容器參數，確保後續故事共用基礎一致。

- [ ] T001 更新環境樣板 `/workspace/.env.example` 加入 `GEMINI_API_KEY`、FSRS 排程參數與離線同步佇列設定說明。
- [ ] T002 調整 `/workspace/.devcontainer/devcontainer.json` 匯出 Gemini 相關環境變數並設定 `PLAYWRIGHT_BROWSERS_PATH` 供 e2e 測試使用。

---

## 階段二：基礎建設（阻擋性前置）

**目的**：建立共用資料模型、契約與離線儲存骨架，未完成不得開始任何故事。

- [ ] T003 更新 Prisma Schema `/workspace/apps/backend/prisma/schema.prisma` 導入 Deck/Card/CardState/ReviewLog/SyncEvent 欄位、版本號與必要索引。
- [ ] T004 建立 Prisma 遷移 `/workspace/apps/backend/prisma/migrations/<timestamp>_fsrs_review_core/` 反映新欄位與索引並維護同步腳本。
- [ ] T005 調整 OpenAPI 契約 `/workspace/packages/contracts/openapi.yaml` 與生成設定描述最新 Deck/Card/Review schema 與錯誤碼。
- [ ] T006 重新產生契約輸出 `/workspace/packages/contracts/src/generated/` 並更新 `contracts:gen` 腳本確保 Angular/NestJS 型別一致。
- [ ] T007 建立 Dexie 離線資料骨架 `/workspace/apps/frontend/src/app/data/review-db.ts` 定義 decks/cards/reviewQueue/syncJournal stores 與版本欄位。
- [ ] T008 建立通用錯誤碼與診斷記錄器 `/workspace/packages/ui/src/lib/errors/error-codes.ts` 與 `/workspace/apps/backend/src/lib/logger/diagnostics.ts`，列出 `AI_GENERATION_FAILED`、`SYNC_CONFLICT` 等常數。

**檢查點**：資料模型、契約與離線儲存基線可用，進入故事開發。

---

## 階段三：使用者故事 1 - 滑動式單字複習（優先度：P1）🎯 MVP

**目標**：提供三向滑動（Again/Hard/Easy）複習體驗，支援離線回放與匿名登入後同步。  
**獨立驗證**：以測試帳號建立 6 張卡片，驗證左/上/右滑的排程間隔、今日完成畫面與離線同步回放。

### 使用者故事 1 測試（TDD 強制）⚠️

- [ ] T009 [P] [US1] 建立 Supertest 契約測試 `/workspace/apps/backend/test/contract/reviews/get-due.spec.ts` 覆蓋 `/reviews/due` 提供正確 FSRS 排程。
- [ ] T010 [P] [US1] 建立 Supertest 契約測試 `/workspace/apps/backend/test/contract/reviews/replay-batch.spec.ts` 驗證 `/reviews/batch` 離線回放與衝突回應。
- [ ] T011 [P] [US1] 建立 Jest 單元測試 `/workspace/packages/fsrs-core/src/__tests__/tri-swipe.spec.ts` 驗證 Again/Hard/Easy 對應的穩定度／間隔計算。
- [ ] T012 [P] [US1] 建立 Playwright e2e 測試 `/workspace/apps/frontend/tests/e2e/review-swipes.spec.ts` 覆蓋線上／離線複習與今日完成畫面。

### 使用者故事 1 實作

- [ ] T013 [US1] 擴充 FSRS 核心 `/workspace/packages/fsrs-core/src/triSwipeScheduler.ts` 實作三向滑動演算法與同日卡片跳過邏輯（對應 T011）。
- [ ] T014 [US1] 更新後端複習服務 `/workspace/apps/backend/src/modules/reviews/reviews.service.ts` 套用 FSRS 更新、記錄 ReviewLog 並回傳進度儀表資料（依賴 T013）。
- [ ] T015 [US1] 更新後端控制器 `/workspace/apps/backend/src/modules/reviews/reviews.controller.ts` 暴露 `/reviews/due`、`/reviews/batch` 並映射 `SYNC_CONFLICT` 等錯誤碼。
- [ ] T016 [US1] 實作同步回放流程 `/workspace/apps/backend/src/modules/sync/sync.service.ts` 合併匿名 DeviceSession 日誌並寫入 `SyncEvent`。
- [ ] T017 [US1] 建立 ReviewLog 儲存庫 `/workspace/apps/backend/src/modules/reviews/review-log.repository.ts` 管理離線序列與衝突寫入。
- [ ] T018 [US1] 擴充 Dexie 實作 `/workspace/apps/frontend/src/app/data/review-db.ts` 儲存 reviewQueue/syncJournal 並維護版本遷移（依賴 T007）。
- [ ] T019 [US1] 建立複習同步服務 `/workspace/apps/frontend/src/app/services/review-sync.service.ts` 整合 Dexie、OpenAPI client 與網路狀態。
- [ ] T020 [US1] 實作複習頁元件 `/workspace/apps/frontend/src/app/pages/review/review-page.component.ts` 綁定手勢（HammerJS）與今日完成對話框。
- [ ] T021 [US1] 建立複習狀態儲存 `/workspace/apps/frontend/src/app/services/review.store.ts` 追蹤待複習卡數、滑動統計與同步訊息。
- [ ] T022 [US1] 新增 Storybook 案例 `/workspace/apps/frontend/.storybook/stories/review-swipes.stories.ts` 展示三種滑動狀態與今日完成畫面。

**檢查點**：US1 功能可獨立運作並通過 T009–T022 的測試。

---

## 階段四：使用者故事 2 - 建立與管理牌組（優先度：P2）

**目標**：讓使用者建立多個牌組、管理每日新卡上限並處理重複單字。  
**獨立驗證**：建立兩個牌組並新增同字，確認排程與統計獨立，調整每日新卡上限僅影響指定牌組。 

### 使用者故事 2 測試（TDD 強制）⚠️

- [ ] T023 [P] [US2] 建立 Supertest 契約測試 `/workspace/apps/backend/test/contract/decks/deck-crud.spec.ts` 覆蓋建立、列出、更新每日新卡上限與重複名稱衝突。
- [ ] T024 [P] [US2] 建立 Playwright e2e 測試 `/workspace/apps/frontend/tests/e2e/deck-management.spec.ts` 驗證多牌組獨立排程與統計。
- [ ] T025 [P] [US2] 建立 Jest 單元測試 `/workspace/apps/frontend/src/app/services/deck.store.spec.ts` 驗證重複單字提示與統計拆分。

### 使用者故事 2 實作

- [ ] T026 [US2] 擴充牌組服務 `/workspace/apps/backend/src/modules/decks/decks.service.ts` 實作名稱唯一性、slug 生成與每日新卡上限邏輯。
- [ ] T027 [US2] 更新牌組控制器 `/workspace/apps/backend/src/modules/decks/decks.controller.ts` 支援排序、每日新卡設定與重複提示回應。
- [ ] T028 [US2] 擴充 Prisma 存取層 `/workspace/apps/backend/src/modules/decks/deck.repository.ts` 產出統計快取與重複單字查詢。
- [ ] T029 [US2] 實作牌組清單頁 `/workspace/apps/frontend/src/app/pages/decks/deck-list.page.ts` 顯示統計與過濾。
- [ ] T030 [US2] 實作牌組細節頁 `/workspace/apps/frontend/src/app/pages/decks/deck-detail.page.ts` 管理每日新卡上限與重複提示流程。
- [ ] T031 [US2] 建立牌組狀態儲存 `/workspace/apps/frontend/src/app/services/deck.store.ts` 維護多牌組統計與設定。
- [ ] T032 [US2] 新增 Storybook 案例 `/workspace/apps/frontend/.storybook/stories/decks-management.stories.ts` 展示多牌組與重複提示。

**檢查點**：US2 完成並與 US1 並存，所有測試通過。

---

## 階段五：使用者故事 3 - AI 協助新增單字（優先度：P3）

**目標**：整合 Gemini 2.5-flash 代理，自動產生義項與例句並支援重生與手動覆蓋。  
**獨立驗證**：輸入單字「run」，確認生成多義內容、重生保留舊版本與錯誤轉回手動模式。

### 使用者故事 3 測試（TDD 強制）⚠️

- [ ] T033 [P] [US3] 建立 Supertest 契約測試 `/workspace/apps/backend/test/contract/ai/generate-card.spec.ts` 驗證成功回傳與 `AI_GENERATION_FAILED` 錯誤。
- [ ] T034 [P] [US3] 建立 Supertest 契約測試 `/workspace/apps/backend/test/contract/ai/rewrite-example.spec.ts` 覆蓋例句重寫流程。
- [ ] T035 [P] [US3] 建立 Jest 單元測試 `/workspace/apps/frontend/src/app/pages/cards/add-card.component.spec.ts` 驗證 AI 生成、重生與手動覆蓋狀態切換。
- [ ] T036 [P] [US3] 建立 Playwright 視覺測試 `/workspace/apps/frontend/tests/visual/ai-card-editor.spec.ts` 針對 Storybook 場景抓取視覺回歸。

### 使用者故事 3 實作

- [ ] T037 [US3] 建立 AI 整合服務 `/workspace/apps/backend/src/modules/ai/ai.service.ts` 呼叫 Gemini API、實作重試與快取。
- [ ] T038 [US3] 建立 AI 控制器 `/workspace/apps/backend/src/modules/ai/ai.controller.ts` 提供 `/ai/generate-card`、`/ai/rewrite-example` 路由。
- [ ] T039 [US3] 建立守門邏輯 `/workspace/apps/backend/src/modules/ai/ai.guard.ts` 管理 API key、速率限制與錯誤映射（依賴 T037）。
- [ ] T040 [US3] 建立前端 AI Service `/workspace/apps/frontend/src/app/services/ai-card.service.ts` 封裝生成、重生與錯誤處理。
- [ ] T041 [US3] 擴充卡片新增頁 `/workspace/apps/frontend/src/app/pages/cards/add-card.component.ts` 整合 AI 內容、重生比較與手動覆蓋流程。
- [ ] T042 [US3] 更新 Dexie 儲存 `/workspace/apps/frontend/src/app/data/review-db.ts` 保存 sense revisions 與來源旗標（依賴 T018）。
- [ ] T043 [US3] 新增 Storybook 案例 `/workspace/apps/frontend/.storybook/stories/ai-card-editor.stories.ts` 展示生成中、成功、失敗狀態。

**檢查點**：US3 可獨立驗證並與前述故事互不影響。

---

## 階段六：使用者故事 4 - 底部導覽列快速切換（優先度：P4）

**目標**：提供首頁、牌組、設定的底部導覽列，並在複習模式自動隱藏維持沉浸體驗。  
**獨立驗證**：透過 e2e 測試逐一切換導覽 icon，確認複習時隱藏與結束後恢復選取狀態。

### 使用者故事 4 測試（TDD 強制）⚠️

- [ ] T044 [P] [US4] 建立 Playwright e2e 測試 `/workspace/apps/frontend/tests/e2e/bottom-nav.spec.ts` 驗證導覽切換與複習時隱藏。
- [ ] T045 [P] [US4] 建立 Jest 元件測試 `/workspace/apps/frontend/src/app/components/navigation/bottom-nav.component.spec.ts` 驗證選取狀態與顯示條件。

### 使用者故事 4 實作

- [ ] T046 [US4] 建立導覽元件 `/workspace/apps/frontend/src/app/components/navigation/bottom-nav.component.ts` 使用 Angular Material + Tailwind 切版。
- [ ] T047 [US4] 更新應用程式布局 `/workspace/apps/frontend/src/app/app.component.ts` 引入導覽列並在複習路由時隱藏。
- [ ] T048 [US4] 擴充樣式 `/workspace/apps/frontend/src/styles/tailwind.css` 定義導覽列 spacing、顏色與安全區域。
- [ ] T049 [US4] 新增 Storybook 案例 `/workspace/apps/frontend/.storybook/stories/bottom-nav.stories.ts` 展示導覽各狀態。

**檢查點**：US4 完成，所有導覽相關測試通過。

---

## 最終階段：潤飾與跨故事作業

**目的**：補齊資料種子、測試設定與文件，確保整體體驗一致。

- [ ] T050 [P] 更新資料種子 `/workspace/apps/backend/prisma/seed.ts` 與 `/workspace/apps/frontend/tools/seed-anon.ts` 支援複習、牌組與 AI 範例資料。
- [ ] T051 [P] 更新 Playwright 設定 `/workspace/apps/frontend/tests/playwright.config.ts` 納入 review/decks/nav/AI 測試與視覺基線。
- [ ] T052 [P] 更新文件 `/workspace/docs/plan.md` 與 `/workspace/docs/spec.md` 記錄新流程、錯誤碼與成功指標。
- [ ] T053 [P] 更新快速入門 `/workspace/specs/001-app-prompt/quickstart.md` 加入新的命令與驗證步驟。

**檢查點**：所有故事整合完畢，可進行最終驗收或部署。

---

## 相依與執行順序

- **Phase 順序**：初始化 → 基礎建設 → US1 → US2 → US3 → US4 → 潤飾。
- **使用者故事依賴**：`US1 (P1) → US2 (P2) → US3 (P3) → US4 (P4)`（US2–US4 皆依賴 US1 產生的核心複習流程與資料模型）。
- **資料模型依賴**：Prisma 與 Dexie 基線（T003–T008）為所有故事前置；Dexie 扩充（T018、T042）依賴基線完成。
- **測試節點**：各故事測試 (T009–T012、T023–T025、T033–T036、T044–T045) 必須在對應實作開始前完成並先行失敗。

## 平行執行示例

- **US1**：T009、T010、T011、T012 可併行；實作階段的 T018 與 T019 可併行於前端（不同檔案）。
- **US2**：T023、T024、T025 測試可同時進行；T029 與 T031 由不同前端人員併行實作。
- **US3**：T033–T036 測試彼此獨立；T037 與 T040 可分別由後端與前端工程師同步開發。
- **US4**：T044 與 T045 可同時撰寫；T046 與 T048 可平行處理結構與樣式。

## 實作策略

- **MVP 先行**：完成階段一至階段三（US1）後即可提供滑動複習 MVP，先行驗證核心價值。
- **漸進交付**：依序完成 US2、US3、US4，每完成一個故事即執行對應測試與 Storybook 驗證，再行部署。
- **同步準備測試資料**：配合 T050 種子更新，於每個故事驗收前重播種子與 Playwright 測試，確保匿名／登入場景一致。
