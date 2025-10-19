# 實作計畫：快閃卡核心體驗與牌組管理

**分支**：`001-app-prompt` | **日期**：2025-10-19 | **規格文件**：`specs/001-app-prompt/spec.md`  
**輸入**：`/specs/001-app-prompt/spec.md` 中的功能規格

**備註**：此模板由 `/speckit.plan` 指令產出。執行流程請參考 `.specify/templates/commands/plan.md`。

## 摘要

交付一款行動優先的 FlashMind PWA，核心重點包含三向滑動複習體驗（映射 FSRS Again/Hard/Easy）、可離線與登入後同步的雙層 FSRS 排程、完整的牌組與卡片管理，以及透過 Gemini 2.5-flash 代理產生義項與例句並提供重生與錯誤回退。

## 技術背景

**Language/Version**: TypeScript 5; Angular 20 (frontend); NestJS 10 (backend)  
**Primary Dependencies**: Angular Material, Tailwind CSS, Dexie, Prisma, @google/generative-ai, openapi-generator-cli, Jest, Playwright, Storybook  
**Storage**: PostgreSQL (authoritative), IndexedDB via Dexie (offline/anonymous cache), LocalStorage (sync queue)  
**Test Framework**: Jest (unit), Supertest (contract), Playwright (e2e & visual)  
**Target Platform**: Mobile-first PWA with offline support  
**Project Type**: pnpm workspaces monorepo (`apps/{frontend,backend}`, `packages/*`)  
**Performance Goals**: Gesture feedback <100ms; AI generation <3s; sync replay <5 minutes  
**Constraints**: Mobile-first, one-handed usage, offline replay, no gamification, Storybook must showcase core flows  
**Scale/Scope**: ~4 primary screens (home, decks, settings, review); designed for ~10k active users

## 憲法檢查

*關卡：Phase 0 研究前必須通過，Phase 1 設計後需再次確認。*

- 雲端同步為唯一權威：登入狀態下以後端 PostgreSQL 為判準，匿名／離線操作寫入 IndexedDB 待恢復後回放至後端，並保留事件日誌。
- FSRS 排程一致性：前後端共用 `packages/fsrs-core`，沿用現行參數組，對相同輸入需輸出一致的排程結果並涵蓋匿名/登入切換。
- 嚴格資料契約：卡片、牌組、複習紀錄以 Prisma Schema + JSON Schema 定義，契約來源為 `packages/contracts/openapi.json`，所有破壞性調整附遷移與驗證。
- 測試導向：對滑動手勢、同步回放、AI 失敗回退建立 Jest/Playwright/Supertest 測試，維持紅→綠→重構流程。
- 使用者診斷資訊：錯誤訊息暴露易懂描述與錯誤代碼（如 `AI_GENERATION_FAILED`、`SYNC_CONFLICT`）並紀錄診斷上下文。
- Storybook UI 一致性：新增複習滑動、牌組管理、AI 編輯狀態的 Storybook 範例，Tailwind 為唯一樣式依據並導入視覺快照。
- 簡單性優先：維持既有 monorepo/workspace 架構，避免引入 Nx/Turbo 等額外抽象，確保一個開發週期內可交付。

**Phase 1 複查**：資料模型與 OpenAPI 契約均包含 version 欄位與同步/衝突流程；Storybook/測試策略在 quickstart 中具體化，滿足憲法檢查各項要求。

## 專案結構

### 文件（本功能）

```
specs/001-app-prompt/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### 原始碼（儲存庫根目錄）

```
apps/
  frontend/
    src/app/{pages,components,services,data,routes}
    tests/{unit,e2e}
    .storybook/
  backend/
    src/modules/{auth,decks,cards,reviews,ai,fsrs}
    prisma/schema.prisma
    tests/{unit,e2e}
packages/
  fsrs-core/
  contracts/
  ui/
.devcontainer/
```

**結構決策**：沿用 pnpm workspaces monorepo，前後端對等開發並共用 packages（fsrs-core、contracts、ui）。

## 複雜度追蹤

*僅在違反憲法檢查時填寫，說明必要性與被拒方案。*

目前無憲法違規項目需要追蹤。
