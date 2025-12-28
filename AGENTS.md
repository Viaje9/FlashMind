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

## 指令範例

- 安裝：`pnpm install`
- Prisma：`pnpm --filter ./apps/api prisma:generate`、`pnpm --filter ./apps/api prisma:migrate`
