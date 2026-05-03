## Context

收藏包後端目前已有 `CollectionSuggestedCard` / `suggestedCards` 的概念，但產品流程尚未完整定義：AI 何時提出缺少單字、前端如何呈現單字候選、使用者如何選牌組並沿用既有新增快閃卡欄位。既有卡片資料模型為 `front` 加上多筆 `meanings[]`，每筆詞義包含 `zhMeaning`、`enExample`、`zhExample`；收藏包候選則只在使用者確認後才入庫。

此設計會把「收藏句子/語塊」與「補齊缺少單字卡」串成同一個聊天流程，但不改變卡片本身的資料模型，也不讓 AI 自動建立卡片。

## Goals / Non-Goals

**Goals:**

- 讓收藏包聊天能回傳缺少的主要單字候選，包含預填新增快閃卡所需資料。
- 前端在新增收藏聊天中顯示單字候選卡，並與句子/語塊候選分區呈現。
- 使用者點擊單字候選加號後，選擇牌組並記住上次選擇。
- 使用既有卡片新增 API 與卡片編輯欄位完成正式建立。
- 成功建立卡片後更新候選狀態，避免同一候選重複加入。

**Non-Goals:**

- 不新增新的 Card / Deck 資料表。
- 不自動建立單字卡，也不在 AI 回應階段寫入卡片。
- 不把單字候選直接加入 FSRS 排程以外的新流程；仍沿用既有建立卡片行為。
- 不在此 change 處理收藏項目與新建卡片的自動反向補關聯；若需要，可在新增成功後由前端重新送出收藏或重新整理來源卡片。

## Decisions

### 1. 以 `suggestedCards` 作為單字候選 contract

`CollectionChatMessageResult.suggestedCards` SHALL 成為前端正式使用的單字候選資料。每筆候選至少包含：

- `front`: 建議新增的正面文字。
- `meanings`: 預填到新增快閃卡的詞義陣列，對齊 `CreateCardRequest.meanings`。
- `reason`: 為什麼建議新增，例如「句子主要情境字，目前找不到對應單字卡」。
- `existingCardId`: 若後端或 AI tool 找到既有卡片則填入，前端不得顯示新增按鈕。

替代方案是新增一個 `suggestedVocabulary` 欄位，但目前後端已存在 `suggestedCards`，延續既有欄位可以降低 contract 變更範圍。

### 2. Codex agent 必須先查既有單字卡再建議新增

Codex prompt 需明確要求：只有當主要單字無法透過 `searchUserCards` / 已提供的相關單字卡找到，且該單字對句子或語塊理解有幫助時，才放入 `suggestedCards`。已存在的單字應作為 `sourceCardIds` 或 message 的已學脈絡，不得出現在新增單字候選。

替代方案是前端收到候選後再比對現有卡片，但 AI 已在後端具備 tool context；後端先約束可以避免 UI 閃爍與重複候選。

### 3. 新增單字仍走既有卡片建立 API

前端不新增收藏包專用的建卡 API。使用者選定牌組後，直接使用既有 `createCard(deckId, CreateCardRequest)` 或既有卡片編輯流程完成建立。這可保留 card-management 的驗證、FSRS 初始狀態、正反向卡邏輯與錯誤格式。

替代方案是後端新增 `POST /collections/suggested-cards/:id/accept`，但會複製卡片建立規則，並增加跨模組耦合。

### 4. 牌組選擇使用前端 localStorage 記憶

收藏包新增單字流程使用 localStorage 保存上次選擇的 deck id，例如 `flashmind.collectionPack.lastDeckId`。下次點擊單字候選時若該 deck 仍存在且屬於目前使用者，預選該牌組；若不存在，回到第一個可用牌組或提示使用者選擇。

替代方案是新增使用者偏好 API，但此偏好只影響單一前端流程，不需要伺服器持久化。

### 5. 前端以 domain/helper 管理候選狀態

新增收藏頁應把 API 回應轉成 view model，並區分：

- 收藏候選：句子、搭配詞、片語、子句。
- 單字候選：可新增、已存在、正在新增、已加入、失敗。

候選狀態與 localStorage 讀寫應放在可測試的 domain/helper 或 store 方法中，而不是散落在 component template。

## Risks / Trade-offs

- AI 仍可能建議太多低價值單字 → prompt 限制只挑「主要單字」與「能支撐候選句/語塊理解」的字，並以前端最多顯示數量保護畫面。
- localStorage 記住的 deck id 可能已刪除或不屬於目前使用者 → 每次開啟牌組選擇時都用 deck list 驗證，無效則清除。
- 新增卡片成功後，原本收藏候選的 `sourceCardIds` 不會自動補上 → 此 change 先只更新單字候選狀態；後續若需要可在保存收藏候選前重新比對使用者單字卡。
- 彈窗內容可能過高 → 快閃卡表單容器需支援內容滾動，並保留底部操作按鈕可點擊。
