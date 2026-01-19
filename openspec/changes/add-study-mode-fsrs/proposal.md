# Change: 新增學習模式與 FSRS 排程

## Why

FlashMind 需要核心的學習功能，讓使用者能夠透過間隔重複學習法有效記憶。目前前端 UI 元件已有雛形（StudyCard、StudyProgress、StudyDecisionBar），資料庫也已預留 FSRS 欄位，但缺少實際的排程邏輯與 API 端點。

此變更整合 [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) 套件實作 FSRS 演算法，提供比傳統 SM-2 更精準的複習排程，是 FlashMind 的核心差異化功能。

## What Changes

### 新增功能

1. **學習模式 API**
   - `GET /decks/{deckId}/study/cards` - 取得今日學習卡片（新卡 + 待複習）
   - `POST /decks/{deckId}/study/review` - 提交學習評分，更新 FSRS 排程
   - `GET /decks/{deckId}/study/summary` - 取得學習統計摘要

2. **FSRS 排程服務**
   - 整合 ts-fsrs 套件
   - 根據評分（知道/不熟/不知道）計算下次複習時間
   - 「不知道」的卡片在本次學習中再次出現
   - 優先顯示待複習卡片，再顯示新卡

3. **前端學習流程**
   - 開始學習：從 API 取得排序後的卡片
   - 翻卡學習：支援翻卡互動
   - 回答評分：三種滑動手勢對應 FSRS Rating
   - 完成學習：顯示統計結果

### 技術變更

- 後端新增 `StudyModule`、`FsrsService`
- 前端新增 `StudyStore`、`StudyDomain`
- 更新 OpenAPI 規格新增學習相關端點

## Impact

- **新增 specs**: `study-session`, `fsrs-scheduling`
- **受影響程式碼**:
  - `apps/api/src/modules/study/` (新增)
  - `apps/api/src/modules/fsrs/` (新增)
  - `apps/web/src/app/pages/study/` (修改)
  - `apps/web/src/app/components/study/` (新增)
  - `openapi/api.yaml` (新增端點)
  - `apps/api/prisma/schema.prisma` (可能新增 StudyLog)
