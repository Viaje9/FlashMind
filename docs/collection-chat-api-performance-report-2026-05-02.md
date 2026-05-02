# 收藏包聊天 API 速度研究報告

日期：2026-05-02  
目標 API：`POST /api/collections/chat-sessions/cmoofdhxt0009sruazjz96zmn/messages`

## 結論

這支 API 等待 20 幾秒的主要瓶頸幾乎可以確定在 Codex SDK 的 `thread.run()`，不是資料庫、controller、response mapping 或新增的單字卡對齊邏輯。

目前 endpoint 是同步等待 AI 完整回覆後才回傳：

1. 查聊天 session。
2. 寫入 user message。
3. 執行 `aiProvider.runChat()`。
4. 寫入 assistant message 與更新 provider thread id。
5. 將 AI candidates 對齊既有單字卡並組成 response。

其中第 3 步 `CodexCollectionAiProvider.runChat()` 內的 `thread.run(...)` 是唯一會達到 20 秒級的步驟。

## 實測與模擬

### 本機 DB 資料量

針對 session `cmoofdhxt0009sruazjz96zmn` 查詢：

| 項目                     | 結果                                   |
| ------------------------ | -------------------------------------- |
| userId                   | `cml3irbgt0000ua3jmj9snqd7`            |
| providerThreadId         | `019de90c-71d3-7112-8055-38d3f8fe7027` |
| 單字卡數量               | 1000                                   |
| 收藏數量                 | 0                                      |
| session 訊息數           | 2                                      |
| session lookup           | 約 77ms                                |
| session + count 查詢總計 | 約 108ms                               |

### Collection tools 實際查詢時間

使用訊息：`我想比較價格並找到好優惠`

| 步驟                                               |                              時間 |
| -------------------------------------------------- | --------------------------------: |
| `session.findUnique`                               |                              40ms |
| `getUserVocabularySummary(limit=24)`               |                              31ms |
| `searchUserCards(message,20)`                      |                              68ms |
| `searchCollectionItems(message,20)`                |                               5ms |
| `findUserCardsByCandidateTexts(sample candidates)` |                               5ms |
| prompt 組裝                                        | 約 4783 chars，粗估約 1595 tokens |

補充：`searchUserCards` 有成功找到包含 `price` 的相關單字，回傳樣本包含 `find`、`price`、`than`、`value`、`discover`、`charge`。

### fake AI 延遲端到端模擬

用假的 `aiProvider.runChat()` 模擬不同 AI 等待時間，其餘流程照 `CollectionService.createChatMessage()` 跑：

| 模擬 AI 延遲 | API service 總時間 | 非 AI 額外成本 |
| -----------: | -----------------: | -------------: |
|          0ms |               72ms |           72ms |
|       5000ms |             5072ms |           72ms |
|      15000ms |            15072ms |           72ms |
|      25000ms |            25077ms |           77ms |

這代表目前延遲幾乎與 AI 等待時間線性相加。若使用者體感是 20-25 秒，合理推論其中約 20-25 秒都在 Codex SDK run。

## 程式碼路徑分析

Controller：

- `apps/api/src/modules/collection/collection.controller.ts`
- `createChatMessage()` 只負責取 user/session/body 並呼叫 service，本身沒有重邏輯。

Service：

- `apps/api/src/modules/collection/collection.service.ts`
- `createChatMessage()` 會先保存 user message，再等待 `this.aiProvider.runChat(...)`。
- AI 回來後才寫 assistant message，再執行 `mapChatSuggestions()`。

AI Provider：

- `apps/api/src/modules/collection/codex-collection-ai.provider.ts`
- `runChat()` 會先平行查：
  - `getUserVocabularySummary(input.userId, 24)`
  - `searchUserCards(input.userId, input.message, 20)`
  - `searchCollectionItems(input.userId, input.message, 20)`
- 接著 resume/start Codex thread。
- 真正等待點是：
  - `await thread.run(prompt, { outputSchema, signal })`

目前設定：

- `DEFAULT_MODEL = 'gpt-5.2'`
- `modelReasoningEffort = 'medium'`
- `DEFAULT_TIMEOUT_MS = 45_000`
- `sandboxMode = 'read-only'`
- `networkAccessEnabled = false`
- 使用 structured output schema。

## 為什麼會慢

最主要原因：

1. `gpt-5.2` + `medium` reasoning 對這種短句拆解任務可能偏重。
2. Codex SDK thread run 是完整 agent turn，不是單純低延遲 chat completion。
3. 目前 response 必須等 structured output 完整產出，無法先回候選。
4. 每次都送完整規則 prompt、單字卡樣本、搜尋結果與既有收藏結果。prompt 約 4.8k 字元，不算超大，但會增加模型處理成本。

不是主要原因：

1. DB 查詢不是 20 秒級，目前量級多在 5-70ms。
2. candidate 對齊既有單字卡不是瓶頸，實測約 5ms。
3. message 寫入與 session 更新不是瓶頸，模擬中整個非 AI 成本約 70-80ms。

## 建議改善方向

### 1. 先加正式分段計時 log

在 `createChatMessage()` 與 `CodexCollectionAiProvider.runChat()` 加 dev/prod 可控的 timing log，確認每次慢在哪一段：

- `sessionLookupMs`
- `saveUserMessageMs`
- `preToolQueriesMs`
- `buildPromptMs`
- `codexThreadRunMs`
- `parseAndMarkExistingMs`
- `saveAssistantMessageMs`
- `mapSuggestionsMs`
- `totalMs`

這是最優先，因為目前雖然瓶頸很明確，但正式 log 可以避免之後改 prompt 或模型時只能靠體感。

### 2. 收藏包聊天可考慮 lowering reasoning effort

目前是 `medium`。這個任務多半是分類、翻譯、拆語塊與 JSON 輸出，不一定需要 medium reasoning。

建議先 A/B：

- `modelReasoningEffort: 'low'`
- 保留 `gpt-5.2`

預期可以降低 latency，品質需要用之前 100 筆情境測試回歸。

### 3. 縮短 prompt 並把範例壓縮

目前 prompt 包含多條規則與三個完整範例。可以拆成：

- 固定短規則
- 少量高優先規則
- 只保留 1-2 個最關鍵範例

另外 `單字卡樣本` 目前每次帶 24 張，實際這次 query 已經能找到 `price`，後續可以考慮：

- 若 `searchedCards` 有結果，減少或不帶 general sample cards。
- `existingCollections` 為空時不放完整 JSON，只放 `[]` 或文字說明。

### 4. 前端體驗繼續走 optimistic UI

目前已改成使用者訊息先顯示、AI loading 在聊天內顯示。這能改善體感，但不能縮短後端耗時。

若未來還是 20 秒：

- 可以在 3-5 秒後顯示更明確狀態，例如「正在根據你的單字卡找可用語塊」。
- 但真正速度仍要從 Codex run 降低。

### 5. 若要明顯低延遲，可評估非 Codex SDK fast path

若產品要求這個聊天視窗接近一般聊天速度，可以考慮把「單純翻譯 / 裸句子拆解 / 建議語塊」改成直接使用低延遲 structured output API。

Codex SDK 比較適合需要 tool orchestration、讀寫工作區或多步 agent 的場景。這裡目前 tools 其實已經由後端先查完再塞進 prompt，Codex run 沒有真的在過程中動態呼叫本地 tool，因此延遲成本可能不划算。

## 建議下一步

1. 先實作分段 timing log。
2. 用同一批 30-100 筆測試跑 `gpt-5.2 medium` baseline。
3. 改 `modelReasoningEffort: low` 跑同一批，比較：
   - 平均時間
   - P95 時間
   - 候選分類正確率
   - source card 命中率
4. 若 low 還是過慢，再評估把收藏包聊天改成較低延遲的 structured output provider。
