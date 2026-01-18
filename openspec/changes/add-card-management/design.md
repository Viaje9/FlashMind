## Context

FlashMind 是閃卡學習應用，核心功能是卡片 CRUD。目前 UI 元件已完成，但缺乏後端 API 和前後端整合。此變更需要跨越資料庫、後端 API、OpenAPI 規格、前端服務和 E2E 測試。

**相關模式**：
- API 設計遵循 ADR-016（統一 wrapper、cursor-based 分頁、HttpOnly Cookie）
- 前端使用 Angular Signals 狀態管理
- 後端使用 NestJS 模組化架構
- 開發流程採用 TDD

## Goals / Non-Goals

**Goals**：
- 實作卡片 CRUD 完整功能
- 支援多筆詞義區塊
- 提供卡片搜尋功能
- 顯示牌組統計資訊

**Non-Goals**：
- AI 生成詞義功能（暫不實作，保留 UI）
- 語音播放功能（暫不實作，保留 UI）
- 批次匯入/匯出
- 卡片標籤或分類

## Decisions

### 資料模型

**Deck 模型**：
```prisma
model Deck {
  id          String   @id @default(cuid())
  name        String
  description String?
  userId      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cards       Card[]
}
```

**Card 模型**：
```prisma
model Card {
  id        String    @id @default(cuid())
  front     String
  meanings  Json      // MeaningBlock[]
  deckId    String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deck      Deck      @relation(fields: [deckId], references: [id], onDelete: Cascade)
}
```

**Meaning 結構（JSON）**：
```typescript
interface MeaningBlock {
  id: string;          // 前端生成的 uuid
  zhMeaning: string;   // 中文解釋
  enExample: string;   // 英文例句
  zhExample: string;   // 中文例句翻譯
}
```

**Rationale**：
- 使用 JSON 欄位儲存 meanings 避免過多 join，單張卡片的詞義數量有限（通常 1-5 筆）
- Card 必須屬於一個 Deck，刪除 Deck 時 cascade 刪除卡片

### API 設計

遵循 ADR-016 規範：
- Response wrapper: `{ data, meta? }`
- Error format: `{ error: { code, message } }`
- 分頁: cursor-based
- 認證: HttpOnly Cookie

**端點設計**：
| Method | Path | Description |
|--------|------|-------------|
| POST | /decks/:deckId/cards | 新增卡片 |
| GET | /decks/:deckId/cards | 取得牌組卡片（支援搜尋、分頁） |
| GET | /decks/:id | 取得牌組詳情（含統計） |
| GET | /cards/:id | 取得單一卡片 |
| PATCH | /cards/:id | 編輯卡片 |
| DELETE | /cards/:id | 刪除卡片 |

**搜尋參數**：
- `q`: 搜尋關鍵字（搜尋 front 和 meanings 內容）
- `cursor`: 分頁 cursor
- `limit`: 每頁筆數（預設 20）

### 前端架構

**狀態管理**：使用 Angular Signals
- `DeckDetailComponent`: 使用 `signal()` 管理卡片列表狀態
- 搜尋使用 `computed()` 進行 debounce 過濾

**表單驗證**：
- front: 必填，最大 500 字元
- meanings: 至少一筆詞義，zhMeaning 必填

**路由變更**：
- `/decks/:id` - 已存在，需實作資料綁定
- `/decks/:deckId/cards/new` - 新增卡片（傳遞 deckId）
- `/cards/:id/edit` - 編輯卡片

### 刪除流程

1. 使用者點擊刪除按鈕
2. 彈出確認對話框（使用現有 `FmConfirmDialogComponent`）
3. 確認後呼叫 DELETE API
4. 成功後從列表移除並更新統計

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| JSON 欄位搜尋效能 | 使用 PostgreSQL 的 JSONB 和 GIN index |
| 大量卡片載入效能 | 使用 cursor-based 分頁，每頁 20 筆 |
| 前端表單複雜度 | 使用 Reactive Forms，逐步重構為 Signal Forms |

## Migration Plan

1. 新增 Prisma schema（Deck, Card）
2. 執行 migration
3. 新增 OpenAPI 規格
4. 實作後端 API（TDD）
5. 產生 API client
6. 實作前端整合（TDD）
7. 新增 E2E 測試

**Rollback**：刪除 migration 並 revert 程式碼

## Open Questions

無
