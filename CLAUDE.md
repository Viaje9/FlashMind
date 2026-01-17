# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- OPENSPEC:START -->
## OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

## Project Overview

FlashMind 是一個智慧閃卡學習應用程式，使用 FSRS（Free Spaced Repetition Scheduler）演算法進行間隔重複學習排程。

## Development Commands

### Root Level (pnpm monorepo)

```bash
pnpm dev:web          # 啟動前端開發伺服器
pnpm dev:api          # 啟動後端開發伺服器（watch mode）
pnpm dev:docs         # 啟動文件檢視器
pnpm storybook:web    # 啟動 Storybook
```

### Frontend (apps/web)

```bash
pnpm --filter ./apps/web start          # 啟動開發伺服器
pnpm --filter ./apps/web build          # 建構生產版本
pnpm --filter ./apps/web test           # 執行所有測試 (Vitest)
pnpm --filter ./apps/web storybook      # 啟動 Storybook
pnpm --filter ./apps/web generate:api   # 從 OpenAPI 規格產生 API 客戶端
```

### Backend (apps/api)

```bash
pnpm --filter ./apps/api start:dev      # 啟動開發伺服器（watch mode）
pnpm --filter ./apps/api build          # 建構專案
pnpm --filter ./apps/api test           # 執行單元測試 (Jest)
pnpm --filter ./apps/api test:watch     # 監聽模式執行測試
pnpm --filter ./apps/api test:e2e       # 執行 E2E 測試
pnpm --filter ./apps/api lint           # 執行 ESLint
pnpm --filter ./apps/api prisma:generate  # 產生 Prisma 客戶端
pnpm --filter ./apps/api prisma:migrate   # 執行資料庫遷移
```

## Architecture

### Monorepo Structure

- **apps/web**: Angular 21 前端，使用 Standalone Components、Signals、TailwindCSS 4
- **apps/api**: NestJS 11 後端，使用 Prisma 6 作為 ORM，PostgreSQL 資料庫
- **apps/docs-viewer**: Astro 文件檢視器
- **packages/ui**: 共用 Angular UI 元件庫（`@flashmind/ui`）
- **packages/api-client**: OpenAPI 自動產生的 TypeScript Angular 客戶端（`@flashmind/api-client`）
- **packages/config**: 共用設定
- **packages/shared**: 共用工具

### API-First Development

1. 在 `openapi/` 撰寫 OpenAPI 規格
2. 執行 `pnpm --filter ./apps/web generate:api` 產生 TypeScript 客戶端至 `packages/api-client`
3. 前後端依規格實作

### Frontend Patterns

- **Standalone Components**: 無 NgModule，所有元件皆為 standalone
- **Signal-based State**: 使用 Angular Signals 進行狀態管理
- **頁面路由**: `pages/` 目錄包含路由元件，使用 lazy loading
- **共用元件**: `components/` 目錄依功能分類（auth、card、deck、study、dialog）
- **服務**: 透過 Angular DI 注入

### Backend Patterns

- **模組化**: Controller → Service → Repository 分層
- **Prisma**: 資料存取層，schema 位於 `apps/api/prisma/schema.prisma`
- **測試**: 單元測試 `*.spec.ts`，E2E 測試 `test/*.e2e-spec.ts`

## Code Conventions

### Language & Commit

- 所有文件、commit 訊息、UI 文字使用**繁體中文**
- Commit 格式：`(type) 描述`
- Type：`feat`、`fix`、`chore`、`ci`、`docs`

### TypeScript

- 嚴格模式（`strict: true`）
- 檔案命名：kebab-case（e.g., `deck-list.component.ts`）
- 類別命名：PascalCase
- 變數/函式：camelCase

### Styling

- Prettier：`printWidth: 100`、`singleQuote: true`
- Frontend ESLint 與 Prettier 整合
- `@typescript-eslint/no-explicit-any`: off（允許 any）
