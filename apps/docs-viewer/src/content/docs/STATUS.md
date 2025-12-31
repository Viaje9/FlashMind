---
title: "專案進度摘要"
summary: "彙整已完成項目、目前狀態與下一步建議。"
---

# 專案進度摘要

## 已完成
- 建立 pnpm workspace 基礎結構（`apps/`、`packages/`、`scripts/`）。
- 初始化 Angular 與 NestJS 專案（位於 `apps/web`、`apps/api`）。
- 建立 Prisma 基礎架構：
  - `apps/api/prisma/schema.prisma`
  - NestJS Prisma module 與 service
  - Prisma scripts 綁定於 `apps/api`（`prisma:generate`、`prisma:migrate`）
- 本機 PostgreSQL 已可執行 `prisma migrate`。
- 補上 `.gitignore` 與更新 `AGENTS.md`。

## 目前狀態
- Prisma 已可 `generate` 與 `migrate`。
- `apps/api` 已連結 Prisma module。
- `.env` 已建立並可被 Prisma 讀取。

## 下一步建議
1. 定義完整資料模型（User、Deck、Card、Review、RefreshToken 等）。
2. 建立 NestJS 認證與 JWT 流程（login/refresh/logout）。
3. 建立 Angular + Tailwind 4 的基礎樣式與 layout。
4. 設計 API 合約與 DTO（可同步到 `packages/shared/`）。

## 重要指令
- 安裝依賴：`pnpm install`
- Prisma 產生：`pnpm --filter ./apps/api prisma:generate`
- Prisma migration：`pnpm --filter ./apps/api prisma:migrate`
