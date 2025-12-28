# Agents Guidelines

1. 所有文件與討論須使用 zh-tw。***

## 專案技術

- 前端：Angular（最新版）+ Tailwind CSS v4
- 後端：NestJS
- ORM：Prisma
- DB：PostgreSQL
- Monorepo：pnpm workspace

## 目錄結構

- `apps/web/`：前端（Angular）
- `apps/api/`：後端（NestJS）
- `apps/api/prisma/`：Prisma schema 與 migrations
- `packages/shared/`：前後端共用型別/DTO
- `packages/config/`：共用設定（eslint/tsconfig 等）

## 開發規範

- 只在 `apps/api` 使用 Prisma CLI，schema 路徑：`apps/api/prisma/schema.prisma`
- `.env` 放在專案根目錄，需包含 `DATABASE_URL`
- 使用 pnpm 指令（避免 npm/yarn）

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

## 指令範例

- 安裝：`pnpm install`
- Prisma：`pnpm --filter ./apps/api prisma:generate`、`pnpm --filter ./apps/api prisma:migrate`
