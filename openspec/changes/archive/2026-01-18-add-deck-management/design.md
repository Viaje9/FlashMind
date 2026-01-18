## Context

FlashMind 是閃卡學習應用，牌組是卡片的容器。目前 UI 元件已完成，但缺乏後端 API 和前後端整合。此變更需要跨越資料庫、後端 API、OpenAPI 規格、前端服務和 E2E 測試。

**相關模式**：
- API 設計遵循 ADR-016（統一 wrapper、cursor-based 分頁、HttpOnly Cookie）
- 前端使用 Angular Signals 狀態管理
- 後端使用 NestJS 模組化架構
- 開發流程採用 TDD

**相依變更**：
- `add-card-management`：卡片管理依賴牌組存在，兩者共用 Deck 模型

## Goals / Non-Goals

**Goals**：
- 實作牌組 CRUD 完整功能
- 支援每日新卡數和複習數設定
- 提供牌組列表檢視與搜尋
- 顯示牌組學習進度統計

**Non-Goals**：
- 牌組分享功能
- 牌組匯入/匯出
- 牌組排序偏好設定
- 牌組封面圖片

## Decisions

### 資料模型

**Deck 模型**：
```prisma
model Deck {
  id              String   @id @default(cuid())
  name            String
  dailyNewCards   Int      @default(20)
  dailyReviewCards Int     @default(100)
  userId          String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cards           Card[]
}
```

**Rationale**：
- `dailyNewCards`：每日新卡數限制（預設 20，範圍 5-100，步進 5）
- `dailyReviewCards`：每日複習數限制（預設 100，範圍 10-500，步進 10）
- 刪除 Deck 時 cascade 刪除所有卡片和學習紀錄

### API 設計

遵循 ADR-016 規範：
- Response wrapper: `{ data, meta? }`
- Error format: `{ error: { code, message } }`
- 分頁: cursor-based
- 認證: HttpOnly Cookie

**端點設計**：
| Method | Path | Description | operationId |
|--------|------|-------------|-------------|
| GET | /decks | 取得使用者牌組列表 | listDecks |
| POST | /decks | 建立新牌組 | createDeck |
| GET | /decks/:id | 取得牌組詳情（含統計） | getDeck |
| PATCH | /decks/:id | 編輯牌組設定 | updateDeck |
| DELETE | /decks/:id | 刪除牌組 | deleteDeck |

**列表 Response 統計**：
```typescript
interface DeckListItem {
  id: string;
  name: string;
  newCount: number;      // 今日可學習新卡數
  reviewCount: number;   // 今日待複習數
  totalCount: number;    // 總卡片數
  completedCount: number; // 已完成數
  progress: number;      // 進度百分比 (0-100)
}
```

**詳情 Response 統計**：
```typescript
interface DeckDetail {
  id: string;
  name: string;
  dailyNewCards: number;
  dailyReviewCards: number;
  stats: {
    newCount: number;
    reviewCount: number;
    totalCount: number;
    createdAt: string;      // ISO date
    lastStudiedAt: string | null; // ISO date
  };
}
```

### 前端架構

**狀態管理**：使用 Angular Signals
- `DeckListComponent`: 使用 `signal()` 管理牌組列表狀態
- 搜尋使用 `computed()` 進行 debounce 過濾

**表單驗證**：
- name: 必填，最大 100 字元
- dailyNewCards: 5-100，步進 5
- dailyReviewCards: 10-500，步進 10

**路由規劃**：
- `/decks` - 牌組列表（已存在）
- `/decks/new` - 建立牌組（已存在，需實作 API 整合）
- `/decks/:id` - 牌組詳情（已存在，由 `add-card-management` 負責）
- `/decks/:id/settings` - 編輯牌組設定（新增）

### 刪除流程

1. 使用者點擊刪除按鈕
2. 彈出確認對話框（使用現有 `FmConfirmDialogComponent`）
3. 對話框說明將刪除所有卡片與學習紀錄
4. 確認後呼叫 DELETE API
5. 成功後返回牌組列表

### 與 add-card-management 的關係

- 共用 `Deck` Prisma 模型
- `GET /decks/:id` 由 `add-card-management` 定義（含卡片統計）
- 此變更新增 `GET /decks`、`POST /decks`、`PATCH /decks/:id`、`DELETE /decks/:id`
- 建議先實作 `add-deck-management`，再實作 `add-card-management`

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 刪除牌組遺失卡片 | 刪除前確認對話框明確說明影響 |
| 統計計算效能 | 使用 SQL 聚合函數，避免 N+1 查詢 |
| 與 card-management 衝突 | 明確分工，deck-management 不處理卡片相關 |

## Migration Plan

1. 新增 Prisma schema（Deck）
2. 執行 migration
3. 新增 OpenAPI 規格
4. 實作後端 API（TDD）
5. 產生 API client
6. 實作前端整合（TDD）
7. 新增 E2E 測試

**Rollback**：刪除 migration 並 revert 程式碼

## Open Questions

無
