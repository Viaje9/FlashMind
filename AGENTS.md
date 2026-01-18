<!-- OPENSPEC:START -->
# OpenSpec Instructions

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

# Agents Guidelines

1. 所有文件與討論須使用 zh-tw。***

## 專案技術

- 前端：Angular 21 + Tailwind CSS v4
- 前端狀態管理：Angular Signal Stores
- 元件開發：Storybook
- 後端：NestJS
- ORM：Prisma
- DB：PostgreSQL
- API 契約：OpenAPI 3.0（Contract-First）
- 間隔重複演算法：FSRS (ts-fsrs)
- AI 服務：OpenAI / Claude API
- 應用形態：PWA
- Monorepo：pnpm workspace

## 目錄結構

```text
flashmind/
├── apps/
│   ├── web/                    # Angular PWA 前端
│   │   └── src/app/
│   │       ├── pages/          # 路由頁面元件
│   │       ├── components/     # 按領域分組（含 domain、store、form）
│   │       ├── guards/         # 路由守衛
│   │       └── services/       # 跨領域共用服務
│   ├── api/                    # NestJS 後端
│   │   └── src/
│   │       ├── modules/        # 按領域分組的模組
│   │       ├── common/         # 共用 guards、interceptors、pipes
│   │       └── prisma/         # Prisma 服務
│   └── docs-viewer/            # Astro 文件站台
├── packages/
│   ├── api-client/             # 自動生成的 API Client
│   ├── shared/                 # 前後端共用型別與驗證
│   ├── ui/                     # 共用 UI 元件庫
│   └── config/                 # 共用設定（eslint/tsconfig 等）
├── e2e/                        # E2E 測試（Playwright，獨立 workspace）
│   ├── playwright.config.ts
│   ├── fixtures/               # 測試資料
│   └── auth/                   # 認證相關測試
├── openapi/                    # OpenAPI 契約定義
├── openspec/                   # 變更提案管理
├── prototype/                  # Figma 匯出的設計稿
└── docs/                       # 專案層級文件
```

## 開發規範

- 只在 `apps/api` 使用 Prisma CLI，schema 路徑：`apps/api/prisma/schema.prisma`
- `.env` 放在專案根目錄，需包含 `DATABASE_URL`
- 使用 pnpm 指令（避免 npm/yarn）

## API 設計規範（ADR-016）

### Response 格式

統一使用 Wrapper 結構：

```json
{
  "data": { ... },
  "meta": { "nextCursor": "...", "hasMore": true }
}
```

### Error 格式

```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Email 或密碼錯誤"
  }
}
```

### 分頁

使用 cursor-based 分頁：

- `nextCursor`: 下一頁的 cursor（Base64 編碼）
- `hasMore`: 是否還有更多資料

### 認證

使用 HttpOnly Cookie：

```text
Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/
```

### 命名慣例

| 項目 | 格式 | 範例 |
|------|------|------|
| URL 路徑 | kebab-case | `/auth/google/callback` |
| Request/Response body | camelCase | `rememberMe` |
| Error code | SCREAMING_SNAKE_CASE | `AUTH_INVALID_CREDENTIALS` |
| operationId | camelCase | `getCurrentUser` |

### OpenAPI operationId

**每個 endpoint 必須定義 `operationId`**，它會決定自動生成的 API client 方法名稱：

```yaml
paths:
  /auth/me:
    get:
      operationId: getCurrentUser  # 生成 authService.getCurrentUser()
```

命名建議：
- 動詞開頭：`get`、`create`、`update`、`delete`、`list`
- 清楚描述動作：`getCurrentUser`、`initiateGoogleOAuth`
- 避免重複路徑資訊：用 `login` 而非 `authLogin`

### HTTP Status Code

| Status | 用途 |
|--------|------|
| 200 | 成功 |
| 201 | 建立成功 |
| 204 | 無內容（如登出） |
| 400 | 請求格式錯誤 |
| 401 | 未認證 |
| 403 | 無權限 |
| 404 | 資源不存在 |
| 409 | 資源衝突 |
| 422 | 商業邏輯錯誤 |
| 500 | 伺服器錯誤 |

## 前端開發規範

### 元件組織（共置原則）

按業務領域組織元件，Domain、Store、Form 放在對應的領域目錄中：

```text
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

### 分層架構

| 層級 | 檔案 | 職責 | 特性 |
|------|------|------|------|
| Domain | `*.domain.ts` | 商業邏輯、規則判斷 | Pure function、無框架依賴 |
| Store | `*.store.ts` | 狀態管理、API 呼叫 | 使用 Angular Signals |
| Form | `*.form.ts` | 表單結構、欄位驗證 | 使用 Reactive Forms |
| Component | `*.component.ts` | UI 渲染、使用者互動 | 使用 Store 與 Form |

### 業務元件放置規則

| 元件類型 | 放置位置 | 說明 |
|----------|----------|------|
| 通用 UI 元件 | `packages/ui/` | 無業務邏輯，純 UI |
| 共用業務元件 | `components/{domain}/` | 多個頁面會用到 |
| 頁面專屬元件 | `pages/{page}/components/` | 只有該頁面用到 |

### UI 元件庫結構（packages/ui）

```text
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

### 前端 testId 開發規範（ADR-019）

**開發前端頁面時，必須為所有可互動元素添加 testId**，確保 E2E 測試的穩定性。

#### 開發流程

當開發前端頁面時，**AI 助理會優先套用 `testid-guide` skill，為可互動元素添加 testId**。

#### 必須添加 testId 的元素

| 元素類型 | 說明 | 範例 |
|----------|------|------|
| 表單輸入 | input、textarea、select | `login-email`、`deck-form-name` |
| 按鈕 | 提交、取消、操作按鈕 | `login-submit`、`deck-form-delete` |
| 連結/導航 | 重要的路由連結 | `deck-detail-back`、`deck-detail-settings` |
| 錯誤訊息 | 表單驗證、API 錯誤 | `login-error`、`deck-form-error` |
| 列表項目 | 可點擊的列表項 | `deck-item-{id}`、`card-item-{id}` |
| 對話框 | dialog、modal | `confirm-dialog`、`delete-dialog` |
| 開關/切換 | toggle、checkbox | `login-remember-me`、`deck-form-public` |

#### 命名規範

**格式：`{page/context}-{element}[-{qualifier}]`**

- 使用 kebab-case
- 動作按鈕用動詞：`submit`、`cancel`、`delete`、`save`
- 輸入欄位用名詞：`email`、`password`、`name`

#### 使用方式

```html
<!-- UI 元件使用 testId 屬性 -->
<fm-button testId="login-submit">登入</fm-button>
<fm-labeled-input testId="login-email" ... />
<fm-icon-button testId="deck-detail-back" ... />

<!-- 原生元素使用 data-testid 屬性 -->
<div data-testid="deck-list-empty">尚無牌組</div>
```

#### 各頁面 testId 參考

詳細的各頁面 testId 規範請參考 `ADR-019`。常用範例：

| 頁面 | 元素 | testId |
|------|------|--------|
| 登入 | Email 輸入框 | `login-email` |
| 登入 | 密碼輸入框 | `login-password` |
| 登入 | 記住我 | `login-remember-me` |
| 登入 | 登入按鈕 | `login-submit` |
| 登入 | 錯誤訊息 | `login-error` |
| 牌組列表 | 搜尋輸入框 | `deck-list-search` |
| 牌組列表 | 新增按鈕 | `deck-list-create` |
| 牌組詳情 | 返回按鈕 | `deck-detail-back` |
| 牌組詳情 | 設定按鈕 | `deck-detail-settings` |
| 牌組詳情 | 開始學習 | `deck-detail-start-study` |
| 牌組表單 | 名稱輸入框 | `deck-form-name` |
| 牌組表單 | 儲存按鈕 | `deck-form-submit` |

### 前端表單開發規範（Signal Forms）

**使用 Angular Signal Forms（`@angular/forms/signals`）建立表單**。

#### 開發流程

當開發含有表單的前端頁面時，**AI 助理會優先套用 `form-guide` skill，使用 Signal Forms 模式開發**。

#### 重要：表單提交事件綁定

async `onSubmit()` 搭配 `(ngSubmit)` 會導致瀏覽器預設提交行為觸發，造成頁面重載。

```html
<!-- ❌ 錯誤寫法 - 會導致頁面重載 -->
<form (ngSubmit)="onSubmit()">

<!-- ✅ 正確寫法 -->
<form (submit)="$event.preventDefault(); onSubmit()">
```

#### 基本用法

```typescript
import { signal } from '@angular/core';
import { form, FormField, required, email, submit } from '@angular/forms/signals';

interface LoginFormData {
  email: string;
  password: string;
}

// 表單模型
readonly formModel = signal<LoginFormData>({ email: '', password: '' });

// 表單定義與驗證
readonly loginForm = form(this.formModel, (f) => {
  required(f.email, { message: '請輸入 Email' });
  email(f.email, { message: '請輸入有效的 Email 格式' });
  required(f.password, { message: '請輸入密碼' });
});

// 提交處理
async onSubmit(): Promise<void> {
  await submit(this.loginForm, async () => {
    const { email, password } = this.formModel();
    await this.authService.login(email, password);
  });
}
```

Template 使用 `[formField]` 綁定：

```html
<fm-labeled-input
  [formField]="loginForm.email"
  label="Email"
  placeholder="請輸入 Email"
/>
```

#### 常用驗證器

| 驗證器 | 說明 | 範例 |
|--------|------|------|
| `required()` | 必填 | `required(f.email, { message: '必填' })` |
| `email()` | Email 格式 | `email(f.email, { message: '格式錯誤' })` |
| `minLength()` | 最小長度 | `minLength(f.password, 8, { message: '至少 8 字' })` |
| `maxLength()` | 最大長度 | `maxLength(f.name, 50, { message: '最多 50 字' })` |
| `validate()` | 自訂驗證 | 見下方範例 |

**自訂驗證器**（如確認密碼）：

```typescript
validate(f.confirmPassword, ({ value }) => {
  if (value() && formModel().password && value() !== formModel().password) {
    return { kind: 'passwordMismatch', message: '密碼不一致' };
  }
  return undefined;
});
```

詳細規範參考 `ADR-012` Form 層範例。

## Git 提交規範

- 使用約定式提交（Conventional Commits）
- 標題格式：`<type>(<scope>): <subject>`
- 需包含提交內文（body），說明「為什麼要改」與「影響範圍」
- type 可用：`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`revert`
- scope 以模組/套件為主（例如 `web`、`api`、`ui`、`shared`）
- subject 使用繁體中文、動詞開頭、簡短描述
- 範例：
  - `feat(ui): 新增牌組卡片元件`
    ``
    `新增牌組卡片與進度條元件，提供 UI 預覽與互動事件。`
    `影響範圍：packages/ui 與 apps/web 預覽頁面。`
  - `fix(web): 修正搜尋欄位樣式`
    ``
    `修正搜尋輸入框在深色模式下對比不足的問題。`
    `影響範圍：apps/web 全站搜尋區塊。`
  - `chore(api): 更新 Prisma 產生流程`
    ``
    `調整 Prisma 產生命令與輸出路徑，方便 CI 使用。`
    `影響範圍：apps/api Prisma 指令與 CI 腳本。`

## 測試驅動開發（TDD）

採用 **Red-Green-Refactor** 循環：

1. **Red** → 先寫測試，確認測試失敗
2. **Green** → 寫最少的程式碼讓測試通過
3. **Refactor** → 重構程式碼，保持測試通過

### TDD 強制程度

| 層級 | TDD 強制程度 |
|------|--------------|
| 前端 Domain (`*.domain.ts`) | **強制** |
| 後端 Service | **強制** |
| E2E 測試（功能規格明確時） | **強制** |
| 前端元件、後端 Controller | 建議 |

### 測試覆蓋率目標

- Domain 層：90%+
- Service 層：80%+

## 指令範例

- 安裝：`pnpm install`
- Prisma：`pnpm --filter ./apps/api prisma:generate`、`pnpm --filter ./apps/api prisma:migrate`
- E2E 測試：`pnpm test:e2e`、`pnpm test:e2e:ui`

## Playwright MCP 使用規範（重要）

此專案為 monorepo，Playwright 安裝在 `e2e/` 目錄而非根目錄。使用 `playwright-test` MCP 工具時**必須指定 `seedFile` 參數**，否則會出現 `Cannot find module '@playwright/test'` 錯誤。

### 正確用法

```typescript
// generator_setup_page - 用於測試生成
mcp__playwright-test__generator_setup_page({
  plan: "測試計畫描述",
  seedFile: "e2e/tests/seed.spec.ts"  // 必須指定！
})

// planner_setup_page - 用於測試規劃
mcp__playwright-test__planner_setup_page({
  seedFile: "e2e/tests/seed.spec.ts"  // 必須指定！
})
```

### 錯誤用法（會失敗）

```typescript
// 缺少 seedFile 參數會導致模組找不到錯誤
mcp__playwright-test__generator_setup_page({
  plan: "測試計畫描述"
  // 缺少 seedFile！
})
```

### E2E 測試選擇器規範

撰寫 E2E 測試時**優先使用 `getByTestId()` 選擇器**：

```typescript
// 推薦 - 使用 data-testid
await page.getByTestId('login-email').fill('test@example.com');
await page.getByTestId('login-submit').click();

// 次要 - 使用 role + name
await page.getByRole('button', { name: '登入', exact: true }).click();
```
