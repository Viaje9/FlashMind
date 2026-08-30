# Speaking 歷史／CLI 上線與回滾

## 向前部署

1. 備份資料庫，先在隔離 schema 驗證 `20260830000000_add_speaking_history_and_cli`。Migration 只新增 Speaking／授權資料表，以及單字例句更新時間欄位，不回填次數。
2. 在 `apps/api` 執行 Prisma migration，確認 User 和 TargetVocabulary 原有資料未變動。
3. 設定可信任的 `FRONTEND_URL`、`PUBLIC_API_ORIGIN`、`CORS_ORIGINS`。這些是 App／API 網址，不修改 OpenAI key 或模型設定。正式 CLI API 必須 HTTPS。
4. 建置 shared、API、Web、CLI；API 的 runtime 必須包含 `packages/shared/dist` 和依賴。專案建置指令已包含 shared build，API Docker runtime 也複製 shared dist。
5. 協調更新 API 與 Web：新 Summary 只分析，不再直接 applyReview；新 Web 先同步文字，再保存 Review。CLI save 使用同一交易規則。
6. 發佈時提示尚未更新的舊分頁／PWA 重新整理。舊頁面仍可取得 Summary 文字，但不會計次；不要宣稱舊前端也已完成雲端保存。必要時使用維護公告，要求口說使用者更新後再開始。
7. 以測試帳號驗證 CLI 登入、讀 context、validate 零寫入、save 冪等、兩種來源回顧、搬移不重算次數及跨帳號 404。

## 回滾原則

- 不刪除新資料表、Review、receipt 或本機 IndexedDB 備份。
- 優先停用新入口或回滾 UI，保留後端歷史讀取／save 的交易及防重能力。
- 不可重新啟用舊 summarizeConversation 的直接 applyReview；否則新 Web／CLI 與舊 API 混用可能重複計次。
- 若需暫停保存，回傳明確錯誤讓 App 保留 pendingAnalysis／pendingReview；使用者稍後用同一份內容重試。
- 清理登入授權過期資料是獨立維運事項；刪除歷史的 receipt 不能當一般過期資料清除。

## 隔離驗收

`apps/api/.env.speaking-test` 只需 DATABASE_URL，且 URL 必須含 `schema=speaking_cli_test`；測試程式不接受其他 schema。建立此 schema 的 migration 後執行：

```sh
pnpm test:e2e:speaking
```

測試啟動 4380／4381 的專用 Web／API，只操作 `e2e/.auth/test-accounts.json` 中 `speakingCli*` 測試帳號；不覆寫其他既有測試帳號欄位。測試使用獨立 Chrome profile、假麥克風與 AI 回應替身。它驗證保存與 UI 整合，不代表真實 OpenAI 模型、實體麥克風或手機硬體已重新驗收。
