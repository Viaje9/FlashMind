## Context

FlashMind 需要整合 FSRS 演算法提供智慧學習排程。ts-fsrs 是成熟的 TypeScript 實作，支援 ESM/CommonJS，適合 NestJS 後端使用。

關鍵利害關係人：
- 使用者：需要高效的間隔重複學習體驗
- 開發團隊：需要可維護的架構設計

## Goals / Non-Goals

### Goals
- 整合 ts-fsrs 提供 FSRS 排程功能
- 實作完整的學習流程（開始→翻卡→評分→完成）
- 支援「不知道」卡片在本次學習中重新出現
- 遵循每日新卡/複習數量上限

### Non-Goals
- 自訂 FSRS 參數（使用預設參數）
- 學習歷史記錄查詢（後續功能）
- 多牌組混合學習（後續功能）

## Decisions

### Decision 1: FSRS 服務放置位置

**選擇**: 建立獨立的 `FsrsModule`

**理由**:
- 分離關注點，FSRS 計算邏輯與學習業務邏輯分離
- 便於測試和維護
- 未來可輕鬆替換或升級演算法

**替代方案**:
- 直接在 StudyService 內實作：簡單但耦合度高
- 放在 shared 套件：過度抽象，目前只有後端使用

### Decision 2: Rating 對應策略

**選擇**: 三選項對應到 FSRS 四級評分

```
UI 手勢          → FSRS Rating
───────────────────────────────
右滑（知道）     → Rating.Good (3)
上滑（不熟）     → Rating.Hard (2)
左滑（不知道）   → Rating.Again (1)
```

**理由**:
- 符合功能文檔需求（三種滑動手勢）
- Good/Hard/Again 覆蓋大多數使用情境
- Easy (4) 可在未來版本新增（如長按右滑）

### Decision 3: 「不知道」卡片重新出現機制

**選擇**: 使用記憶體佇列管理本次學習的「不知道」卡片

**實作方式**:
1. 前端維護 `failedQueue: Card[]`
2. 評分為「不知道」時，卡片加入 failedQueue
3. 當所有新卡/複習卡完成後，從 failedQueue 取卡
4. 重複直到 failedQueue 清空

**理由**:
- 符合典型閃卡應用行為
- 不需額外 API 呼叫
- 狀態簡單，容易實作

### Decision 4: 學習卡片排序策略

**選擇**: 待複習卡片優先，新卡片其次

**排序邏輯**:
1. 先取出 due <= now 的待複習卡（按 due 升序）
2. 再取出 state = NEW 的新卡（按建立時間）
3. 合併並套用每日上限

**理由**:
- 符合功能文檔需求
- 優先複習即將遺忘的內容更有效

### Decision 5: API 設計模式

**選擇**: 批次取卡 + 單張評分

```
GET  /decks/{deckId}/study/cards   → 取得今日所有學習卡片
POST /decks/{deckId}/study/review  → 提交單張卡片評分
GET  /decks/{deckId}/study/summary → 取得學習統計
```

**理由**:
- 減少網路請求（一次取得所有卡片）
- 即時更新排程（每張卡評分後立即更新）
- 便於離線支援（未來）

## Risks / Trade-offs

### Risk 1: ts-fsrs 套件依賴
- **風險**: 套件停止維護或有安全漏洞
- **緩解**: ts-fsrs 是 open-spaced-repetition 組織維護的官方實作，持續更新中

### Risk 2: 大量卡片效能
- **風險**: 一次載入所有學習卡片可能影響效能
- **緩解**: 每日上限（新卡 100 + 複習 500）控制數量；未來可加入分頁

### Trade-off: 前端 vs 後端計算
- **取捨**: 選擇後端計算 FSRS，前端只傳送評分
- **好處**: 資料一致性、安全性
- **代價**: 每次評分需要 API 呼叫

## Migration Plan

無需遷移，此為新功能。資料庫 FSRS 欄位已預留。

## Open Questions

1. ~~FSRS 參數是否需要可調整？~~ → 不需要，使用預設值
2. 是否需要記錄學習歷史 (StudyLog)？→ 建議新增，用於統計分析
3. 學習中斷後如何恢復？→ 下次開始學習時自動繼續
