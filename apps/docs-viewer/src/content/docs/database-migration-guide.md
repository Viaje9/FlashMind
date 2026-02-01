---
title: "Database Migration 維運指南"
summary: "Prisma migration 的執行流程、部署策略，以及過去遇到的問題與排除方式。"
---

| 版本 | 日期       | 變更說明                                           |
| ---- | ---------- | -------------------------------------------------- |
| 1.0  | 2026-02-01 | 初版建立：記錄 migration 流程與 advisory lock 事件  |

---

## 事件紀錄：2026-02-01 部署失敗

### 發生了什麼事

我們的 Dockerfile CMD 原本就會在 container 啟動時先執行 `prisma migrate deploy`，再啟動應用：

```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
```

這個做法過去一直正常運作。2026-02-01 因為有一筆新的 migration（`add_daily_reset_hour`）需要執行，部署後 container 在啟動階段持續失敗，陷入 Kubernetes CrashLoopBackOff 無限重啟迴圈，服務完全無法啟動。

錯誤訊息如下：

```text
Error: P1002
The database server was reached but timed out.
Context: Timed out trying to acquire a postgres advisory lock
(SELECT pg_advisory_lock(72707369)). Timeout: 10000ms.
```

container 共嘗試 6 次啟動，跨時約 4 分鐘，每次都在同一個地方逾時失敗：

```text
02:25:07  第 1 次啟動，偵測到 5 個 migration → 02:25:17 逾時崩潰
02:25:21  第 2 次啟動 → 02:25:31 逾時崩潰
02:25:47  第 3 次啟動 → 02:25:57 逾時崩潰，進入 BackOff
02:26:25  第 4 次啟動 → 02:26:36 逾時崩潰
02:27:20  第 5 次啟動 → 02:27:30 逾時崩潰
02:29:05  第 6 次啟動 → 02:29:15 逾時崩潰
02:29:28  持續 BackOff，服務完全中斷
```

### 為什麼會這樣

`prisma migrate deploy` 在執行任何 migration 之前，會先透過 `SELECT pg_advisory_lock(72707369)` 取得一個 PostgreSQL advisory lock，用來確保同一時間只有一個 migration 程序在跑。這次的問題出在**取鎖這一步就逾時了**（預設 10 秒），migration 本身根本還沒開始執行。

造成取鎖逾時的可能原因：

- **Zeabur 內部網路延遲**：API container 與 PostgreSQL 之間的連線不穩定，10 秒內無法完成取鎖
- **殘留的 advisory lock**：前一次 container 崩潰時，PostgreSQL 連線未正常關閉，舊 session 還持有這把鎖
- **惡性循環加劇問題**：container 崩潰 → K8s 重啟新 container → 新 container 搶鎖 → 舊連線尚未被 PostgreSQL 回收 → 又逾時 → 又崩潰，形成無限迴圈

而把 `prisma migrate deploy` 綁在 CMD 中的致命問題在於：**migration 失敗就等於應用完全無法啟動**。即使沒有任何 pending migration，這個指令每次都需要取得 advisory lock 來「檢查」，所以一旦取鎖出問題，服務就會持續中斷。

### 怎麼解決的

將 Dockerfile CMD 改為只啟動應用，不再在 container 啟動時跑 migration：

```dockerfile
CMD ["node", "dist/main"]
```

Migration 改為**部署前手動執行**。具體流程如下：

1. 在本機連線到正式 DB，手動執行 migration
2. 確認執行成功
3. 再 push code，讓 Zeabur webhook 觸發部署

```bash
# 在 apps/api/ 目錄下，連線正式 DB 執行 migration
DATABASE_URL="<正式環境的連線字串>" npx prisma migrate deploy
```

這樣做的好處是：migration 失敗時不會影響正在運行的服務，部署順序也完全由自己掌控。

---

## 現行 SOP

### 技術棧

| 項目           | 技術                                   |
| -------------- | -------------------------------------- |
| ORM            | Prisma v6                              |
| 資料庫         | PostgreSQL                             |
| 部署平台       | Zeabur（透過 GitHub webhook 自動部署） |
| Schema 位置    | `apps/api/prisma/schema.prisma`        |
| Migration 目錄 | `apps/api/prisma/migrations/`          |

### 開發階段（本機）

```bash
# 1. 修改 schema
#    編輯 apps/api/prisma/schema.prisma

# 2. 產生 migration 檔
pnpm --filter api prisma:migrate -- --name <描述>

# 3. 檢視產生的 SQL
#    確認 apps/api/prisma/migrations/<timestamp>_<name>/migration.sql 內容合理

# 4. 將 migration 檔 commit 到版控
git add apps/api/prisma/
git commit -m "feat: add migration for <描述>"
```

### 部署到正式環境

```text
步驟 1：本機連正式 DB 執行 migration
步驟 2：確認 migration 成功
步驟 3：push code → Zeabur webhook 自動部署新版
```

```bash
# 在 apps/api/ 目錄下執行
DATABASE_URL="<正式環境的連線字串>" npx prisma migrate deploy
```

### 注意事項

- `prisma migrate deploy` 只會執行尚未跑過的 migration，已執行過的不會重複跑
- 正式環境絕對不要用 `prisma migrate dev`，它會嘗試重置資料庫
- 破壞性變更（刪欄位、改欄位名稱）應拆成多次部署，避免新舊 code 不相容

---

## 未來調整方向：由 CI 全權控制部署

現行 SOP 依賴手動操作，如果未來需要自動化（多人協作、schema 變更頻繁），可以考慮將部署控制權從 Zeabur webhook 收回到 GitHub Actions：

1. **拔掉 Zeabur 的 GitHub webhook**，不讓它自動部署
2. **在 GitHub Actions 中建立 pipeline**：
   - Step 1：`prisma migrate deploy` 連正式 DB 執行 migration
   - Step 2：migration 成功後，透過 Zeabur Upload API 上傳 build 產物觸發部署
   - 若 Step 1 失敗，直接擋住，不會部署有問題的版本
3. 流程示意：

```text
push to main
  └→ GitHub Actions
       ├── Step 1: prisma migrate deploy（連正式 DB）
       │     ↓ 成功
       └── Step 2: Zeabur Upload API 部署新版
```

### 為什麼現在還沒這樣做

- Zeabur 目前沒有公開的「從 Git 觸發部署」API，只有 Upload API（上傳 zip 部署），流程會比較複雜
- Zeabur 的 GitHub webhook 與 GitHub Actions 完全獨立，無法互相協調順序，所以要走這條路就必須完全拔掉 webhook
- 以目前的專案規模，手動操作的成本尚可接受

---

## 故障排除

### Migration 卡在 advisory lock

如果手動執行 `prisma migrate deploy` 也遇到 advisory lock 逾時：

```sql
-- 連進 PostgreSQL，查看誰持有 advisory lock
SELECT * FROM pg_locks WHERE locktype = 'advisory';

-- 找到對應的 pid 後終止該 session
SELECT pg_terminate_backend(<pid>);
```

### 確認 migration 狀態

```bash
# 查看哪些 migration 已經執行過
DATABASE_URL="<連線字串>" npx prisma migrate status
```

### Schema 與 migration 不一致

如果有人改了 `schema.prisma` 但忘了產生 migration：

```bash
# 檢查 schema 與現有 migration 是否有 drift
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma
```
