## Context

牌組詳情頁的 `deck-stats-card` 元件目前顯示牌組的「新卡片」總數與「待複習」總數，並提供「開始學習」按鈕。使用者無法得知今日已學習多少張以及還剩多少張需要練習。

後端已有 `GET /decks/{deckId}/study/summary` API 回傳 `totalCards`、`newCount`、`reviewCount`、`todayStudied`，但缺少每日限額與分類的今日已學數量。`getStudyCards` 方法中已計算 `todayNewCardsStudied` 和 `todayReviewCardsStudied`，可複用此邏輯。

## Goals / Non-Goals

**Goals:**
- 在牌組詳情頁清楚呈現今日新卡與複習的練習進度
- 擴充 StudySummary API 回傳每日限額與今日已學細項
- 讓使用者直覺了解今日學習完成度

**Non-Goals:**
- 不修改學習頁面（study page）的進度顯示
- 不新增歷史統計（如週/月報表）
- 不修改牌組列表頁（deck-list）的卡片元件

## Decisions

### D1: API 擴充方式 — 擴充現有 getSummary

擴充現有 `GET /decks/{deckId}/study/summary` 回傳欄位，而非新增 API。理由：
- 資料性質屬於學習摘要
- 前端只需呼叫一支 API 即可取得所有所需資訊
- 向後相容，原有欄位不受影響

新增欄位：
- `dailyNewCards`: number — 牌組每日新卡上限
- `dailyReviewCards`: number — 牌組每日複習上限
- `todayNewStudied`: number — 今日已學新卡數
- `todayReviewStudied`: number — 今日已複習數

### D2: 前端呈現位置 — 統計卡片內的進度條

在 `deck-stats-card` 元件中，於「新卡片」與「待複習」數字下方各新增一條小型進度條與文字，格式為：`N / M`（N 為今日已學，M 為每日上限）。位於「開始學習」按鈕上方。

理由：
- 與現有統計數字放在一起，視覺關聯性強
- 不佔額外空間，不需新增區塊
- 進度條提供一眼可見的完成度

### D3: 進度資料來源 — deck-detail 呼叫 summary API

`deck-detail` 頁面在 `ngOnInit` 時額外呼叫 `getStudySummary(deckId)`，取得今日進度資料後傳入 `deck-stats-card`。

理由：
- `deck-stats-card` 為純展示元件（dumb component），資料由父元件提供
- 與現有 `loadDeck` 並行呼叫，不會影響載入速度

## Risks / Trade-offs

- **風險**：每次進入詳情頁都呼叫 summary API，增加一次後端請求。但此 API 查詢量小（count queries），效能影響可忽略。
- **取捨**：進度條顯示的是「今日已學」vs「每日上限」，而非「今日已學」vs「今日可學」。選擇前者是因為更直覺，使用者容易理解自己的進度。
