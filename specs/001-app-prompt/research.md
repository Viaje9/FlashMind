# Phase 0 Research — 快閃卡核心體驗與牌組管理

## Angular Material + Tailwind 在行動 PWA
- Decision: 繼續採用 Angular Material 作為互動元件骨架並以 Tailwind 管理佈局與主題自訂。
- Rationale: Material 提供無障礙準則與手勢支援，Tailwind 可快速調整密度與響應式間距，符合單手操作需求。
- Alternatives considered: 只用 Tailwind（需自行實作元件庫，投入過大）、改用 Ionic（多餘的混合式外掛與路由限制）。

## Dexie 離線佇列與同步策略
- Decision: Dexie 維持匿名／離線卡片與 ReviewLog 的主儲存，透過變更佇列與裝置時間戳在恢復連線時批次回放。
- Rationale: Dexie 的 transaction 與 hook 能封裝重試與衝突處理；本地快取能支援 <100ms 滑動回饋。
- Alternatives considered: IndexedDB 原生 API（可行但開發成本較高、易出錯）、PouchDB（抽象過重且多餘的 Couch 語意）。

## Prisma + PostgreSQL 架構
- Decision: 以 Prisma 管理 PostgreSQL schema，核心模型包含 User、DeviceSession、Deck、Card、CardState、ReviewLog，並新增 version 欄位。
- Rationale: Prisma schema 可同時產生型別與遷移；對 FSRS 計算與同步需要嚴格資料契約。
- Alternatives considered: TypeORM（DX 較弱且對 JSONB 支援較差）、Knex（需手動維護型別與關聯）。

## Gemini 2.5-flash 代理
- Decision: 後端 NestJS `ai` 模組串接 @google/generative-ai REST，用 API key 與速率限制包裝成 `POST /ai/generate-card` / `POST /ai/rewrite-example`。
- Rationale: 後端集中金鑰並可加上重試、快取與審查，前端只需調用自家 API，符合安全要求。
- Alternatives considered: 直接在前端呼叫 Gemini（無法安全保存金鑰）、改用 OpenAI/GPT（未納入授權與預算）。

## OpenAPI 契約與產生流程
- Decision: 維持後端自動輸出 `packages/contracts/openapi.json`，並透過 openapi-generator-cli 產製 Angular services。
- Rationale: 確保契約驅動與型別一源化；Angular 端可直接注入 Api services。
- Alternatives considered: 手寫 API 型別（易漂移）、改用 Swagger Codegen（維護性較差且 Angular 20 支援不足）。

## 測試組合（Jest、Supertest、Playwright）
- Decision: 前後端單元測試採 Jest，後端 API 驗證使用 Supertest 覆蓋同步／AI 回退，前端體驗使用 Playwright（含 Storybook 視覺）。
- Rationale: 舊有 CI pipeline 及相關腳本已串接這些工具；可完整覆蓋滑動排程與離線回放。
- Alternatives considered: Vitest（與 NestJS 整合仍不成熟）、Cypress（Storybook 視覺回歸額外設定較複雜）。

## Storybook 視覺一致性
- Decision: 在 `apps/frontend/.storybook/` 擴充複習滑動、牌組管理、AI 內容編輯的案例並加入 Playwright 視覺測試。
- Rationale: Storybook 是憲法要求的 UI 真實來源，可快速預覽多手勢狀態並與 QA 協作。
- Alternatives considered: 只依賴應用程式環境（缺乏隔離）、改用 Ladle（現有腳本需重寫且無附加價值）。
