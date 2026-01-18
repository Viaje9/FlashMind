# Tasks: 帳號與登入功能

## 1. OpenAPI 規格更新

- [x] 1.1 更新 `openapi/api.yaml` 符合 ADR-016（統一 Wrapper、Error 格式）
- [x] 1.2 新增 `/auth/google` 發起 OAuth 端點
- [x] 1.3 新增 `/auth/google/callback` OAuth callback 端點
- [x] 1.4 新增 `/auth/me` 取得目前使用者端點
- [x] 1.5 更新 `LoginRequest` schema 新增 `rememberMe` 欄位
- [x] 1.6 更新認證方式為 cookieAuth（HttpOnly Cookie）

## 2. 資料庫 Schema 更新

- [x] 2.1 更新 `User` model 新增 `passwordHash`、`primaryProvider`、`lastLoginAt` 欄位
- [x] 2.2 新增 `OAuthAccount` model 儲存 Google provider 資訊
- [x] 2.3 新增 `Session` model 管理使用者工作階段
- [x] 2.4 執行 `prisma generate` 並驗證

## 3. 後端 Auth 模組

- [x] 3.1 建立 `auth` 模組資料夾結構 (`controller`, `service`, `dto`, `guard`)
- [x] 3.2 實作 `AuthService` - 註冊邏輯（Email + 密碼雜湊）
- [x] 3.3 實作 `AuthService` - 登入邏輯（密碼驗證）
- [x] 3.4 實作 `AuthService` - Google OAuth callback 處理
- [x] 3.5 實作 `AuthService` - 登出與 session 撤銷
- [x] 3.6 實作 `SessionService` - Session 建立、驗證、刷新
- [x] 3.7 實作 `AuthController` - `/auth/register`, `/auth/login`, `/auth/logout` endpoints
- [x] 3.8 實作 `AuthController` - `/auth/google`, `/auth/google/callback` endpoints
- [x] 3.9 實作 `AuthController` - `/auth/me` endpoint
- [x] 3.10 實作 `AuthGuard` - HttpOnly Cookie session 驗證
- [x] 3.11 設定環境變數 (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`)
- [x] 3.12 撰寫單元測試覆蓋主要邏輯

## 4. 前端 API 客戶端生成

- [x] 4.1 執行 `pnpm --filter ./apps/web generate:api` 從 OpenAPI 規格產生 API 客戶端
- [x] 4.2 確認 `packages/api-client` 產生的 Auth 相關 service 與 model

## 5. 前端 Auth 頁面

- [x] 5.1 建立 `AuthService` 管理登入狀態（Signal-based）
- [x] 5.2 建立 `/login` 登入頁面元件
- [x] 5.3 建立 `/register` 註冊頁面元件
- [x] 5.4 更新 `/welcome` 頁面連結至登入/註冊
- [x] 5.5 建立 `AuthGuard` 保護需登入的路由
- [x] 5.6 更新 `/settings` 頁面登出功能連接 API
- [x] 5.7 處理 Google OAuth redirect（導向 `/auth/google`）
- [x] 5.8 實作「記住我」勾選框並傳遞參數

## 6. 整合與測試

- [x] 6.1 E2E 測試 - Email 註冊流程
- [x] 6.2 E2E 測試 - Email 登入流程
- [x] 6.3 E2E 測試 - Google OAuth 登入流程
- [x] 6.4 E2E 測試 - 登出流程
- [x] 6.5 驗證 session 過期與「記住我」效期邏輯
- [x] 6.6 更新 Storybook 展示登入/註冊表單元件
