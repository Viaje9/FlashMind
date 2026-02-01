## Why

目前每張卡片只支援單向學習（看正面 → 回想反面），無法練習反向回憶（看中文 → 回想英文）。認讀與產出是不同的記憶能力，只練單向會造成「看得懂但說不出」的問題。新增反向學習功能讓使用者可同時訓練雙向記憶，提升學習效果。

## What Changes

- 在 Card model 新增第二組 FSRS 排程欄位（`reverseState`/`reverseDue`/`reverseStability`/...），正向與反向各自獨立排程
- 在 Deck model 新增 `enableReverse` 欄位（boolean，預設 `false`），作為牌組層級的反向學習開關
- 在 ReviewLog 新增 `direction` 欄位，記錄每次評分的學習方向（`FORWARD` 或 `REVERSE`）
- 學習時同一張卡可產生兩個 StudyCard（FORWARD 和 REVERSE），反向時顯示所有中文翻譯為提示、英文 front 為答案
- 反向學習使用原卡完整資料（包含 enExample/zhExample），不再產生內容殘缺的獨立反向卡記錄
- 牌組設定頁面新增「啟用反向學習」toggle
- 牌組統計的 newCount/reviewCount 加計反向排程

## Capabilities

### New Capabilities

- `reverse-card`: 反向學習功能，涵蓋牌組層級的 enableReverse 開關、每張卡片的雙組 FSRS 排程、反向學習的顯示邏輯與統計加計

### Modified Capabilities

- `card-management`: 卡片匯入流程移除「產生反向卡」選項（不再需要）；匯入結果移除 `reverseCount`；卡片列表移除方向標籤
- `study-session`: 學習時根據牌組 `enableReverse` 設定決定是否產生反向 StudyCard；submitReview 新增 `direction` 參數；反向卡使用 `getStudyWord`/`getStudyTranslations` 交換顯示邏輯；getSummary 加計反向統計

## Impact

- **Prisma Schema**：Card 新增 `reverseState`/`reverseDue`/`reverseStability`/`reverseDifficulty`/`reverseElapsedDays`/`reverseScheduledDays`/`reverseReps`/`reverseLapses`/`reverseLastReview` 欄位；Deck 新增 `enableReverse` 欄位；ReviewLog 新增 `direction` 欄位；移除 `CardDirection` enum、`direction`、`pairId` 欄位。需執行 migration
- **OpenAPI**：Card/CardListItem/StudyCard schema 移除 `direction`/`hasReversePair` 欄位；CreateCardRequest/ImportCardsRequest 移除 `generateReverse` 欄位；ImportCardsResult 移除 `reverseCount` 欄位；Deck/CreateDeckRequest/UpdateDeckRequest 新增 `enableReverse` 欄位；SubmitReviewRequest 新增 `direction` 欄位
- **後端**：`card.service.ts`（簡化匯入/新增/編輯/刪除邏輯，移除反向卡生成與同步）、`deck.service.ts`（支援 `enableReverse` 設定）、`study.service.ts`（雙向排程取得、submitReview 帶 direction、getSummary 加計反向）、`fsrs.service.ts`（支援 per-deck 參數）
- **前端**：移除匯入頁面的「產生反向卡」toggle 與結果的 reverseCount 顯示；移除卡片列表的方向標籤；牌組設定頁面新增「啟用反向學習」toggle；學習 domain 新增 `getStudyWord`/`getStudyTranslations` 處理反向顯示；學習元件傳遞 direction 至 submitReview
- **既有資料**：migration 為所有現有卡片的反向 FSRS 欄位設定預設值（`reverseState = NEW`），不影響現有功能
