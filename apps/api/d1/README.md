# FlashMind D1 搬遷

此目錄保留 D1 專用的 Prisma schema 與 SQL migration。`apps/api/prisma/schema.prisma` 仍供現有 NestJS/PostgreSQL 服務使用；兩者不可互相覆蓋。

## 資料搬遷

1. 將 PostgreSQL 備份還原到獨立的暫存資料庫。
2. 設定 `PGHOST`、`PGPORT`、`PGDATABASE` 等 PostgreSQL 連線環境變數。
3. 執行 `node apps/api/scripts/export-postgres-to-d1.mjs /tmp/flashmind-d1-data.sql`。產出的 SQL 和 `.counts.json` 含使用者資料，僅存於安全的暫存位置，不提交到 Git。
4. 先套用 `d1/migrations`，再用 Wrangler `d1 execute --file` 匯入資料。
5. 核對 23 個資料表的筆數，執行 `PRAGMA foreign_key_check` 與 `PRAGMA integrity_check`。

2026-09-28 已使用使用者提供的 2026-09-25 備份匯入 `flashmind-staging` D1（ID：`4bac7ef9-88c4-4c73-a2be-a79a1228d6ad`）。來源與 D1 的 23 個資料表共 26,063 筆一致，外鍵檢查無錯。此快照不會自動接收舊 PostgreSQL 後續新增的資料；正式切換前需重新同步與驗證。

## Worker 狀態

測試 Worker 名稱為 `flashmind-staging`。目前 Hono 已提供健康檢查與 Email 註冊、登入、登出、目前使用者 API，並部署 Angular 靜態站台。其餘 API 尚在搬遷；請勿將目前 staging 視為完整功能版本。`OPENAI_API_KEY` 已設為 Cloudflare secret，金鑰值不在版本庫中。
