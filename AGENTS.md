# FlashMind 開發指引

自所有功能計畫自動彙整。最後更新日期：2025-10-19

## 使用中技術
- TypeScript 5 / Angular 20（前端 PWA）
- NestJS 10 / Prisma / PostgreSQL（後端 API）
- Angular Material + Tailwind CSS（UI 與佈局）
- Dexie IndexedDB（離線快取）、LocalStorage 同步佇列
- @google/generative-ai（Gemini 2.5-flash 代理）
- Jest / Supertest / Playwright / Storybook

## 專案結構
```
apps/
  frontend/（Angular PWA、Storybook、Jest/Playwright 測試）
  backend/（NestJS 模組、Prisma、Jest/Supertest）
packages/
  fsrs-core/（共享排程邏輯）
  contracts/（OpenAPI JSON 與型別）
  ui/（共享 Material 元件）
.devcontainer/（Node + PostgreSQL 開發容器）
```

## 指令
- `pnpm --filter @app/backend start:dev` 啟動 NestJS
- `pnpm --filter @app/frontend start` 啟動 Angular PWA
- `pnpm contracts:gen` 由 OpenAPI 產生前端 services
- `pnpm --filter @app/frontend test:e2e` / `pnpm --filter @app/backend test:contract`
- `pnpm --filter @app/frontend storybook` 預覽元件

## 程式風格
- TypeScript：ESLint + Prettier 規則，Angular standalone pattern
- Tailwind：以原子化 class 控制佈局，Storybook 為唯一 UI 真實來源
- Prisma：Schema version 欄位與遷移腳本同步維護

## 近期變更
- 2025-10-19《快閃卡核心體驗與牌組管理》：新增三向滑動複習流程、Deck/Card 資料契約、Gemini 內容產生 API。

<!-- 手動補充區開始 -->
<!-- 手動補充區結束 -->
