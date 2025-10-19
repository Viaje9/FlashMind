# Data Model — 快閃卡核心體驗與牌組管理

## Entity: User
- Purpose: 代表登入使用者；匿名狀態以 DeviceSession 取代。
- Fields:
  - `id` (uuid, pk)
  - `email` (citext, unique, nullable until verified)
  - `displayName` (text, optional)
  - `createdAt` / `updatedAt` (timestamptz)
- Relationships:
  - 1:N `Deck`
  - 1:N `DeviceSession`（登入後進行合併）
- Validation rules:
  - Email 必須唯一且以小寫儲存。
  - 刪除帳號前需清除或轉移 Deck／DeviceSession。

## Entity: DeviceSession
- Purpose: 追蹤匿名或離線使用者的裝置資料，以支援登入後合併。
- Fields:
  - `id` (uuid, pk)
  - `deviceFingerprint` (text, unique)
  - `userId` (uuid, fk nullable)
  - `lastSeenAt` (timestamptz)
  - `createdAt` (timestamptz)
- Relationships:
  - 可選關聯 `User`
  - 1:N `Deck`（匿名 Deck 設定 `ownerDeviceId`）
- Validation rules:
  - `deviceFingerprint` 需在客戶端生成且持久化。
  - 匿名 Deck 轉移至使用者時需原子更新 deck/card 擁有者。

## Entity: Deck
- Purpose: 組織主題，維護排程設定與統計。
- Fields:
  - `id` (uuid, pk)
  - `ownerUserId` (uuid, fk nullable)
  - `ownerDeviceId` (uuid, fk nullable)
  - `name` (text)
  - `slug` (text, unique per owner)
  - `dailyNewLimit` (integer, default 10)
  - `reviewOrder` (enum: `due-first`, `new-first`, `mixed`)
  - `createdAt` / `updatedAt` (timestamptz)
  - `version` (integer, default 1)
- Relationships:
  - 1:N `Card`
  - 1:N `DeckStatSnapshot`
- Validation rules:
  - `name` trim 後大小寫不敏感唯一（per owner）。
  - `dailyNewLimit` 1–50。
  - 匿名 Deck 至少一個 owner id（user 或 device）必定存在。

## Entity: DeckStatSnapshot
- Purpose: 快取 Deck 指標（待複習、預估時間等）。
- Fields:
  - `id` (uuid, pk)
  - `deckId` (uuid, fk)
  - `dueToday` (integer)
  - `newCount` (integer)
  - `avgRetention` (numeric)
  - `generatedAt` (timestamptz)
- Relationships:
  - N:1 `Deck`
- Validation rules:
  - 每次同步後重算；僅保留最近 N=30 筆。

## Entity: Card
- Purpose: 儲存單字與語意內容。
- Fields:
  - `id` (uuid, pk)
  - `deckId` (uuid, fk)
  - `term` (text)
  - `notes` (text, optional)
  - `senses` (jsonb[]) — 每個元素含 `meaning`, `exampleEn`, `exampleZh`, `source` (`ai`|`manual`), `confidence` (0–1)
  - `tags` (text[])
  - `createdBy` (uuid, fk to User, nullable)
  - `createdAt` / `updatedAt`
  - `version`
- Relationships:
  - 1:1 `CardState`
  - 1:N `ReviewLog`
- Validation rules:
  - `term` 在單一 deck 內需唯一（大小寫不敏感）。
  - `senses` 至少一筆 meaning。
  - AI 產生內容需標記 `source = ai` 並保存舊內容於 `senses[].revisions`（JSON 陣列）。

## Entity: CardState
- Purpose: FSRS 排程狀態。
- Fields:
  - `cardId` (uuid, pk/fk)
  - `stability` (numeric)
  - `difficulty` (numeric)
  - `elapsedDays` (integer)
  - `scheduledDays` (integer)
  - `due` (date)
  - `lastReviewedAt` (timestamptz, nullable)
  - `reviewCount` (integer)
  - `lastRating` (enum: `again`|`hard`|`easy`)
  - `authority` (enum: `local`|`server`)
  - `version`
- Relationships:
  - 1:1 `Card`
- State transitions:
  - 匿名時 `authority = local` 並將更新寫入 Dexie。
  - 登入後同步完成後，`authority` 切換至 `server` 並以後端狀態覆蓋。

## Entity: ReviewLog
- Purpose: 記錄每次滑動行為與同步狀態。
- Fields:
  - `id` (uuid, pk)
  - `cardId` (uuid, fk)
  - `deckId` (uuid, fk)
  - `userId` (uuid, nullable)
  - `deviceId` (uuid)
  - `rating` (enum: `again`|`hard`|`easy`)
  - `reviewedAt` (timestamptz)
  - `sessionId` (uuid)
  - `sequence` (integer) — 為離線重播排序
  - `syncStatus` (enum: `pending`|`synced`|`conflicted`)
  - `payloadVersion` (integer)
- Relationships:
  - N:1 `Card`
  - N:1 `Deck`
  - N:1 `User`（可為 null）
- Validation rules:
  - `sequence` 需於 `(deviceId, sessionId)` 內遞增。
  - 同步時若服務端已有較新紀錄，標記為 `conflicted` 並回傳覆蓋決策給客戶端。

## Entity: SyncEvent
- Purpose: 紀錄匿名到登入的合併與後端覆蓋行為。
- Fields:
  - `id` (uuid, pk)
  - `deviceId` (uuid, fk)
  - `userId` (uuid, fk)
  - `type` (enum: `merge`, `overwrite`, `conflict-resolution`)
  - `details` (jsonb)
  - `createdAt` (timestamptz)
- Validation rules:
  - 所有同步流程需寫入事件以支援稽核。

## Dexie Collections（前端）
- `decks`：mirror Deck，含本地 only 欄位 `localOnly`。
- `cards`：mirror Card，含 `localRevision`.
- `reviewQueue`：待回放的 ReviewLog。
- `syncJournal`：記錄已送出批次與伺服器回應。
- Validation:
  - 在 IndexedDB 內維持與伺服器 schema 同步的 `version` 欄位。
  - 失敗批次需支援重試與指數退避。
