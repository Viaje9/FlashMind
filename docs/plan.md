# 實作計畫：Anki-like 背單字工具

## 摘要

Mobile-first 背單字 PWA。前端 **Angular 20 + Material**、後端 **NestJS + PostgreSQL + Prisma**。
三向滑動（左/上/右）對應 FSRS（Again/Hard/Easy），AI 由 **Gemini 2.5-flash** 產生義項/例句。
**Monorepo 採純 `pnpm workspaces`**；OpenAPI 以 **JSON** 發佈並以 **openapi-generator-cli** 產生 Angular services。
匿名時僅本機 IndexedDB；登入後由伺服器計算 FSRS 並覆寫前端。**devContainer 內建 PostgreSQL**，一鍵進容器即用。

---

## 技術上下文 (Technical Context)

**語言/版本**：TypeScript 5、Angular 20、NestJS 10
**主要相依性**：Angular Material、Tailwind、Dexie、Prisma、@google/generative-ai（或 REST）、openapi-generator-cli、Jest、Playwright、Storybook
**儲存方式**：PostgreSQL（伺服器）＋ IndexedDB/Dexie（前端離線）
**測試**：前端 Jest + Playwright；後端 Jest + Supertest
**目標平台**：PWA（行動瀏覽器）
**專案類型**：Web application（**pnpm workspaces**）
**效能目標**：滑動回饋 < 100ms；AI 回覆 < 3s
**限制條件**：可離線、Mobile-first、單手操作、無 gamification
**規模/範圍**：~4 畫面（首頁/牌組/設定/複習）；1 萬使用者級

---

## 專案憲章檢查 (Constitution Check)

* Library-First：`packages/fsrs-core` 共用演算法 ✅
* TDD：Jest / Playwright 覆蓋核心互動 ✅
* 契約驅動：OpenAPI JSON → Angular client ✅
* UI 可預覽：Storybook（Angular）✅

---

## 專案結構

### 文件（本功能）

```
specs/001-vocabulary-tool/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### 原始碼（Monorepo）

```
apps/
  frontend/
    .storybook/
    src/app/
      pages/           # home, decks, settings, review
      components/      # Card, BottomNav, DeckTile...
      services/        # fsrs-adapter, sync, decks, cards, ai, auth
      data/            # dexie schema
      routes/
    tests/{unit,e2e}
  backend/
    src/
      modules/
        auth/
        decks/
        cards/
        reviews/
        ai/            # Gemini proxy
        fsrs/          # uses packages/fsrs-core
      common/
      main.ts
    prisma/schema.prisma
    tests/{unit,e2e}

packages/              # <-- 共用層（最外層）
  fsrs-core/           # 純 TS，前後端共用
  contracts/           # openapi.json 與（可選）型別
  ui/                  # 共用 Material 元件（storybook 展示）

.devcontainer/         # VS Code Dev Containers（含 PostgreSQL）
```

**結構決策**：採「前端 + 後端 + 共用 packages」的 **pnpm workspaces**；不引入 Nx/Turbo。

---

## 開發環境（DevContainer + PostgreSQL）

### 目錄

```
.devcontainer/
├── devcontainer.json
├── docker-compose.yml
└── Dockerfile
```

### `.devcontainer/devcontainer.json`

```jsonc
{
  "name": "VocabularyTool Dev",
  "dockerComposeFile": "docker-compose.yml",
  "service": "app",
  "workspaceFolder": "/workspace",
  "runServices": ["app", "db"],
  "shutdownAction": "stopCompose",
  "customizations": {
    "vscode": {
      "settings": {
        "terminal.integrated.defaultProfile.linux": "zsh",
        "editor.formatOnSave": true
      },
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "angular.ng-template",
        "Prisma.prisma",
        "bradlc.vscode-tailwindcss",
        "ms-playwright.playwright",
        "ms-azuretools.vscode-docker"
      ]
    }
  },
  "postCreateCommand": "pnpm install && pnpm build",
  "forwardPorts": [4200, 3000, 6006, 5432],
  "portsAttributes": {
    "4200": { "label": "Frontend" },
    "3000": { "label": "Backend" },
    "6006": { "label": "Storybook" },
    "5432": { "label": "Postgres" }
  },
  "remoteUser": "node"
}
```

### `.devcontainer/docker-compose.yml`

```yaml
version: '3.8'

services:
  app:
    build:
      context: ..
      dockerfile: .devcontainer/Dockerfile
    volumes:
      - ..:/workspace:cached
    command: sleep infinity
    environment:
      DATABASE_URL: postgres://postgres:postgres@db:5432/vocabdb
    ports:
      - "4200:4200"
      - "3000:3000"
      - "6006:6006"
    depends_on:
      - db
    user: node

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: vocabdb
    volumes:
      - vocab_pg_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  vocab_pg_data:
```

### `.devcontainer/Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-bookworm

RUN apt-get update && apt-get install -y \
  zsh git curl wget postgresql-client \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /workspace

# Playwright e2e 依賴
RUN npx playwright install-deps

USER node
CMD ["zsh"]
```

### 使用流程

1. VS Code 打開專案 → **Reopen in Container**
2. 自動執行：`pnpm install && pnpm build`
3. 測試 DB：`psql -h db -U postgres -d vocabdb`
4. 啟動：

   * 後端：`pnpm --filter @app/backend start:dev`
   * 前端：`pnpm --filter @app/frontend start`
   * Storybook：`pnpm storybook`

---

## 前端 (Angular 20 PWA)

* Angular 20（standalone + signals）
* **Angular Material**（icon-only BottomNav、Card、Dialog 等）＋ Tailwind 佈局
* PWA（Service Worker）＋ IndexedDB（Dexie）匿名儲存
* **OpenAPI 產生的 Angular services** 連後端
* Storybook（`apps/frontend/.storybook/`）展示元件
* 測試：Jest（unit）、Playwright（e2e）

---

## 後端 (NestJS)

* NestJS + Prisma + PostgreSQL
* AI 代理：**Gemini 2.5-flash**（後端呼叫；前端不直連）
* **OpenAPI JSON 發佈**：`/packages/contracts/openapi.json`
* 測試：Jest + Supertest
* 匿名/登入策略：未登入不上傳；登入後以後端 FSRS 為權威

---

## OpenAPI（JSON）→ Angular 服務

* 後端啟動/建置後寫出 `packages/contracts/openapi.json`
* `openapi.config.json`（根目錄）：

```json
{
  "generatorName": "typescript-angular",
  "inputSpec": "packages/contracts/openapi.json",
  "output": "apps/frontend/src/app/generated-api",
  "additionalProperties": {
    "ngVersion": "20.0.0",
    "serviceSuffix": "Api",
    "providedInRoot": true,
    "useSingleRequestParameter": true,
    "stringEnums": true
  }
}
```

* 前端執行：`pnpm contracts:gen` 產生可注入 services（**產出納入版本控管**）。

---

## FSRS（前後端雙實作）

* `packages/fsrs-core` 暴露：`review(cardState, rating) -> nextState`
* **匿名**：前端本地 FSRS（IndexedDB）；不上傳
* **登入**：上傳 ReviewLog → 後端以 `fsrs-core` 計算 `CardState` → 覆寫前端
* 規則：Again 同日 10→20→40 分鐘（最多 3 次）；Hard 明日優先；Easy 間隔提升（上限 180 天）

---

## AI（Gemini 2.5-flash）

* 後端 proxy 端點：

  * `POST /ai/generate-card` → senses（meaning, exampleEN, exampleZH）
  * `POST /ai/rewrite-example`
* 安全：API key 僅後端持有；節流＋快取（相同 term 短期快取）

---

## 同步策略

| 狀態   | 權威                          | 行為                                 |
| ---- | --------------------------- | ---------------------------------- |
| 匿名   | 前端                          | 只存 IndexedDB；不上傳                   |
| 登入   | 後端                          | 上傳 ReviewLog → 重算 CardState → 回寫前端 |
| 合併   | 後端                          | 登入時合併 deviceId 歷史到 userId          |
| 牌組名稱 | 唯一（同 owner；大小寫不敏感、trim 後比較） |                                    |

---

## Storybook

* 位置：`apps/frontend/.storybook/`；指令：`pnpm storybook`
* 元件：`CardComponent.stories.ts`、`BottomNavComponent.stories.ts` 等
* 可用 Playwright 對 Storybook 視覺回歸（選配）

---

## 非功能需求

* Mobile-first、單手操作；滑動動畫 < 100ms；反應 < 300ms
* 觸控最小面積 44×44pt
* 主要 UI 元件需可在 Storybook 預覽

---

## 成功標準

* 平均每日複習 ≥ 8 分鐘
* 兩週新增單字 ≥ 70
* 到期卡完成率 ≥ 85%
* 多義首試答對 ≥ 60%

---

## 複雜度追蹤

| 違規項目              | 為何需要                          | 為何拒絕更簡方案   |
| ----------------- | ----------------------------- | ---------- |
| 前後端雙 FSRS         | 離線＋登入精準同步                     | 單端無法離線運作   |
| Monorepo          | 共用 fsrs-core / contracts / ui | 分倉易版本漂移    |
| DevContainer + DB | 一致環境與可重現性                     | 本機安裝差異造成落差 |

---
