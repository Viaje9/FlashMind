# FlashMind Web

FlashMind 前端應用程式，使用 Angular 21 建構的智慧閃卡學習平台。

## 技術棧

- **Angular 21** - Standalone Components、Signals
- **TailwindCSS 4** - 樣式框架
- **Vitest** - 單元測試
- **Storybook** - 元件開發與文件

## 開發指令

從專案根目錄執行：

```bash
# 啟動開發伺服器
pnpm dev:web

# 或使用 filter
pnpm --filter ./apps/web start
```

開發伺服器啟動後，開啟瀏覽器至 `http://localhost:4280/`。

### 其他指令

```bash
# 建構生產版本
pnpm --filter ./apps/web build

# 執行單元測試
pnpm --filter ./apps/web test

# 啟動 Storybook
pnpm --filter ./apps/web storybook

# 從 OpenAPI 規格產生 API 客戶端
pnpm --filter ./apps/web generate:api
```

## 專案結構

```text
src/
├── app/
│   ├── components/     # 共用元件（按功能分類）
│   │   ├── auth/       # 認證相關元件
│   │   ├── card/       # 閃卡元件
│   │   ├── deck/       # 牌組元件
│   │   ├── study/      # 學習元件
│   │   └── dialog/     # 對話框元件
│   ├── pages/          # 頁面路由元件（lazy loading）
│   └── services/       # Angular 服務
├── assets/             # 靜態資源
└── styles/             # 全域樣式
```

## 開發慣例

- **Standalone Components**：所有元件皆為 standalone，無 NgModule
- **Signal-based State**：使用 Angular Signals 進行狀態管理
- **API-First**：API 客戶端由 OpenAPI 規格自動產生至 `@flashmind/api-client`

## 相關資源

- [Angular CLI 文件](https://angular.dev/tools/cli)
- [TailwindCSS 文件](https://tailwindcss.com/docs)
- [Vitest 文件](https://vitest.dev/)
