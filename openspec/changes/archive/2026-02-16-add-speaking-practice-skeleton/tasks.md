## 1. OpenSpec / Contract

- [x] 1.1 新增 `speaking-practice` capability spec 與 `ai-generation`、`audio-playback` delta spec
- [x] 1.2 在 `openapi/api.yaml` 新增 `POST /speaking/chat` 與相關 schemas
- [x] 1.3 執行 API client 產生流程並更新 `packages/api-client/src/generated`

## 2. API（Nest）

- [x] 2.1 建立 `apps/api/src/modules/speaking`（module/controller/service/dto）
- [x] 2.2 實作 speaking chat 呼叫 OpenAI（message + history + systemPrompt）
- [x] 2.3 套用 `AuthGuard + WhitelistGuard` 並維持 ADR-016 錯誤格式
- [x] 2.4 將 SpeakingModule 註冊到 `AppModule`，更新 `.env.example` 模型設定

## 3. Web（Angular）

- [x] 3.1 新增 `/speaking`、`/speaking/history` 路由與頁面骨架（需登入）
- [x] 3.2 新增 `components/speaking` 的 domain/store/repository（IndexedDB）
- [x] 3.3 在 Home 增加 Speaking 卡片入口
- [x] 3.4 speaking 頁的設定入口導向 `/settings/speaking`
- [x] 3.5 讓 `/settings/speaking` 與 speaking 設定共用同一份資料

## 4. Test / Validation

- [x] 4.1 新增 `speaking.domain.spec.ts`
- [x] 4.2 新增 `speaking.service.spec.ts`
- [x] 4.3 新增 `speaking.controller.spec.ts`
- [x] 4.4 執行 `pnpm --filter ./apps/web build` 與 `pnpm --filter ./apps/api test`
