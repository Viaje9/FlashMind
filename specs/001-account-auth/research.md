# 研究與決策：帳號與登入

**日期**: 2026-01-11  
**規格來源**: /Users/brian/Documents/SideProject/GitHub/FlashMind/specs/001-account-auth/spec.md

## 決策 1：專案架構與切片位置

- **Decision**: 維持現有 pnpm workspace Monorepo 架構，auth 切片落在 `apps/api/src/modules/auth` 與 `apps/web/src/app/pages`，共用型別放 `packages/shared`。
- **Rationale**: 目前 repo 已符合憲法規範且具備基本前後端骨架，延續既有結構能降低第一個功能的成本。
- **Alternatives considered**: 將 auth 放在獨立 app 或 packages 內（不利於前後端同步開發與初期速度）。

## 決策 2：OpenAPI 產出與前端 Client 路徑

- **Decision**: OpenAPI 檔案輸出至 `/Users/brian/Documents/SideProject/GitHub/FlashMind/apps/api/openapi/openapi.json`，前端 Client 生成至 `/Users/brian/Documents/SideProject/GitHub/FlashMind/packages/api-client/src/generated/`。
- **Rationale**: 對齊既有文件提案路徑，避免後續多人協作時出現產物位置歧義。
- **Alternatives considered**: 僅產生後端 Swagger UI、或直接在 `apps/web` 內生成 client（降低共享性）。

## 決策 3：OpenAPI 產出與 Client 生成方式

- **Decision**: 後端採 `@nestjs/swagger` 產出 OpenAPI；前端使用 OpenAPI Generator 的 `typescript-angular` 產出 TypeScript client（產出物集中於 `packages/api-client`）。
- **Rationale**: NestJS 官方支援 Swagger；OpenAPI Generator 具跨語言與長期維護優勢，`typescript-angular` 可直接對接 Angular HttpClient。
- **Alternatives considered**: `openapi-typescript-codegen`、`ng-openapi-gen`、`@hey-api/openapi-ts`、`orval`。

## 決策 4：登入狀態與授權傳遞方式

- **Decision**: 登入/註冊成功回傳「工作階段憑證（session token）」與到期時間，前端以 Authorization Header 傳遞，登出時撤銷工作階段。
- **Rationale**: 規格未限定機制，使用 session token 能清楚表達登入狀態與登出行為，便於前後端契約定義。
- **Alternatives considered**: 僅使用 Cookie Session（契約較隱性）、完全由前端清除狀態不呼叫登出 API（無法撤銷伺服端工作階段）。

## 決策 5：現況檢視（對使用者問題的回覆基礎）

- **Decision**: 目前 `apps/web` 已有 welcome/settings 切版，但尚無註冊/登入頁與 API 串接；`apps/api` 為 NestJS 初始結構，尚未建置 auth 模組與 OpenAPI 產出。
- **Rationale**: 以現況作為開發起點，可先補齊 API 與前端流程，再引入產物自動化。
- **Alternatives considered**: 先建立完整共享 client 與 OpenAPI 產出流程後再開發 UI（延後可見成果）。
