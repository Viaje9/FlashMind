
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
- `.env` 放在 `apps/api/` 目錄，需包含 `DATABASE_URL`
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

**前端開發請參考 [Frontend Agent](.claude/agents/frontend.md)**，包含：
- 分層架構（Domain / Store / Form / Component）
- 元件組織與共置原則
- UI 元件庫結構
- 頁面元件組合規範
- testId 規範
- Signal Forms 表單開發

### 可用的 Skills

| Skill | 用途 |
|-------|------|
| `page-component-guide` | 頁面元件組合規範 |
| `form-guide` | Signal Forms 表單開發 |
| `testid-guide` | testId 命名與使用 |

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
