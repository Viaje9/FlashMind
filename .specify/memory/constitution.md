<!--
Sync Impact Report
- Version change: N/A -> 0.1.0
- Modified principles: 無
- Added sections: Core Principles 具體化、專案約束、開發流程與品質、治理規則
- Removed sections: 無
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
- Follow-up TODOs:
  - TODO(RATIFICATION_DATE): 未提供原始制定日期
-->
# FlashMind Constitution

## Core Principles

### I. 繁體中文為唯一溝通語言
所有文件、規格、任務、回覆與提交訊息內容必須使用繁體中文（zh-tw）。
不得混用簡體中文或其他語言作為主要內容。
理由：確保協作一致性與可讀性，避免跨語系誤解。

### II. 技術棧一致性
前端必須使用 Angular（最新版）與 Tailwind CSS v4；後端必須使用 NestJS，
ORM 使用 Prisma，資料庫使用 PostgreSQL，專案為 pnpm workspace Monorepo。
理由：統一技術決策以降低維運成本與學習成本。

### III. Prisma 使用範圍與路徑固定
僅能在 `apps/api` 使用 Prisma CLI，schema 路徑固定為
`apps/api/prisma/schema.prisma`。
理由：避免多處 schema 造成不一致與遷移混亂。

### IV. 環境設定集中管理
`.env` 必須放在專案根目錄，且需包含 `DATABASE_URL`。
理由：確保本機、CI 與部署環境設定一致且可追蹤。

### V. 套件管理一致
所有安裝、指令與流程必須使用 pnpm，不得使用 npm 或 yarn。
理由：避免 lockfile 與工作區行為不一致。

## 專案約束

- 目錄結構需遵循：
  - `apps/web/`：前端
  - `apps/api/`：後端
  - `apps/api/prisma/`：Prisma schema 與 migrations
  - `apps/docs-viewer/src/content/docs/`：文件內容
  - `packages/shared/`：前後端共用型別/DTO
  - `packages/config/`：共用設定（eslint/tsconfig 等）
- 文件或回覆若需提供指令範例，必須使用 pnpm 指令格式。

## 開發流程與品質

- Git 提交需遵循 Conventional Commits，格式為
  `<type>(<scope>): <subject>`，且需包含 body 說明為何變更與影響範圍。
- subject 必須使用繁體中文、動詞開頭、簡短描述。
- scope 以模組/套件為主（例如 `web`、`api`、`ui`、`shared`）。

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

本憲法高於所有開發規範與模板，任何衝突以本憲法為準。
每次調整需更新版本號、修訂日期與變更摘要。
所有規格、計畫、任務文件必須檢查並符合核心原則。

**Version**: 0.1.0 | **Ratified**: TODO(RATIFICATION_DATE): 未提供原始制定日期 | **Last Amended**: 2026-01-11
