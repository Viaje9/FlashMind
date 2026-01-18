# Design: 卡片管理功能

## Context

FlashMind 是閃卡學習應用程式，卡片是核心學習單位。每張卡片屬於一個牌組，包含正面（單字/片語）和背面（多筆詞義）。背面的詞義區塊包含中文解釋、英文例句和中文翻譯。

此功能需要與既有的牌組管理整合，並為未來的 FSRS 學習排程功能預留欄位。

## Goals / Non-Goals

**Goals:**

- 實作卡片 CRUD 完整功能
- 支援多筆詞義區塊的新增/刪除
- 預留 FSRS 排程所需的欄位結構
- 遵循既有的前端分層架構（Domain/Store/Form/Component）

**Non-Goals:**

- 語音播放功能（TTS）- 未來功能
- FSRS 排程邏輯 - 未來功能
- 卡片匯入/匯出 - 未來功能
- 卡片搜尋/篩選 - 可在此版本簡化實作

## Decisions

### 資料模型設計

採用 `Card` + `CardMeaning` 一對多關係，支援多筆詞義：

```prisma
model Card {
  id        String        @id @default(cuid())
  front     String        // 正面：單字/片語/問題
  deckId    String
  deck      Deck          @relation(fields: [deckId], references: [id], onDelete: Cascade)
  meanings  CardMeaning[]
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  // FSRS 排程欄位（預留）
  state         String    @default("new")  // new, learning, review, relearning
  due           DateTime?
  stability     Float?
  difficulty    Float?
  elapsedDays   Int       @default(0)
  scheduledDays Int       @default(0)
  reps          Int       @default(0)
  lapses        Int       @default(0)
  lastReview    DateTime?
}

model CardMeaning {
  id            String   @id @default(cuid())
  cardId        String
  card          Card     @relation(fields: [cardId], references: [id], onDelete: Cascade)
  zhMeaning     String   // 中文解釋
  enExample     String?  // 英文例句
  zhExample     String?  // 中文翻譯
  sortOrder     Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

**Rationale:**

- 使用獨立 `CardMeaning` 模型而非 JSON 欄位，便於查詢和維護
- FSRS 欄位直接放在 Card 上，符合 ts-fsrs 套件結構
- `sortOrder` 維持詞義順序
- 刪除牌組時級聯刪除卡片（`onDelete: Cascade`）

### API 設計

遵循 ADR-016 設計規範，使用 RESTful 嵌套路由：

| 端點 | 方法 | 用途 |
|------|------|------|
| `/decks/{deckId}/cards` | GET | 列出牌組內卡片 |
| `/decks/{deckId}/cards` | POST | 新增卡片 |
| `/decks/{deckId}/cards/{cardId}` | GET | 取得單張卡片 |
| `/decks/{deckId}/cards/{cardId}` | PATCH | 更新卡片 |
| `/decks/{deckId}/cards/{cardId}` | DELETE | 刪除卡片 |

### 前端架構

依循專案的分層架構：

```
apps/web/src/app/components/card/
├── card.store.ts       # 卡片狀態管理（API 呼叫）
├── card.form.ts        # 卡片表單定義（Signal Forms）
└── card.domain.ts      # 純函式邏輯（驗證規則）
```

頁面元件：

- `/decks/:id` - 牌組詳情頁（顯示卡片列表）
- `/decks/:id/cards/new` - 新增卡片
- `/decks/:id/cards/:cardId/edit` - 編輯卡片

### 路由調整

將 `/cards/new` 改為 `/decks/:deckId/cards/new`，使卡片與牌組關聯更清楚。

## Risks / Trade-offs

| 風險 | 緩解措施 |
|------|----------|
| FSRS 欄位初期閒置 | 使用預設值，不影響 CRUD 功能 |
| 多筆詞義增加 API 複雜度 | 卡片更新時整包替換 meanings |

## Open Questions

- [ ] 卡片列表是否需要分頁？初期可假設單一牌組卡片數 < 1000
