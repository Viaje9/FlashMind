# Change: 新增帳號與登入功能

## Why

FlashMind 目前沒有認證機制，使用者無法建立個人帳號與保存學習資料。帳號與登入是所有功能的前提，優先級為 P0。

## What Changes

- 新增 Email + 密碼註冊與登入
- 新增 Google OAuth 2.0 登入（Authorization Code Flow）
- 新增登出功能
- 前端新增登入/註冊表單頁面
- 後端新增 Auth 模組（Controller、Service、Guard）
- 資料庫新增密碼欄位與 OAuth Provider 關聯
- Session 使用 HttpOnly Cookie 儲存（依 ADR-016）
- 支援「記住我」功能延長 session 效期
- API 格式遵循 ADR-016（統一 Wrapper、Error 格式）

## Impact

- Affected specs: `account-auth` (新增)
- Affected ADR: ADR-016（API 設計規範）
- Affected code:
  - `openapi/api.yaml` - 已更新，新增 Auth 相關端點
  - `apps/api/src/auth/` - 新增 Auth 模組
  - `apps/api/prisma/schema.prisma` - 更新 User model，新增 Session、OAuthAccount
  - `apps/web/src/app/pages/login/` - 新增登入頁
  - `apps/web/src/app/pages/register/` - 新增註冊頁
  - `apps/web/src/app/services/auth/` - 新增 Auth service
  - `packages/api-client/` - 執行 generate:api 更新
