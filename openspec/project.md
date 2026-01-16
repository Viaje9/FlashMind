# Project Context

## Purpose

FlashMind 是一個智慧閃卡學習應用程式，類似 Anki，幫助使用者透過間隔重複學習法有效記憶知識。使用者可以建立牌組（Deck）、新增卡片（Card），並透過 FSRS 演算法進行智慧學習排程。

## Tech Stack

### Frontend (apps/web)
- **框架**: Angular 21
- **語言**: TypeScript 5.9
- **樣式**: TailwindCSS 4
- **元件開發**: Storybook 10
- **測試**: Vitest 4
- **建構工具**: Angular CLI / Vite

### Backend (apps/api)
- **框架**: NestJS 11
- **語言**: TypeScript 5.7
- **ORM**: Prisma 6
- **資料庫**: PostgreSQL
- **測試**: Jest 30

### 共用
- **套件管理**: pnpm 10.26.2 (Monorepo)
- **API 規格**: OpenAPI 3.x + openapi-generator-cli
- **版本控制**: Git

### 專案結構
```
FlashMind/
├── apps/
│   ├── web/          # Angular 前端
│   ├── api/          # NestJS 後端
│   └── docs-viewer/  # 文件檢視器
├── packages/
│   ├── api-client/   # 自動生成的 API 客戶端
│   ├── ui/           # 共用 UI 元件
│   ├── config/       # 共用設定
│   └── shared/       # 共用工具
├── specs/            # 功能規格文件
└── openspec/         # OpenSpec 設定
```

## Project Conventions

### Code Style

**Prettier 設定** (apps/web):
- `printWidth`: 100
- `singleQuote`: true
- HTML 使用 Angular parser

**ESLint** (apps/api):
- 繼承 `@eslint/js` 推薦設定
- 使用 `typescript-eslint` 的 `recommendedTypeChecked`
- `@typescript-eslint/no-explicit-any`: off
- 整合 Prettier

**TypeScript**:
- 嚴格模式 (`strict: true`)
- `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- Angular 元件使用 `ChangeDetectionStrategy.OnPush`

**命名慣例**:
- 檔案名稱: kebab-case (e.g., `deck-list.component.ts`)
- 類別名稱: PascalCase (e.g., `DeckListComponent`)
- 變數/函式: camelCase

### Architecture Patterns

**前端 (Angular)**:
- Standalone components (無 NgModule)
- Signal-based 狀態管理
- 依功能分頁面 (`pages/`) 和元件 (`components/`)
- 服務透過 DI 注入

**後端 (NestJS)**:
- 模組化架構
- Controller → Service → Repository 分層
- Prisma 作為資料存取層

**API 開發流程**:
1. 在 `specs/` 撰寫 OpenAPI 規格
2. 執行 `generate:api` 產生 TypeScript 客戶端
3. 前後端依規格實作

### Testing Strategy

**前端 (Vitest)**:
- 單元測試放在 `*.spec.ts`
- 使用 jsdom 環境

**後端 (Jest)**:
- 單元測試: `*.spec.ts`
- E2E 測試: `test/*.e2e-spec.ts`
- 測試覆蓋率報告

**元件開發**:
- 使用 Storybook 進行視覺化開發與測試

### Git Workflow

**Commit 格式**:
```
(type) 描述（繁體中文）
```

**Type 類型**:
- `feat`: 新功能
- `fix`: 修復 bug
- `chore`: 雜項維護
- `ci`: CI/CD 相關
- `docs`: 文件更新

**分支策略**:
- `main`: 主分支
- 功能分支: 以編號命名 (e.g., `001-account-auth`)

## Domain Context

**核心概念**:
- **使用者 (User)**: 可註冊、登入的帳號
- **牌組 (Deck)**: 卡片的集合，類似資料夾
- **卡片 (Card)**: 學習的基本單位，包含正反面內容
- **學習模式 (Study)**: 使用 FSRS 演算法排程的學習流程

**FSRS 演算法**:
- Free Spaced Repetition Scheduler
- 根據使用者記憶表現動態調整複習間隔
- 比傳統 SM-2 演算法更精準

**使用者流程**:
1. 註冊/登入
2. 建立或選擇牌組
3. 新增卡片
4. 進入學習模式
5. 系統根據 FSRS 排程複習

## Important Constraints

- **語言**: 所有文件、commit 訊息、UI 文字使用繁體中文 (zh-tw)
- **登入方式**: 目前僅支援 Email + 密碼 和 Google OAuth
- **不包含**: Email 驗證、忘記密碼功能（暫定）
- **瀏覽器支援**: 現代瀏覽器 (Chrome, Firefox, Safari, Edge)

## External Dependencies

**第三方服務**:
- Google OAuth 2.0 (登入用)
- PostgreSQL 資料庫

**主要套件**:
- `@angular/cdk`: Angular Component Dev Kit
- `@prisma/client`: 資料庫 ORM
- `rxjs`: 響應式程式設計
- `@nestjs/*`: 後端框架生態系
