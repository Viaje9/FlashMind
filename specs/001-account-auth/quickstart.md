# 快速開始：帳號與登入

**日期**: 2026-01-11  
**規格來源**: /Users/brian/Documents/SideProject/GitHub/FlashMind/specs/001-account-auth/spec.md

## 先決條件

- 已安裝 pnpm（依 repo 設定為 `pnpm@10.26.2`）
- 本機可連線的 PostgreSQL
- `/Users/brian/Documents/SideProject/GitHub/FlashMind/.env` 內含 `DATABASE_URL`

## 啟動步驟（目前可執行）

1. 安裝依賴
   ```bash
   pnpm install
   ```
2. 產生 Prisma Client
   ```bash
   pnpm --filter ./apps/api prisma:generate
   ```
3. 套用資料庫遷移
   ```bash
   pnpm --filter ./apps/api prisma:migrate
   ```
4. 啟動後端 API
   ```bash
   pnpm dev:api
   ```
5. 啟動前端
   ```bash
   pnpm dev:web
   ```

## 驗證 UI 現況

- 歡迎頁：`/welcome`
- 設定頁（含登出按鈕切版）：`/settings`

## 待補齊項目（規劃中）

- OpenAPI 產出：`/Users/brian/Documents/SideProject/GitHub/FlashMind/apps/api/openapi/openapi.json`
- 前端 Client 生成（OpenAPI Generator + typescript-angular）：`/Users/brian/Documents/SideProject/GitHub/FlashMind/packages/api-client/src/generated/`
