# 實作計畫：帳號與登入

**分支**: `001-account-auth` | **日期**: 2026-01-11 | **規格**: /Users/brian/Documents/SideProject/GitHub/FlashMind/specs/001-account-auth/spec.md  
**輸入**: 功能規格來自 /Users/brian/Documents/SideProject/GitHub/FlashMind/specs/001-account-auth/spec.md

**備註**: 本文件由 `/speckit.plan` 產生並填寫。

## 摘要

提供 Email 與 Google 的註冊、登入、登出能力，並確保未登入導向歡迎頁。技術上延續現有 Angular + NestJS + Prisma + PostgreSQL 架構，補齊 auth 模組與前端登入/註冊頁面，同時規劃 OpenAPI 產出與使用 OpenAPI Generator 生成前端 Client 的路徑，以支援後續功能開發的一致契約。

## 技術背景

**語言/版本**: TypeScript 5.9.x（apps/web）、TypeScript 5.7.x（apps/api）  
**主要依賴**: Angular 21、Tailwind CSS v4、NestJS 11、Prisma 6、OpenAPI Generator（typescript-angular）  
**儲存**: PostgreSQL（/Users/brian/Documents/SideProject/GitHub/FlashMind/.env 已包含 DATABASE_URL）  
**測試**: 前端 @angular/build:unit-test、後端 Jest  
**目標平台**: 瀏覽器前端 + Node.js 伺服器 API  
**專案類型**: pnpm workspace Monorepo（apps/web + apps/api + packages）  
**效能目標**: 註冊 3 分鐘內完成、登入 10 秒內完成、登出 5 秒內返回歡迎頁  
**限制**: 僅 Email/Google 註冊登入；不含 Email 驗證、忘記/重設密碼；未登入導向歡迎頁  
**規模/範圍**: MVP 初期規模，單一租戶與單一區域部署、使用者量低量起步（<10k）

## 憲法檢查

*Gate: 進入 Phase 0 前必須通過，Phase 1 後需再檢查一次。*

- [x] 文件內容使用繁體中文（zh-tw），無簡體中文為主要內容
- [x] 前端/後端技術棧符合 Angular + Tailwind v4、NestJS、Prisma、PostgreSQL
- [x] Prisma CLI 僅在 `apps/api` 使用，schema 路徑正確（/Users/brian/Documents/SideProject/GitHub/FlashMind/apps/api/prisma/schema.prisma）
- [x] `.env` 位於專案根目錄且包含 `DATABASE_URL`
- [x] 指令與套件管理使用 pnpm

**Phase 1 後再檢查**: 仍符合以上條件（計畫內容與產出文件皆遵循）

## 專案結構

### 文件（本功能）

```text
/Users/brian/Documents/SideProject/GitHub/FlashMind/specs/001-account-auth/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### 程式碼（repo root）

```text
/Users/brian/Documents/SideProject/GitHub/FlashMind/apps/web/
└── src/
    └── app/
        ├── pages/
        │   ├── welcome/            # 已有切版
        │   ├── settings/           # 已有切版與登出按鈕
        │   ├── auth-register/      # 規劃新增
        │   └── auth-login/         # 規劃新增
        ├── services/
        │   └── auth.service.ts     # 規劃新增
        └── guards/                 # 規劃新增

/Users/brian/Documents/SideProject/GitHub/FlashMind/apps/api/
├── src/
│   ├── modules/
│   │   ├── auth/                   # 規劃新增
│   │   └── users/                  # 規劃新增
│   └── prisma/
│       ├── prisma.service.ts
│       └── prisma.module.ts
├── prisma/
│   └── schema.prisma
└── openapi/
    └── openapi.json                # 規劃新增

/Users/brian/Documents/SideProject/GitHub/FlashMind/packages/
├── shared/
│   └── src/
└── api-client/
    └── src/generated/              # 規劃新增
```

**結構決策**: 依 /Users/brian/Documents/SideProject/GitHub/FlashMind/apps/docs-viewer/src/content/docs/dir-structure-proposals.md 的「版本 C」方向，維持 apps 自足、共用以 packages 管理；auth 模組置於 `apps/api/src/modules/auth`，前端以 `pages + services + guards` 組成登入體驗，OpenAPI 產出與前端 client 生成路徑遵循提案，Client 生成目標為 typescript-angular。
