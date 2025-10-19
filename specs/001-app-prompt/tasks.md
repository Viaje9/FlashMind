# 任務清單：快閃卡核心體驗與牌組管理

**輸入**：`/specs/001-app-prompt/` 中的設計文件  
**前置條件**：plan.md（必備）、spec.md（使用者故事必備）、research.md、data-model.md、contracts/

**測試**：依憲法之 TDD 規定，所有故事必須先撰寫單元、契約與端對端測試，再進入實作。  
**組織方式**：依使用者故事分組，確保每個故事可獨立開發與驗證。

## 階段一：初始化（共用基礎）

**目的**：建立工作區設定與開發容器，使前後端可在一致環境運作。

- [X] T001 [Setup] 建立工作區 `package.json`（`package.json`），設定 `private`, `packageManager`, `pnpm` workspace scripts（`contracts:gen`, `test`, `lint`, `dev:frontend`, `dev:backend`）與共用工具依賴。
- [X] T002 [P] [Setup] 新增 `pnpm-workspace.yaml` 定義 `apps/*`、`packages/*`、`specs/*` 工作區範圍並排除 `docs`。
- [X] T003 [P] [Setup] 建立 `.devcontainer/devcontainer.json`，設定 `Node 22`, `pnpm 9`, `PostgreSQL` 服務與常用 VS Code 擴充功能。
- [X] T004 [P] [Setup] 撰寫 `.devcontainer/docker-compose.yml` 建置 `app`（Node）與 `db`（PostgreSQL 15）服務，對應 4200/3000/6006/5432 埠號。
- [X] T005 [P] [Setup] 建立 `.devcontainer/Dockerfile` 安裝 `pnpm`, `playwright-deps`, `zsh`，並設定 `pnpm install && pnpm build` 為 `postCreateCommand`。
- [X] T006 [P] [Setup] 新增 `.env.example`，列出 `DATABASE_URL`, `GEMINI_API_KEY`, `PLAYWRIGHT_BROWSERS_PATH`, `OPENAPI_GENERATOR_OUTPUT` 等必要環境變數。

---

## 階段二：基礎建設（阻擋性前置）

**目的**：完成所有故事共用的資料模型、契約與同步骨架。  
**⚠️ 關鍵**：未完成此階段不得開始任何故事開發。

- [X] T007 [Foundation] 建立 `tsconfig.base.json`，定義 `paths`（`@app/*`, `@backend/*`, `@shared/*`）與 `moduleResolution`（`nodenext`）供前後端共用。
- [X] T008 [Foundation] 更新 `apps/backend/prisma/schema.prisma`，依 data-model.md 建立 `User`, `DeviceSession`, `Deck`, `DeckStatSnapshot`, `Card`, `CardState`, `ReviewLog`, `SyncEvent` 結構與索引。
- [X] T009 [Foundation] 建立 `apps/backend/prisma/migrations/20251019_core_schema/migration.sql`，實作版本與唯一性條件（deck 名稱 per owner、card term per deck）。
- [X] T010 [Foundation] 建立 `apps/backend/src/modules/prisma/prisma.module.ts` 與 `prisma.service.ts`，設定 `PrismaClient`, 中介層 Logging 與關閉 hook。
- [X] T011 [P] [Foundation] 建立 `packages/fsrs-core/src/index.ts`，輸出 `CardState`, `Rating`, `ReviewResult` 型別與 `createFsrsEngine` 工廠函式骨架。
- [X] T012 [Foundation] 更新 `packages/contracts/openapi.yaml` 共用 schema（`Deck`, `Card`, `CardState`, `ReviewLog`, `ErrorResponse`）加入 `version`, `senses[]`, `authority` 欄位。
- [X] T013 [Foundation] 建立 `apps/frontend/src/app/data/flashmind-db.ts` Dexie 定義，含 `decks`, `cards`, `reviewQueue`, `syncJournal` 集合與版本欄位。
- [X] T014 [Foundation] 建立 `apps/frontend/src/app/services/sync/sync-queue.service.ts` 骨架，封裝 LocalStorage 佇列、Dexie 操作與回放事件 emitter。

**檢查點**：完成 schema、契約與同步基礎，可啟動各故事。

---

## 階段三：使用者故事 1 - 滑動式單字複習（優先度：P1）🎯 MVP

**目標**：提供三向滑動複習體驗，依 FSRS 規則更新排程並支援離線再上傳。  
**獨立驗證**：以測試帳號建立 6 張卡片，驗證左滑 10/20/40 分鐘回訪、上滑隔日優先、右滑 3–5 天延長與完成畫面提示。

### 使用者故事 1 契約與測試（TDD 強制）⚠️

- [ ] T015 [US1] 更新 `packages/contracts/openapi.yaml` 中 `/reviews/due`、`/reviews/batch`，描述 `DueCardBatch`, `ReviewBatchResponse`, `ConflictResponse` 與 `SYNC_CONFLICT` 錯誤碼。
- [ ] T016 [P] [US1] 撰寫 Supertest 契約測試 `apps/backend/tests/contract/reviews.contract.spec.ts`，涵蓋正常批次、離線重播、衝突 409。
- [ ] T017 [P] [US1] 撰寫 `apps/backend/src/modules/fsrs/fsrs.service.spec.ts` 單元測試，驗證 again/hard/easy 間隔計算與穩定度更新。
- [ ] T018 [P] [US1] 撰寫 `apps/frontend/src/app/services/review-gesture.service.spec.ts`，模擬 Dexie queue 與 API fallback 行為。
- [ ] T019 [P] [US1] 撰寫 Playwright 測試 `apps/frontend/tests/e2e/review-swipe.spec.ts`，驗證滑動回饋 <100ms、完成畫面與離線再上線同步。
- [ ] T020 [P] [US1] 撰寫 Storybook 視覺測試 `apps/frontend/tests/visual/review-card.spec.ts`，比對三種滑動狀態快照。

### 使用者故事 1 實作

- [ ] T021 [US1] 實作 `packages/fsrs-core/src/scheduler.ts`，提供 `applyRating` 實現 10/20/40 分鐘與 3–5 天間隔、返回新 `CardState` 與統計。
- [ ] T022 [US1] 實作 `apps/backend/src/modules/fsrs/fsrs.service.ts`，封裝批次評分、衝突偵測與 `ReviewResult` 映射。
- [ ] T023 [US1] 建立 `apps/backend/src/modules/reviews/reviews.repository.ts` 使用 Prisma 取得到期卡、寫入 `ReviewLog`、回存 `CardState`。
- [ ] T024 [US1] 實作 `apps/backend/src/modules/reviews/reviews.service.ts`，串接 repository 與 fsrs service，處理匿名/登入來源與序列號。
- [ ] T025 [US1] 實作 `apps/backend/src/modules/reviews/reviews.controller.ts`，對應 `/reviews/due` 與 `/reviews/batch`，映射 `AI_GENERATION_FAILED` / `SYNC_CONFLICT` 錯誤碼。
- [ ] T026 [US1] 更新 `apps/backend/src/modules/reviews/reviews.module.ts` 匯入 `PrismaModule`, `FsrsModule` 並匯出服務供其他模組使用。
- [ ] T027 [US1] 建立 `apps/frontend/src/app/services/api/review-api.service.ts`，使用產生的 OpenAPI client 呼叫 `getDueCards` 與 `submitReviewBatch`。
- [ ] T028 [US1] 實作 `apps/frontend/src/app/services/review-gesture.service.ts`，整合 API、Dexie `reviewQueue` 與觸控手勢評分。
- [ ] T029 [US1] 建立 `apps/frontend/src/app/state/review-session.store.ts`，追蹤待複習佇列、當日統計與完成狀態。
- [ ] T030 [US1] 建立 `apps/frontend/src/app/components/review-card/review-card.component.ts`（含 `review-card.component.html`）顯示單字、義項、滑動提示。
- [ ] T031 [US1] 建立 `apps/frontend/src/app/components/review-progress/review-progress.component.ts` 顯示進度儀表與下一次出現資訊。
- [ ] T032 [US1] 建立 `apps/frontend/src/app/components/review-complete/review-complete.component.ts` 呈現「今日完成」畫面與明日預覽。
- [ ] T033 [US1] 新增 Storybook 案例 `apps/frontend/.storybook/stories/review-card.stories.ts` 展示 again/hard/easy 狀態與完成畫面。
- [ ] T034 [US1] 更新 `apps/frontend/src/app/app.routes.ts`，註冊 `/review` 路由並設定全螢幕模式（供底部導覽隱藏）。
- [ ] T035 [US1] 擴充 `apps/frontend/src/app/services/sync/sync-queue.service.ts`，提供 review logs 回放與衝突標記流程。

**檢查點**：故事 1 完成，T016–T020 測試綠燈並可單獨示範 MVP。

---

## 階段四：使用者故事 2 - 建立與管理牌組（優先度：P2）

**目標**：讓使用者建立多個牌組並管理各自的卡片與每日上限。  
**獨立驗證**：建立兩個牌組、分別新增「drone」，確認進度互不影響且上限設定僅作用於指定牌組。

### 使用者故事 2 契約與測試（TDD 強制）⚠️

- [ ] T036 [US2] 更新 `packages/contracts/openapi.yaml` 中 `/decks`, `/decks/{deckId}`, `/decks/{deckId}/cards` 請求/回應，加入 `dailyNewLimit`, `stats`, 重複名稱 409。
- [ ] T037 [P] [US2] 撰寫 Supertest 契約測試 `apps/backend/tests/contract/decks.contract.spec.ts`，覆蓋建立、更新、重複名稱處理與跨 deck 卡片唯一性。
- [ ] T038 [P] [US2] 撰寫 `apps/backend/src/modules/decks/decks.service.spec.ts`，測試每日上限設定與 deck 合併邏輯。
- [ ] T039 [P] [US2] 撰寫 `apps/frontend/src/app/services/decks/deck-store.service.spec.ts`，模擬 Dexie 快取與 API 同步。
- [ ] T040 [P] [US2] 撰寫 Playwright 測試 `apps/frontend/tests/e2e/deck-management.spec.ts`，檢查列表、詳細頁、重複 card 行為。
- [ ] T041 [P] [US2] 撰寫 Storybook 視覺測試 `apps/frontend/tests/visual/deck-list.spec.ts`，比對牌組卡片展示。

### 使用者故事 2 實作

- [ ] T042 [US2] 建立 `apps/backend/src/modules/decks/decks.repository.ts`，支援 Prisma 查詢 deck 列表、統計快照與每日上限更新。
- [ ] T043 [US2] 實作 `apps/backend/src/modules/decks/decks.service.ts`，處理名稱唯一化、匿名/登入 owner 指派與統計再計算。
- [ ] T044 [US2] 實作 `apps/backend/src/modules/decks/decks.controller.ts`，串接 create/list/update 與 409 錯誤回應。
- [ ] T045 [US2] 更新 `apps/backend/src/modules/decks/decks.module.ts`，匯入 `PrismaModule`, 匯出 `DecksService` 供 cards/reviews 使用。
- [ ] T046 [US2] 建立 `apps/backend/src/modules/cards/cards.repository.ts`，提供 `findByDeck`, `countStats`, `upsertTerm` 操作。
- [ ] T047 [US2] 建立 `apps/frontend/src/app/services/api/decks-api.service.ts`，封裝 OpenAPI client。
- [ ] T048 [US2] 實作 `apps/frontend/src/app/services/decks/deck-store.service.ts`，整合 Dexie, API 與每日上限設定。
- [ ] T049 [US2] 建立 `apps/frontend/src/app/pages/decks/decks.page.ts`（含 `decks.page.html`），顯示牌組列表與統計。
- [ ] T050 [US2] 建立 `apps/frontend/src/app/pages/decks/deck-detail.page.ts`，顯示牌組專屬卡片、複習統計與設定入口。
- [ ] T051 [US2] 建立 `apps/frontend/src/app/components/deck-settings/deck-settings.component.ts`，提供每日上限調整與排序策略選項。
- [ ] T052 [US2] 新增 Storybook 案例 `apps/frontend/.storybook/stories/deck-list.stories.ts`，展示多牌組樣式與設定面板。
- [ ] T053 [US2] 更新 `apps/frontend/src/app/app.routes.ts`，加入 `/decks` 列表與 `/decks/:deckId` 詳細頁，確保可獨立導航。
- [ ] T054 [US2] 擴充 `apps/frontend/src/app/services/sync/sync-queue.service.ts`，支援離線 deck 建立/更新與登入後合併。
- [ ] T055 [US2] 建立 `apps/backend/src/modules/decks/deck-stats.job.ts`（排程或 hook）在同步後重算 `DeckStatSnapshot`。

**檢查點**：故事 1、2 皆可獨立運作並通過對應測試。

---

## 階段五：使用者故事 3 - AI 協助新增單字（優先度：P3）

**目標**：提供 AI 產生義項、例句與重生機制，並在失敗時回退至手動編輯。  
**獨立驗證**：輸入「run」，確認生成多義項、重生保留舊內容、失敗顯示 `AI_GENERATION_FAILED` 並可手動儲存。

### 使用者故事 3 契約與測試（TDD 強制）⚠️

- [ ] T056 [US3] 更新 `packages/contracts/openapi.yaml` 中 `/ai/generate-card`, `/ai/rewrite-example`, `CreateCardRequest`，描述 `senses[].source`, `revisions` 與錯誤碼。
- [ ] T057 [P] [US3] 撰寫 Supertest 契約測試 `apps/backend/tests/contract/ai.contract.spec.ts`，模擬成功、緩存命中與 503 失敗回退。
- [ ] T058 [P] [US3] 撰寫 `apps/backend/src/modules/ai/ai.service.spec.ts`，mock Gemini SDK 驗證重試與稽核紀錄。
- [ ] T059 [P] [US3] 撰寫 `apps/frontend/src/app/services/cards/card-creator.service.spec.ts`，測試 AI/手動模式切換與重生保留舊內容。
- [ ] T060 [P] [US3] 撰寫 Playwright 測試 `apps/frontend/tests/e2e/ai-card.spec.ts`，驗證生成流程、重生、離線手動儲存。
- [ ] T061 [P] [US3] 撰寫 Storybook 視覺測試 `apps/frontend/tests/visual/ai-card.spec.ts`，覆蓋 loading/成功/錯誤狀態。

### 使用者故事 3 實作

- [ ] T062 [US3] 實作 `apps/backend/src/modules/ai/ai.service.ts`，使用 `@google/generative-ai` 呼叫 Gemini、加入快取、錯誤碼映射。
- [ ] T063 [US3] 實作 `apps/backend/src/modules/ai/ai.controller.ts`，暴露 `/ai/generate-card` 與 `/ai/rewrite-example` API。
- [ ] T064 [US3] 更新 `apps/backend/src/modules/ai/ai.module.ts`，載入環境變數、速率限制與審計記錄。
- [ ] T065 [US3] 實作 `apps/backend/src/modules/cards/cards.service.ts`，整合 AI 結果與手動輸入、寫入 `senses[].revisions`。
- [ ] T066 [US3] 實作 `apps/backend/src/modules/cards/cards.controller.ts`，支援 `POST /decks/{deckId}/cards` 與 `PATCH /cards/{cardId}`。
- [ ] T067 [US3] 擴充 `apps/backend/src/modules/cards/cards.repository.ts`，處理 `senses` JSONB 結構、版本遞增與事件紀錄。
- [ ] T068 [US3] 建立 `apps/frontend/src/app/services/api/ai-api.service.ts`，封裝生成與重寫請求。
- [ ] T069 [US3] 實作 `apps/frontend/src/app/services/cards/card-creator.service.ts`，管理 AI/手動流程、重生與快取。
- [ ] T070 [US3] 建立 `apps/frontend/src/app/components/card-ai-form/card-ai-form.component.ts`，顯示生成結果與重生按鈕。
- [ ] T071 [US3] 更新 `apps/frontend/src/app/pages/decks/deck-detail.page.ts`，整合 AI 表單並記錄使用者編輯。
- [ ] T072 [US3] 建立 `apps/frontend/src/app/components/card-manual-form/card-manual-form.component.ts`，提供失敗回退與手動儲存。
- [ ] T073 [US3] 新增 Storybook 案例 `apps/frontend/.storybook/stories/card-ai.stories.ts`，展示生成、重生、錯誤與手動模式。
- [ ] T074 [US3] 擴充 `apps/frontend/src/app/services/sync/sync-queue.service.ts`，支援離線卡片建立與登入後回放。
- [ ] T075 [US3] 更新 `apps/backend/src/common/filters/http-exception.filter.ts`（若不存在則建立）統一輸出 `AI_GENERATION_FAILED` 與診斷資訊。

**檢查點**：故事 1–3 功能與測試皆完成，可提供完整內容輸入與複習流程。

---

## 階段六：使用者故事 4 - 底部導覽列快速切換（優先度：P4）

**目標**：提供首頁、牌組、設定間的快速切換，並在複習模式下自動隱藏導覽列。  
**獨立驗證**：點擊導覽 icon 確認切換、複習畫面隱藏導覽列、返回後維持選中狀態。

### 使用者故事 4 測試（TDD 強制）⚠️

- [ ] T076 [P] [US4] 撰寫 `apps/frontend/src/app/components/bottom-nav/bottom-nav.component.spec.ts`，測試導覽狀態與可及性。
- [ ] T077 [P] [US4] 撰寫 Playwright 測試 `apps/frontend/tests/e2e/bottom-nav.spec.ts`，驗證導覽切換與複習畫面隱藏行為。

### 使用者故事 4 實作

- [ ] T078 [US4] 建立 `apps/frontend/src/app/components/bottom-nav/bottom-nav.component.ts`（含 `bottom-nav.component.html`），使用 Angular Material icon-only button 與 Tailwind 佈局。
- [ ] T079 [US4] 建立 `apps/frontend/src/app/layouts/app-shell.component.ts`，集中導覽列、主要 router outlet 與安全區 padding。
- [ ] T080 [US4] 更新 `apps/frontend/tailwind.config.cjs` 與 `apps/frontend/src/styles/tailwind.css`，加入底部導覽 spacing 與主題樣式。
- [ ] T081 [US4] 新增 Storybook 案例 `apps/frontend/.storybook/stories/bottom-nav.stories.ts`，展示選中狀態與隱藏模式。
- [ ] T082 [US4] 更新 `apps/frontend/src/app/app.routes.ts` 與 `app-shell` 組態，依路由 metadata 控制導覽列顯示/隱藏。
- [ ] T083 [US4] 建立 `apps/frontend/src/app/services/navigation/navigation-state.service.ts`，同步導覽選中狀態與瀏覽器歷史。

**檢查點**：所有故事可串連運作並保持導覽一致性。

---

## 最終階段：潤飾與跨故事作業

**目的**：整合文件、資料與回歸測試，確保全域一致性。

- [ ] T084 [Polish] 建立 `apps/backend/prisma/seed.ts`，提供匿名/登入帳號、示範牌組與卡片資料。
- [ ] T085 [Polish] 建立 `apps/backend/src/modules/sync/sync-event.logger.ts`，在匿名轉登入與衝突時寫入 `SyncEvent` 稽核紀錄。
- [ ] T086 [Polish] 更新 `specs/001-app-prompt/quickstart.md`，加入 AI 金鑰設定、同步檢查與測試指令。
- [ ] T087 [Polish] 更新 `docs/constitution.md`，紀錄 `AI_GENERATION_FAILED`, `SYNC_CONFLICT` 診斷碼與測試覆蓋面。
- [ ] T088 [Polish] 新增離線回放回歸測試 `apps/frontend/tests/e2e/offline-sync.spec.ts`，驗證匿名完成複習後登入五分鐘內同步。

**檢查點**：文件、種子資料與跨故事回歸皆完成，可進行部署或交付。

---

## 相依與執行順序

- **初始化（階段一）** → **基礎建設（階段二）** → **US1 → US2 → US3 → US4** → **潤飾**
- US1 依賴基礎建設完成；US2 需復用 deck/card schema 與同步骨架；US3 依賴 US2 的卡片建立流程；US4 取決於現有頁面路由。
- 潤飾階段需所有故事完成後進行。

## 平行執行示例

- **US1**：T016（契約測試）與 T018（前端單元測試）可平行；T027（API 服務）可與 T030（卡片元件）同時進行。
- **US2**：T037（後端契約）與 T039（前端單元）可平行；T049（牌組列表頁）與 T051（設定面板）可同時實作。
- **US3**：T057（契約測試）與 T059（前端單元）可同步；T070（AI 表單）與 T072（手動表單）可平行。
- **US4**：T076（單元測試）與 T077（e2e）可平行；T078（元件）與 T081（Storybook）可併行安排。

## 實作策略

### MVP 優先（故事 1）

1. 完成階段一、階段二。
2. 完成故事 1 測試與實作（T015–T035）。
3. 驗證滑動複習 e2e，作為可展示的 MVP。

### 漸進式交付

1. Story 1 交付複習體驗後即可以內部發布。
2. Story 2 納入牌組管理；Story 3 強化內容建立；Story 4 提升導覽。
3. 每階段完成後執行對應測試與 Storybook 視覺驗證。

### 多人併行策略

1. 共同完成基礎建設（T007–T014）。
2. 指派開發者 A 處理 US1，開發者 B 處理 US2，開發者 C 處理 US3；UI 專員聚焦 US4 元件。
3. 每位開發者以 TDD 流程先撰寫測試後實作。

## 完整性檢查

- 每個使用者故事皆包含契約測試、單元/端對端測試與實作任務，並提供 Storybook 覆蓋。
- 離線同步、FSRS 排程、AI 回退與導覽需求皆有對應任務。
- 各故事可於對應檢查點獨立驗證與示範。
