# Design: 帳號與登入功能

## Context

FlashMind 需要認證機制讓使用者建立帳號並保存學習資料。支援 Email + 密碼與 Google OAuth 兩種登入方式。

**利害關係人：** 終端使用者、前端、後端

**限制條件：**

- 不包含 Email 驗證與忘記密碼功能（暫定）
- 僅支援 Google OAuth，不支援 Apple/Facebook

**相關 ADR：**

- ADR-016：API 設計規範（Response/Error 格式、認證機制、分頁）

## Goals / Non-Goals

**Goals:**

- 使用者可透過 Email + 密碼註冊與登入
- 使用者可透過 Google OAuth 登入
- Session 安全儲存於 HttpOnly Cookie（依 ADR-016）
- 支援「記住我」延長登入效期

**Non-Goals:**

- Email 驗證流程
- 忘記密碼/重設密碼
- 多重身份驗證 (MFA)
- 社交帳號連結（同一帳號綁定多個 provider）

## Decisions

### 1. Google OAuth 流程

**Decision:** 使用 Authorization Code Flow

**Rationale:**

- Token 交換在後端進行，client_secret 不外洩
- 符合 OAuth 2.0 最佳實踐
- 可取得 refresh_token 供未來擴展使用

**Flow:**

```text
1. 使用者點擊 Google 登入 → 前端導向 GET /auth/google
2. 後端重新導向至 Google 授權頁
3. 使用者同意 → Google 回傳 code 至 GET /auth/google/callback
4. 後端用 code 交換 access_token + id_token
5. 後端驗證 id_token，建立/更新使用者，建立 session
6. 回傳 Set-Cookie 並導向前端主頁
```

### 2. 密碼儲存

**Decision:** 使用 bcrypt 雜湊，cost factor 12

**Rationale:**

- 業界標準，廣泛使用
- Cost 12 在安全與效能間取得平衡

### 3. Session 管理

**Decision:** 資料庫儲存 Session，支援多裝置登入

**Schema:**

```prisma
model Session {
  id           String   @id @default(cuid())
  userId       String
  token        String   @unique
  userAgent    String?
  ipAddress    String?
  expiresAt    DateTime
  rememberMe   Boolean  @default(false)
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Session 效期：**

- 一般：24 小時
- 記住我：30 天

### 4. Data Model 更新

**User Model 更新：**

```prisma
model User {
  id              String         @id @default(cuid())
  email           String         @unique
  passwordHash    String?        // null for OAuth-only users
  primaryProvider Provider       @default(EMAIL)
  lastLoginAt     DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  oauthAccounts   OAuthAccount[]
  sessions        Session[]
}

enum Provider {
  EMAIL
  GOOGLE
}
```

**新增 OAuthAccount Model：**

```prisma
model OAuthAccount {
  id           String    @id @default(cuid())
  userId       String
  provider     Provider
  providerId   String    // Google sub claim
  accessToken  String?
  refreshToken String?
  expiresAt    DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerId])
}
```

## API Endpoints

詳見 `openapi/api.yaml`，摘要如下：

| Method | Path                   | Description           |
| ------ | ---------------------- | --------------------- |
| POST   | /auth/register         | Email 註冊            |
| POST   | /auth/login            | Email 登入            |
| POST   | /auth/logout           | 登出                  |
| GET    | /auth/google           | 發起 Google OAuth     |
| GET    | /auth/google/callback  | Google OAuth callback |
| GET    | /auth/me               | 取得目前使用者資訊    |

## Risks / Trade-offs

| Risk                             | Mitigation                                   |
| -------------------------------- | -------------------------------------------- |
| Google OAuth 設定錯誤導致無法登入 | 提供詳細的環境變數設定文件                   |
| Session 被竊取                   | 使用 HttpOnly + Secure + SameSite Cookie     |
| 密碼暴力破解                     | 實作 rate limiting（可在下一階段加入）       |

## Migration Plan

1. 執行 Prisma migration 更新 schema
2. 現有 User 資料：`passwordHash` 設為 null，`primaryProvider` 設為 EMAIL
3. 無需資料遷移，現有測試資料可保留

## Open Questions

- [ ] Rate limiting 策略？（建議下一階段實作）
- [ ] 是否需要 CORS 設定更新？（需確認前後端部署架構）
