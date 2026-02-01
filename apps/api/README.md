# FlashMind API

FlashMind 後端 API 服務，基於 NestJS 11 框架開發。

## 技術架構

- **框架**: NestJS 11
- **資料庫**: PostgreSQL
- **ORM**: Prisma 6
- **認證**: HttpOnly Cookie + Session

## 模組結構

```
src/
├── modules/
│   └── auth/          # 認證模組（登入、註冊、Session 管理）
├── prisma/            # Prisma 服務
├── app.module.ts      # 根模組
└── main.ts            # 應用程式進入點
```

## 資料模型

- **User**: 使用者帳號
- **OAuthAccount**: OAuth 第三方帳號連結（支援 Google）
- **Session**: 登入 Session 管理

## 開發指令

```bash
# 啟動開發伺服器（watch mode）
pnpm start:dev

# 建構專案
pnpm build

# 執行單元測試
pnpm test

# 監聽模式執行測試
pnpm test:watch

# 執行測試覆蓋率
pnpm test:cov

# 執行 E2E 測試
pnpm test:e2e

# ESLint 檢查
pnpm lint

# 程式碼格式化
pnpm format
```

## Prisma 指令

```bash
# 產生 Prisma Client
pnpm prisma:generate

# 執行本機資料庫遷移（開發用）
pnpm prisma:migrate

# 執行正式環境資料庫遷移（讀取 .env.production）
pnpm prisma:migrate:deploy
```

## 環境變數

建立 `.env` 檔案並設定以下變數：

```env
DATABASE_URL="postgresql://user:password@localhost:5432/flashmind"
```

## API 設計規範

遵循 ADR-016 規範：

- **Response 格式**: `{ data, meta? }`
- **Error 格式**: `{ error: { code, message } }`
- **分頁**: Cursor-based（`nextCursor`, `hasMore`）
- **認證**: HttpOnly Cookie（非 Bearer Token）
