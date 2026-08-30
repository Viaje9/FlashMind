# Review 草稿契約

這是 `SpeakingReviewDraft` 第一版的 Agent 寫作指引；正式規則由 CLI 與後端共用的 OpenAPI schema 驗證。不要替草稿增加未定義欄位。

## 本機 CLI 組裝

一般 Review 用 `review prepare` 建立本機資料、`review vocabulary` 核對單字。Agent 只撰寫下方完整範例中的 `result` 物件，再執行 `review update <id> --result <result.json>`；CLI 自動帶入原始 practice、target、contextVersion，無須用 Python／JS 讀取並組裝快照。

本機 `review.json` 是含 context、draft、保存收據的管理資料檔，不是 API payload；不可直接把此檔當作 `review validate <file>` 的輸入。`review validate <id>` 完全離線，核對其中的 draft 與 context；只有 `review save <id>` 傳送符合原契約的 draft，由保存 API 驗證後寫入。明確要匯出完整 API 草稿時可用 `review show <id> --section draft`。直接驗證獨立草稿檔時沒有字庫快照，結果會標示 `draft-only`，不代表已確認單字 ID 或目前帳號。

舊完整草稿用 `review import --file <draft.json>` 納入管理，保留既有 sourceRef。context 版本改變時重新核對 result；只有 `update` 會重新綁定版本，不可手改版本以略過檢查。

## 必要結構

```json
{
  "schemaVersion": 1,
  "target": { "apiOrigin": "https://flashmind.example", "userId": "user-1" },
  "contextVersion": "vocabulary-snapshot-version",
  "practice": {
    "source": "LOCAL",
    "sourceRef": {
      "system": "local-agent",
      "conversationId": "thread-1",
      "sessionKey": "practice-1"
    },
    "title": "週末散步",
    "startedAt": "2026-08-30T10:00:00+08:00",
    "endedAt": "2026-08-30T10:10:00+08:00",
    "range": { "firstMessageId": "u1", "lastMessageId": "a1" },
    "messages": [
      {
        "id": "u1",
        "role": "user",
        "text": "I walk in the park on weekends.",
        "createdAt": "2026-08-30T10:00:00+08:00"
      },
      {
        "id": "a1",
        "role": "assistant",
        "text": "Who do you usually go with?",
        "createdAt": "2026-08-30T10:01:00+08:00"
      }
    ]
  },
  "result": {
    "summary": "I walk in the park on weekends.",
    "review": "### 描述週末習慣\n\n你想說自己週末會去公園散步，原句已自然清楚。\n\n> I walk in the park on weekends.\n\non weekends 表達固定習慣；如果要強調通常如此，可以說 I usually walk in the park on weekends. 不必硬換成較難的單字。",
    "actualUses": [
      {
        "targetVocabularyId": "word-walk",
        "term": "walk",
        "expressionContext": "表達週末散步的習慣",
        "naturalSentence": "I walk in the park on weekends.",
        "evidence": [
          { "messageId": "u1", "quote": "I walk in the park on weekends." }
        ]
      }
    ],
    "recommendations": [],
    "nextPractice": {
      "topic": "Weekend routines",
      "speakingGoal": "Describe a weekend activity",
      "guidingQuestions": ["Where do you usually go?"],
      "recallTargets": ["walk"]
    },
    "deckCandidates": ["word-walk"]
  }
}
```

以上帳號、單字、時間與對話都是虛構範例，不可直接拿去保存。

## 來源與時間

- `target.userId`、`contextVersion` 分別來自最新 context 的 `userId`、`vocabularyVersion`；`apiOrigin` 是本次已確認的 FlashMind API origin，不包含 `/api`。
- `sourceRef` 的三個值共同識別一段練習。同一份對話重新 Review、validate 或 save，都保留同一組值。不能用每次操作的新 UUID 代替來源。
- 有原始 thread／session／訊息 ID 時保留它們。同 thread 多次練習，使用原始開始訊息 ID 作為不同的 `sessionKey`。沒有原始 ID 時，首次依原始逐字稿建立本機快照與固定 ID，之後持續重用；不能在每次重試重新編號。
- `startedAt`、`endedAt`、`createdAt` 使用可查證的 ISO 8601 時間，訊息依原始順序排列，時間不得超出練習範圍。若只有粗略時間，向使用者確認可接受的時間，不以保存當下冒充原始時間。
- `range` 必須對應陣列第一、最後一則訊息；文字保存原文，不能用修正句取代。最多 2000 則、整份請求最多 2 MiB；超限要說明，不能默默截斷。
- 本機來源固定 `LOCAL`；不填 App `sessionId`、不傳音訊或缺字訊息。無法取得完整文字時先補資料。

## 事件、證據與候選

- `actualUses` 必須有 context 中的 `targetVocabularyId`、canonical `term`、繁體中文 `expressionContext`、英文 `naturalSentence` 和 `evidence`。
- `quote` 是原始 user 訊息中的逐字子字串，必須包含獨立的目標詞／詞組；不能引用 assistant、只有相似拼字、同義字或推測字形。第一版採保守匹配，`walking` 不自動等於 `walk`。
- 自然化句子與原始引文分開，`naturalSentence` 仍須包含該目標詞。不改原文去配合證據。
- `recommendations` 每筆包含 `targetVocabularyId`、`term`、`expressionContext`、`naturalSentence`、繁體中文 `recommendationReason`；不包含 `evidence`。推薦必須幫助表達本次談過的意思，不能憑空加入字表外 ID。
- `actualUses` 和 `recommendations` 各自同字最多一筆；同字可以有使用和推薦各一筆。沒有符合項目時保留空陣列，不湊數。
- 四狀態為 `UNSEEN` 待接觸、`PRACTICING` 待練習、`USED` 已使用、`ADDED` 已加入。保存時後端依新事件推進，`USED`／`ADDED` 不倒退；不能直接在草稿指定新狀態或累計次數。
- `deckCandidates` 是本次 `actualUses` 的 ID 子集合，尚未使用的推薦字不可直接列入。通常排除目前已 `ADDED` 的字；候選不表示已建卡。
- `nextPractice.recallTargets` 使用 context 中的 canonical 單字文字，不是 ID。計畫是下次對話背景，不是命令使用者逐項練習的題庫。
