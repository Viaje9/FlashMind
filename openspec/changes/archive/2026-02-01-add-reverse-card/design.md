## Context

目前 Card model 僅有 `front`（正面文字）與 `CardMeaning[]`（反面詞義），所有卡片都是「英文 → 中文」的單向學習。使用者無法練習「中文 → 英文」的反向回憶。認讀（recognition）與產出（production）是不同的記憶能力，需要獨立的 FSRS 排程追蹤。

## Goals / Non-Goals

**Goals:**

- 讓使用者能透過牌組設定啟用反向學習，同一張卡片同時練習正向與反向記憶
- 正反向各自擁有獨立的 FSRS 排程狀態，互不干擾
- 反向學習時使用原卡完整資料（含例句），不產生內容殘缺的獨立記錄
- 學習統計加計反向排程

**Non-Goals:**

- 不支援 per-card 的反向開關（統一由牌組層級控制）
- 不支援自訂反向顯示內容（反向固定為中文提示 → 英文答案）
- 不產生獨立的反向卡記錄（不使用 direction enum 與 pairId）

## Decisions

### D1：使用 inline 欄位存雙組 FSRS 排程

在 Card model 直接新增第二組 FSRS 排程欄位（加上 `reverse` 前綴）：

```prisma
model Card {
  // ...existing fields

  // FSRS 排程欄位（正向）
  state         CardState   @default(NEW)
  due           DateTime?
  stability     Float?
  difficulty    Float?
  elapsedDays   Int         @default(0)
  scheduledDays Int         @default(0)
  reps          Int         @default(0)
  lapses        Int         @default(0)
  lastReview    DateTime?

  // FSRS 排程欄位（反向）
  reverseState         CardState   @default(NEW)
  reverseDue           DateTime?
  reverseStability     Float?
  reverseDifficulty    Float?
  reverseElapsedDays   Int         @default(0)
  reverseScheduledDays Int         @default(0)
  reverseReps          Int         @default(0)
  reverseLapses        Int         @default(0)
  reverseLastReview    DateTime?
}
```

**rationale**：相較於舊方案（`CardDirection` enum + `pairId` 自引用關聯建立獨立反向卡記錄），inline 欄位方案有以下優勢：
- **無資料一致性風險**：不需維護正向卡與反向卡的內容同步
- **無 cascade 刪除問題**：不需處理自引用關聯的刪除邏輯
- **查詢效率更高**：不需 JOIN 或子查詢取得配對卡片
- **反向學習保有完整資料**：enExample/zhExample 不為空
- **簡化 CRUD 邏輯**：新增/編輯/刪除卡片不需額外處理反向卡

**替代方案**：
- `CardDirection` enum + `pairId` 自引用 → 舊方案，需維護同步、cascade 刪除、匯入數量翻倍等複雜邏輯
- 獨立的 `CardSchedule` 表存兩筆 → 過度正規化，增加 JOIN 成本且對此場景無明顯好處

### D2：牌組層級 `enableReverse` 開關

在 Deck model 新增 `enableReverse` 欄位：

```prisma
model Deck {
  // ...existing fields
  enableReverse    Boolean  @default(false)
}
```

**rationale**：相較於舊方案（per-card 的 `generateReverse` 開關），牌組層級開關有以下優勢：
- 使用者只需設定一次，所有卡片統一生效
- 不需在匯入/新增卡片時個別選擇
- 開關切換不影響資料（反向 FSRS 欄位始終存在，只是不被查詢/顯示）

### D3：學習模式的反向顯示邏輯

前端透過 `getStudyWord` 與 `getStudyTranslations` 函式根據 `StudyCard.direction` 交換正反面：

```typescript
// 正向卡：front 是英文（正面），zhMeaning 是中文（反面）
// 反向卡：zhMeaning 連結是中文（正面），front 是英文（反面）

export function getStudyWord(card: StudyCard): string {
  if (card.direction === 'REVERSE') {
    return card.meanings.map(m => m.zhMeaning).join('；');
  }
  return card.front;
}

export function getStudyTranslations(card: StudyCard): string[] {
  if (card.direction === 'REVERSE') {
    return [card.front];
  }
  return card.meanings.map(m => m.zhMeaning);
}
```

**rationale**：反向學習時使用原卡完整資料，只需在前端交換顯示位置。因為使用原卡資料，反向時 `mapMeaningsToExamples` 仍可正常回傳 enExample/zhExample，學習體驗更完整。

### D4：submitReview 新增 direction 參數

`submitReview` 方法新增 `direction` 參數（預設 `'FORWARD'`），用以決定更新哪組 FSRS 欄位：

```typescript
async submitReview(
  deckId: string,
  cardId: string,
  rating: StudyRating,
  userId: string,
  direction: 'FORWARD' | 'REVERSE' = 'FORWARD',
): Promise<ReviewResult>
```

後端根據 `direction` 讀取對應的 FSRS 狀態（正向讀 `state/due/stability/...`，反向讀 `reverseState/reverseDue/reverseStability/...`），計算新排程後更新對應欄位。

**rationale**：同一張卡片可能在同一學習回合中以正向和反向各出現一次，需要明確指定更新哪組排程。

### D5：ReviewLog 記錄 direction

ReviewLog 新增 `direction` 欄位（String，預設 `'FORWARD'`）：

```prisma
model ReviewLog {
  // ...existing fields
  direction     String    @default("FORWARD")
}
```

**rationale**：記錄每次評分的學習方向，便於後續分析正反向的學習效果差異。使用 String 而非 enum，因為 direction 僅為記錄用途，不需要 DB 層面的約束。

### D6：API 變更

| API | 變更 |
|-----|------|
| `Card` schema | 移除 `direction`、`hasReversePair` 欄位 |
| `CardListItem` schema | 移除 `direction` 欄位 |
| `StudyCard` schema | 新增 `direction` 欄位（`FORWARD` / `REVERSE`） |
| `CreateCardRequest` | 移除 `generateReverse` 欄位 |
| `ImportCardsRequest` | 移除 `generateReverse` 欄位 |
| `ImportCardsResult` | 移除 `reverseCount` 欄位 |
| `Deck`/`DeckDetail` schema | 新增 `enableReverse` 欄位（boolean） |
| `CreateDeckRequest` | 新增 `enableReverse` 欄位（boolean，選填） |
| `UpdateDeckRequest` | 新增 `enableReverse` 欄位（boolean，選填） |
| `POST /decks/:deckId/study/cards/:cardId/review` | request body 新增 `direction` 欄位 |

**rationale**：`direction` 從 Card 層級移至 StudyCard 層級，因為它現在是「學習方向」而非「卡片方向」。Card 本身不再有方向概念，方向由學習模組在回傳 StudyCard 時決定。

### D7：牌組統計加計反向

`getSummary` 在 `enableReverse` 開啟時，newCount 和 reviewCount 分別加計反向的統計：

```typescript
if (enableReverse) {
  const reverseNewCount = await prisma.card.count({
    where: { deckId, reverseState: CardState.NEW },
  });
  const reverseReviewCount = await prisma.card.count({
    where: { deckId, reverseState: { not: CardState.NEW }, reverseDue: { lte: now } },
  });
  newCount += reverseNewCount;
  reviewCount += reverseReviewCount;
}
```

**rationale**：確保牌組摘要的數字反映實際需要學習的量，包含反向排程的待學卡片。

## Risks / Trade-offs

- **[欄位膨脹]** 每張卡片多 9 個反向 FSRS 欄位 → 相較於獨立記錄方案（卡片數翻倍），空間消耗更低且查詢效率更好
- **[全開全關]** `enableReverse` 為牌組層級，無法 per-card 控制 → 簡化使用者體驗，多數場景使用者會對整個牌組統一設定
- **[反向 FSRS 欄位始終存在]** 即使未啟用反向學習，反向欄位仍佔空間 → 空間成本可忽略，且開關切換無需 migration
- **[既有資料]** migration 為所有現有卡片設定反向欄位預設值（`reverseState = NEW`），不影響現有功能
