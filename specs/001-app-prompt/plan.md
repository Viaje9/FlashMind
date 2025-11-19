# 實作計畫：快閃卡核心體驗與牌組管理

**分支**：`001-app-prompt` | **日期**：2025-10-19 | **規格文件**：`specs/001-app-prompt/spec.md`  
**輸入**：`/specs/001-app-prompt/spec.md` 中的功能規格

**備註**：此模板由 `/speckit.plan` 指令產出。執行流程請參考 `.specify/templates/commands/plan.md`。

## 摘要

交付一款行動優先的 FlashMind PWA，核心重點包含三向滑動複習體驗（映射 FSRS Again/Hard/Easy）、可離線與登入後同步的雙層 FSRS 排程、完整的牌組與卡片管理，以及透過 Gemini 2.5-flash 代理產生義項與例句並提供重生與錯誤回退。

## 技術背景

**語言／版本**：TypeScript 5、Angular 20 (Frontend)、NestJS 10 (Backend)  
**主要依賴**：Angular Material, Tailwind CSS, Dexie, Prisma, @google/generative-ai, openapi-generator-cli  
**儲存層**：PostgreSQL (Authoritative)、IndexedDB via Dexie (Offline/Anonymous)、LocalStorage (Sync Queue)  
**測試框架**：Jest (Unit)、Supertest (Contract)、Playwright (E2E & Visual)  
**目標平台**：Mobile-first PWA (iOS/Android/Desktop)  
**專案型態**：Monorepo (pnpm workspaces)  
**效能目標**：滑動回饋 <100ms、AI 生成 <3s、同步回放 <5min  
**限制條件**：單手操作優化、需支援完全離線操作、無遊戲化元素  
**規模／範圍**：~4 個主要畫面 (Home, Decks, Settings, Review)、預計支援 10k 活躍用戶

## 憲法檢查

*關卡：Phase 0 研究前必須通過，Phase 1 設計後需再次確認。*

- **雲端同步優先**：登入狀態下以後端 PostgreSQL 為判準，匿名／離線操作寫入 IndexedDB 待恢復後回放至後端，並保留事件日誌。
- **FSRS 排程一致性**：前後端共用 `packages/fsrs-core`，沿用現行參數組，對相同輸入需輸出一致的排程結果並涵蓋匿名/登入切換。
- **嚴格資料契約**：卡片、牌組、複習紀錄以 Prisma Schema + JSON Schema 定義，契約來源為 `packages/contracts/openapi.json`，所有破壞性調整附遷移與驗證。
- **測試導向開發**：對滑動手勢、同步回放、AI 失敗回退建立 Jest/Playwright/Supertest 測試，維持紅→綠→重構流程。
- **使用者面向診斷資訊**：錯誤訊息暴露易懂描述與錯誤代碼（如 `AI_GENERATION_FAILED`、`SYNC_CONFLICT`）並紀錄診斷上下文。
- **簡單性優先**：維持既有 monorepo/workspace 架構，避免引入 Nx/Turbo 等額外抽象，確保一個開發週期內可交付。
- **契約驅動開發**：前端型別由 OpenAPI 自動產生，確保前後端一致。
- **Storybook UI 一致性**：新增複習滑動、牌組管理、AI 編輯狀態的 Storybook 範例，Tailwind 為唯一樣式依據並導入視覺快照。

**Phase 1 複查**：資料模型與 OpenAPI 契約均包含 version 欄位與同步/衝突流程；Storybook/測試策略在 quickstart 中具體化，滿足憲法檢查各項要求。

## 專案結構

### 文件（本功能）

```
specs/001-app-prompt/
├── plan.md              # 本檔案（/speckit.plan 指令輸出）
├── research.md          # Phase 0 結果（/speckit.plan 指令輸出）
├── data-model.md        # Phase 1 結果（/speckit.plan 指令輸出）
├── quickstart.md        # Phase 1 結果（/speckit.plan 指令輸出）
├── contracts/           # Phase 1 結果（/speckit.plan 指令輸出）
└── tasks.md             # Phase 2 結果（/speckit.tasks 指令產出）
```

### 原始碼（儲存庫根目錄）

```
apps/
  frontend/
    src/
      app/
        core/                # 單例服務、攔截器、守衛
        data/                # Dexie DB、狀態管理、同步邏輯
        layout/              # Shell、底部導覽列
        pages/
          home/              # 首頁（儀表板）
          decks/             # 牌組列表、新增編輯
          review/            # 複習介面（滑動手勢）
          settings/          # 設定頁面
        shared/              # 共用 Pipes、Directives
      assets/
      environments/
    tests/                   # E2E 與整合測試
    .storybook/              # Storybook 設定
  
  backend/
    src/
      modules/
        app/                 # 根模組
        auth/                # 認證與授權
        decks/               # 牌組 CRUD
        cards/               # 卡片 CRUD
        reviews/             # 複習紀錄與同步
        ai/                  # Gemini 代理服務
        fsrs/                # 排程計算整合
      common/                # 全域 Filters, Pipes, Decorators
    prisma/
      schema.prisma          # 資料庫 Schema
    tests/                   # 契約與 API 測試

packages/
  fsrs-core/
    src/                     # FSRS 演算法核心邏輯（前後端共用）
  contracts/
    openapi.json             # API 契約定義
    src/                     # 自動產生的型別與 Zod schema
  ui/
    src/                     # 共用 Angular Material 元件與 Tailwind 設定
```

**結構決策**：沿用 pnpm workspaces monorepo，前後端對等開發並共用 packages（fsrs-core、contracts、ui）。

## 複雜度追蹤

*僅在違反憲法檢查時填寫，說明必要性與被拒方案。*

目前無憲法違規項目需要追蹤。
