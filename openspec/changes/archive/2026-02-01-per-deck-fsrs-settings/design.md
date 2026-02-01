## Context

目前 `FsrsService`（`apps/api/src/modules/fsrs/fsrs.service.ts:54`）使用 `fsrs()` 不傳任何參數，建立一個全域 singleton 排程器。所有牌組共用相同的 FSRS 預設參數（`request_retention: 0.9`、`learning_steps: ["1m", "10m"]`、`relearning_steps: ["10m"]`、`maximum_interval: 36500`）。

Deck model（`schema.prisma:55-66`）目前只有 `dailyNewCards`、`dailyReviewCards`、`dailyResetHour` 三個設定欄位，沒有任何 FSRS 演算法參數。

`StudyService.submitReview()`（`study.service.ts:219`）呼叫 `fsrsService.calculateNextReview(currentState, rating, now)` 時不傳入牌組設定。

## Goals / Non-Goals

**Goals:**

- 使用者可在牌組建立/編輯時設定 FSRS 參數
- 每個牌組可擁有獨立的 `learningSteps`、`relearningSteps`、`requestRetention`、`maximumInterval`
- 所有欄位提供合理預設值，使用者無需手動設定即可正常運作
- 既有牌組不受影響（migration 使用預設值填充）

**Non-Goals:**

- 不暴露 FSRS 的 `w`（權重陣列）供使用者調整 — 這需要收集足夠的複習數據並透過 optimizer 計算，不適合手動設定
- 不提供 `enable_fuzz` 或 `enable_short_term` 的 per-deck 設定 — 目前階段保持全域行為一致
- 不做 FSRS 參數的匯入/匯出

## Decisions

### Decision 1: 資料庫欄位設計

在 Deck model 新增 4 個欄位：

| 欄位 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| `learningSteps` | `String` | `"1m,10m"` | 逗號分隔的步驟字串 |
| `relearningSteps` | `String` | `"10m"` | 逗號分隔的步驟字串 |
| `requestRetention` | `Float` | `0.9` | 目標保留率 |
| `maximumInterval` | `Int` | `36500` | 最大複習間隔（天） |

**為何 learningSteps 用逗號分隔字串而非 JSON array：**
- Prisma 對 PostgreSQL 的 `String[]` 支援良好，但步驟格式（`"1m"`, `"10m"`, `"1d"`）本身就是簡單字串
- 逗號分隔字串在 API 傳輸和表單處理上更直觀
- 避免 JSON 欄位在查詢和驗證上的額外複雜度

### Decision 2: FsrsService 改為接受參數的方法呼叫

不改 FsrsService 的 scope（維持 singleton），而是：
- `calculateNextReview()` 新增可選的 `fsrsParams` 參數
- 方法內部根據傳入的參數動態建立 FSRS 實例
- 使用 `Map` 快取已建立的 FSRS 實例（以參數 hash 為 key），避免重複建立

**為何不用 Transient scope：**
- NestJS Transient provider 會在每次注入時新建，但注入時還不知道要用哪個 deck 的參數
- 工廠模式需要額外的 provider 配置，增加複雜度
- 方法層級的參數傳遞最簡單直接

### Decision 3: StudyService 傳遞牌組 FSRS 設定

`StudyService.submitReview()` 在查詢卡片時已經有 `deckId`，只需額外查出 deck 的 FSRS 設定，傳給 `FsrsService.calculateNextReview()`。

### Decision 4: 前端表單設計

在牌組設定頁面（`deck-settings.component.ts`）新增「FSRS 演算法」區塊，放在現有「每日限制」區塊之後：

- `requestRetention`: 滑桿或數字輸入，範圍 0.70 ~ 0.97，步進 0.01
- `maximumInterval`: 數字輸入，範圍 30 ~ 36500，步進 30，單位「天」
- `learningSteps`: 文字輸入，placeholder `"1m, 10m"`
- `relearningSteps`: 文字輸入，placeholder `"10m"`

牌組建立頁面（`deck-create.component.ts`）不顯示 FSRS 設定，使用預設值。進階使用者可在建立後到設定頁調整。

### Decision 5: 步驟字串驗證

learningSteps 和 relearningSteps 需驗證格式：
- 支援格式：`<數字><單位>`，單位為 `m`（分鐘）、`h`（小時）、`d`（天）
- 多個步驟以逗號分隔：`"1m, 10m, 1h"`
- 後端 DTO 使用自訂 validator 驗證格式
- 前端提供格式提示與錯誤訊息

## Risks / Trade-offs

- **[既有卡片的排程一致性]** → 修改牌組 FSRS 參數不影響已排程的卡片（已計算的 due date 不變），僅影響下次評分時的新排程計算。這是合理的行為，無需 migration。
- **[FSRS 實例快取記憶體]** → 使用 Map 快取 FSRS 實例，牌組數量有限（通常 < 100），記憶體影響可忽略。
- **[使用者誤調參數]** → 提供重置為預設值的按鈕，並在 UI 上顯示參數說明文字。
