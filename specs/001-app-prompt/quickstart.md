# Quickstart — 快閃卡核心體驗與牌組管理

## 1. 啟動開發環境
- 安裝 VS Code Dev Containers 外掛後，於專案根目錄選擇 **Reopen in Container**。
- 容器啟動時會自動執行 `pnpm install && pnpm build`，PostgreSQL 亦會隨 docker-compose 一併啟動。
- 若需在本機啟動，請自行安裝 Node 22、pnpm 9 與 PostgreSQL 15，並執行 `cp .env.example .env` 後補齊金鑰。

## 2. 設定環境變數
- 於容器或本機設定以下變數：
  - `DATABASE_URL=postgresql://postgres:postgres@db:5432/vocabdb`
  - `GEMINI_API_KEY=<專案金鑰>`
  - `OPENAI_GENERATOR_OUTPUT=packages/contracts/openapi.json`
- 為 Playwright 測試設定 `PLAYWRIGHT_BROWSERS_PATH=0` 以共用容器內的瀏覽器。

## 3. 建置與啟動服務
- 後端：`pnpm --filter @app/backend prisma:generate && pnpm --filter @app/backend start:dev`
- 前端：`pnpm --filter @app/frontend start`
- Storybook：`pnpm --filter @app/frontend storybook`
- 同步產生 OpenAPI：`pnpm contracts:gen`

## 4. 建立測試資料
- 匿名體驗：執行 `pnpm --filter @app/frontend seed:anon` 建立離線 Deck 與卡片。
- 登入體驗：`pnpm --filter @app/backend seed:user` 建立測試帳號、Deck、FSRS 狀態。
- 若需驗證匿名轉登入，使用 `pnpm --filter @app/frontend sync:simulate --user demo@example.com`.

## 5. 執行測試與驗證
- 單元測試：`pnpm test`
- 後端契約測試：`pnpm --filter @app/backend test:contract`
- 前端 e2e/Storybook：`pnpm --filter @app/frontend test:e2e`、`pnpm --filter @app/frontend test:visual`
- 核對 OpenAPI 與產生碼：`pnpm contracts:check`

## 6. 重要檢查點
- 滑動手勢需於行動瀏覽器裝置模擬器下測試，確保手勢 <100ms 回饋。
- 登入後檢視 `/sync/diagnostics` API，確保匿名 ReviewLog 皆已回放且 Deck 統計與本地一致。
- AI 產生失敗時，確認 UI 顯示 `AI_GENERATION_FAILED` 錯誤代碼並允許手動輸入。
