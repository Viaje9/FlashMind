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
- **E2E 測試**: Playwright 1.57
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
├── e2e/              # E2E 測試（Playwright）
├── openapi/          # OpenAPI 規格
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

**前端分層架構 (Angular)**:

| 層級 | 檔案 | 職責 | 特性 |
|------|------|------|------|
| Domain | `*.domain.ts` | 商業邏輯、規則判斷 | Pure function、無框架依賴 |
| Store | `*.store.ts` | 狀態管理、API 呼叫 | 使用 Angular Signals |
| Form | `*.form.ts` | 表單結構、欄位驗證 | 使用 Signal Forms |
| Component | `*.component.ts` | UI 渲染、使用者互動 | 使用 Store 與 Form |

**前端元件組織（共置原則）**:

按業務領域組織元件，Domain、Store、Form 放在對應的領域目錄中：
```
apps/web/src/app/components/
├── auth/                       # 登入/註冊領域
│   ├── auth.domain.ts          # 商業邏輯
│   ├── auth.store.ts           # 狀態管理
│   ├── auth.form.ts            # 表單定義
│   ├── login/
│   └── register/
├── deck/                       # 牌組領域
├── card/                       # 卡片領域
├── study/                      # 學習領域
└── shared/                     # 跨領域共用 UI 元件
```

**業務元件放置規則**:
| 元件類型 | 放置位置 | 說明 |
|----------|----------|------|
| 通用 UI 元件 | `packages/ui/` | 無業務邏輯，純 UI |
| 共用業務元件 | `components/{domain}/` | 多個頁面會用到 |
| 頁面專屬元件 | `pages/{page}/components/` | 只有該頁面用到 |

**前端通用規範**:
- Standalone components (無 NgModule)
- Signal-based 狀態管理
- 服務透過 DI 注入

**後端 (NestJS)**:
- 模組化架構
- Controller → Service → Repository 分層
- Prisma 作為資料存取層

**API 開發流程**:
1. 在 `openapi/` 撰寫 OpenAPI 規格
2. 執行 `generate:api` 產生 TypeScript 客戶端
3. 前後端依規格實作

### Testing Strategy

**測試驅動開發 (TDD)**:

採用 Red-Green-Refactor 循環：
1. Red → 先寫測試，確認測試失敗
2. Green → 寫最少的程式碼讓測試通過
3. Refactor → 重構程式碼，保持測試通過

TDD 強制範圍：
- 前端 Domain 層 (`*.domain.ts`) - **強制**
- 後端 Service 層 - **強制**
- E2E 測試（功能規格明確時） - **強制**

覆蓋率目標：Domain 90%+、Service 80%+

**前端 (Vitest)**:
- 單元測試放在 `*.spec.ts`
- 使用 jsdom 環境

**後端 (Jest)**:
- 單元測試: `*.spec.ts`
- API E2E 測試: `test/*.e2e-spec.ts`
- 測試覆蓋率報告

**E2E 測試 (Playwright)**:
- 位置: `e2e/`（獨立 workspace package）
- 按領域分組: `auth/`, `deck/`, `card/`, `study/`
- 執行: `pnpm test:e2e` 或 `pnpm test:e2e:ui`

**E2E 測試選擇器規範**:
優先使用 `getByTestId()` 選擇器：
```typescript
// 推薦 - 使用 data-testid
await page.getByTestId('login-email').fill('test@example.com');
await page.getByTestId('login-submit').click();

// 次要 - 使用 role + name
await page.getByRole('button', { name: '登入', exact: true }).click();
```

**Playwright MCP 使用規範**:
此專案為 monorepo，Playwright 安裝在 `e2e/` 目錄。使用 `playwright-test` MCP 工具時**必須指定 `seedFile` 參數**：
```typescript
mcp__playwright-test__generator_setup_page({
  plan: "測試計畫描述",
  seedFile: "e2e/tests/seed.spec.ts"  // 必須指定！
})
```

**元件開發**:
- 使用 Storybook 進行視覺化開發與測試

### 前端開發規範

**詳細規範請參考 [Frontend Agent](/.claude/agents/frontend.md)**，包含：
- 頁面元件組合規範（Page 只處理 Layout）
- testId 規範（ADR-019）
- Signal Forms 表單開發

**可用的 Skills**:
| Skill | 用途 |
|-------|------|
| `page-component-guide` | 頁面元件組合 |
| `form-guide` | Signal Forms 表單 |
| `testid-guide` | testId 命名 |

### Git Workflow

**Commit 格式（Conventional Commits）**:
```
<type>(<scope>): <subject>

<body>
```

- 標題：`<type>(<scope>): <subject>`
- 內文（body）：說明「為什麼要改」與「影響範圍」
- subject 使用繁體中文、動詞開頭、簡短描述

**Type 類型**:
- `feat`: 新功能
- `fix`: 修復 bug
- `docs`: 文件更新
- `style`: 格式調整
- `refactor`: 重構
- `perf`: 效能優化
- `test`: 測試
- `build`: 建構相關
- `ci`: CI/CD 相關
- `chore`: 雜項維護
- `revert`: 回退

**Scope**:
- 以模組/套件為主：`web`、`api`、`ui`、`shared`

**範例**:
```
feat(ui): 新增牌組卡片元件

新增牌組卡片與進度條元件，提供 UI 預覽與互動事件。
影響範圍：packages/ui 與 apps/web 預覽頁面。
```

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

## Design System

**色彩 Tokens** (定義於 `packages/ui/src/styles/tokens.css`):
- `--color-primary`: #19b3e6 (主色調)
- `--color-primary-dark`: #0ea5e9
- `--color-background-light`: #f6f7f8
- `--color-background-dark`: #111d21
- `--color-surface-light`: #ffffff
- `--color-surface-dark`: #1a262a
- `--color-card-dark`: #1e282c
- `--color-secondary-text`: #93aeb8
- `--color-error`: #ff6b6b

**字體**:
- Display: Lexend, Noto Sans TC, sans-serif
- Body: Noto Sans TC, sans-serif

**UI 元件庫結構** (`packages/ui/src/lib/`):
```
packages/ui/src/lib/
├── primitives/       # 最基礎元件（button, badge, toggle）
├── layouts/          # 版面配置（row, column, stack）
├── forms/            # 表單輸入（labeled-input, textarea）
├── navigation/       # 導航相關（navbar, tabs）
├── feedback/         # 使用者回饋（toast, loading-spinner）
├── data-display/     # 資料展示（card, list-item, avatar）
└── overlays/         # 浮層元件（dialog, drawer, popover）
```

浮層元件透過 Service 呼叫，而非直接在 template 中使用。

**目前已實作**:
- `primitives/`: Button, IconButton, Badge, ProgressBar, Toggle, SearchInput, Fab, Divider
- `navigation/`: PageHeader
- `data-display/`: SettingRow, ProfileCard, SectionHeading
- `forms/`: LabeledInput, NumberInputRow, FormSectionHeader, GlowTextarea, AddItemButton, SocialLoginRow
- `feedback/`: EmptyState
- `overlays/`: Dialog

## Current Routes

```
/welcome          # 歡迎頁面（預設）
/decks            # 牌組列表
/decks/new        # 建立牌組
/decks/:id        # 牌組詳情
/cards/new        # 新增卡片
/study            # 學習模式
/settings         # 設定頁面
```

## Application Components

**頁面元件** (`apps/web/src/app/pages/`):
- WelcomeComponent: 歡迎/登入頁面
- DeckListComponent: 牌組列表
- DeckCreateComponent: 建立牌組
- DeckDetailComponent: 牌組詳情
- CardEditorComponent: 卡片編輯器
- StudyComponent: 學習模式
- SettingsComponent: 設定

**功能元件** (`apps/web/src/app/components/`):
- `auth/`: WelcomeHero
- `card/`: CardListItem, MeaningEditorCard
- `deck/`: DeckCard, DeckStatsCard
- `study/`: StudyCard, StudyProgress, StudyDecisionBar
- `dialog/`: ConfirmDialog

**服務** (`apps/web/src/app/services/`):
- `dialog/`: DialogService, DialogRef, DialogConfig

## API Design (ADR-016)

**Response 格式**：統一 Wrapper
```json
{
  "data": { ... },
  "meta": { "nextCursor": "...", "hasMore": true }
}
```

**Error 格式**：
```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Email 或密碼錯誤"
  }
}
```

**分頁**：cursor-based
- `nextCursor`: 下一頁的 cursor
- `hasMore`: 是否還有更多資料

**認證方式**：HttpOnly Cookie
```
Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/
```

**命名慣例**：
- URL: kebab-case (`/auth/google/callback`)
- Request/Response body: camelCase (`rememberMe`)
- Error code: SCREAMING_SNAKE_CASE (`AUTH_INVALID_CREDENTIALS`)
- operationId: camelCase (`getCurrentUser`)，必填，決定 API client 方法名

## API Contracts

**已定義的 API** (`openapi/api.yaml`):
- `POST /auth/register`: Email 註冊
- `POST /auth/login`: Email 登入
- `POST /auth/logout`: 登出
- `GET /auth/google`: 發起 Google OAuth
- `GET /auth/google/callback`: Google OAuth callback
- `GET /auth/me`: 取得目前使用者資訊

## Data Models

**目前 Prisma Schema** (`apps/api/prisma/schema.prisma`):
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**規劃中模型** (見 `add-account-auth` 提案):
- User: 新增 `passwordHash`, `primaryProvider`, `lastLoginAt`
- Session: 工作階段管理
- OAuthAccount: Google OAuth 帳號關聯

**未來規劃模型**:
- Deck: 牌組
- Card: 卡片（含 FSRS 排程資料）
- StudySession: 學習記錄
