## Context

目前實作可核對的邊界：

- `apps/web/src/app/components/speaking/speaking.repository.ts` 將場次、訊息、音訊都保存在 IndexedDB；設定含 `lastPractice`／`nextPractice` 則使用 localStorage。歷史頁直接讀此 Repository。
- `speaking.store.ts` 在 Summary API 回應後，建立 `role=summary` 的格式化訊息並寫入本機，後端尚無相同的 Speaking 場次模型。
- `apps/api/src/modules/speaking/speaking.service.ts` 的 `summarizeConversation()` 在回傳結果前呼叫 `TargetVocabularyService.applyReview()`，因此目前分析就會改變狀態。
- `target-vocabulary.service.ts` 每次套用 Review 都增加使用／推薦次數，現有模型僅有彙總次數和最近例句，沒有場次層級去重。
- 現有 App 歷史具有查看、複製摘要、繼續及刪除入口。音訊容量清理會連同整場本機紀錄移除，不能原封不動套用到後端 Repository。
- AuthGuard 由 `session` cookie 驗證帳號，受保護 Speaking 操作使用 WhitelistGuard。`packages/api-client` 是 Angular client，不適合直接載入 Node CLI。
- 主題對話模式已有獨立的後端模型與學習規則，本次不與之合併。

本文件將已確認功能落成第一版設計；command、來源種類、儲存確認及音訊本機政策為既定範圍，API 路徑、欄位命名及登入交換方式為實作前可檢視的設計選擇。

## Goals / Non-Goals

**Goals:**

- App 與本機練習共用後端文字歷史，同一帳號可跨裝置回顧。
- 保留本機音訊與安全搬移舊文字；搬移不得製造新的學習事件。
- CLI 提供 context、validate、save 與 login；Agent 分析與使用者確認維持在本機對話流程。
- App／CLI 使用同一個 Review 保存交易，所有重試與狀態變更可核對。
- 以 Contract-First 定義 HTTP 契約，實作前補上資料與安全測試。

**Non-Goals:**

- 音訊雲端同步、通用 ChatGPT／Codex 擷取、自動語音轉文字、CLI 呼叫 AI。
- CLI 建卡、草稿遠端工作區、已保存 Review 修訂與事件重算、全面離線同步引擎。
- 同步所有使用者設定、搬移外部 English Study 網站或直接修改外部／全域 skill。
- 改變 FSRS、主題對話規則及既有文字轉語音用途。

## Decisions

### 1. CLI 放在 apps/cli，共用僅限資料契約與純驗證

`apps/cli` 使用 Node.js／TypeScript，有自身 `package.json`、bin 入口與建置；執行時不依賴 repo 的 cwd。CLI 僅處理參數、檔案、設定、登入交換及 HTTP。後端負責帳號、交易、去重與狀態轉移。

`openapi/api.yaml` 是線上契約來源，所有 endpoint 定義 operationId。在 `packages/shared` 提供無 Angular／Nest 依賴的 Review 型別與純驗證入口；輸入結構由 OpenAPI schema 產生可使用的型別／驗證 schema，不再手動維護另一份同名定義。不能自動生成的證據與狀態規則以純函式補充，API 做最終裁決。

既有 Angular client 維持給 Web 使用。第一版 CLI 使用本身的小型 HTTP adapter 與由同一 OpenAPI 契約產生的無框架型別，不為一個 consumer 另建通用 SDK，也不 import `apps/api` 的 Service。

替代方案：放進 `packages/cli` 技術上可行，但與目前「apps 為可執行入口，packages 為共用程式」分工不一致；直接載入 Angular client 或 Prisma 會帶入不必要 runtime 並繞過後端邊界。

### 2. 後端文字為主，本機只保留音訊、暫存與搬移備份

Web 的文字 Repository 改讀寫 API，另保留本機 Audio Repository。音訊以使用者、穩定場次 ID、訊息 ID 對應，不保存本機路徑到伺服器；雲端最多記錄 `hasOriginalAudio`。原裝置可播放，缺少音訊時顯示不可用。

App 只在轉錄／回覆完成時保存最終訊息，不將每段串流增量當成新訊息。進行中的文字先留在 UI／本機待同步佇列，API 確認後才標示已同步。後端使用穩定訊息 ID、順序與場次 revision，重送不重複，舊 revision 不覆蓋新文字；第一版不處理兩個裝置同時編輯同場的自動合併。

保留現有音訊容量控制，但淘汰機制只能刪音訊，不得呼叫後端場次刪除。所有待同步資料依帳號隔離；登出停止重試，換帳號不能繼續提交前一帳號資料。

替代方案：讓 CLI 寫進瀏覽器 IndexedDB 無法跨裝置；只把 Summary 存後端仍無法回顧原始對話；把音訊一起上傳超出已確認範圍。

### 3. 場次、訊息與 Review 分開保存

建議新增資料責任如下，實際 Prisma 名稱可依慣例調整：

| 模型                    | 主要資料／限制                                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SpeakingSession`       | userId、id、source(APP/LOCAL)、穩定 sourceKey、title、startedAt、endedAt、revision、整理狀態、可核對來源的 legacyPracticeContext；同帳號／來源／sourceKey 唯一 |
| `SpeakingMessage`       | sessionId、clientMessageId、ordinal、role(user/assistant)、text、transcriptStatus、createdAt、translatedText、hasOriginalAudio；場次內 ID／ordinal 唯一        |
| `SpeakingReview`        | sessionId、schemaVersion、contentHash、summary、review、nextPractice、候選、createdAt；第一版每個已完成練習一份確認結果                                        |
| `SpeakingReviewEvent`   | reviewId、targetVocabularyId、type(actual-use/recommendation)、語境、自然例句、推薦理由、使用者訊息引文；Review／單字／type 唯一                               |
| `SpeakingLegacySummary` | sessionId、原 summary 訊息 ID、文字、原時間／順序；可保存同場多則舊 Summary，不猜測結構化事件                                                                  |
| `SpeakingWriteReceipt`  | userId、source、sourceKey、內容指紋、保存結果／刪除標記；保持重試識別，不存原始對話                                                                            |
| `CliLoginAuthorization` | 短期發起端驗證材料雜湊、授權狀態、授權帳號、期限、兌換狀態                                                                                                     |

來源字面值只含 `APP` 與 `LOCAL`，不保存手機／電腦分類。App 可先建立未整理場次；LOCAL 保存必須一次含完整對話與 Review。

本機 sourceKey 由「來源系統、原對話 ID、該場穩定 sessionKey」組成，sessionKey 對應明確的練習範圍，同 thread 多場可分開。不能用當次 CLI 執行時間或每次新 UUID 當唯一來源識別。訊息範圍與時間也存於草稿，改範圍仍需沿用同場識別而觸發衝突，不可靠重建 requestId 加次數。

第一版 Review 保存後視為該次練習完成；既有「繼續」入口可引用原上下文建立新的 `APP` 場次，原歷史／來源不修改。尚未整理的 `APP` 場次維持追加訊息。這個預設避免在同一份已確認 Review 上覆寫或重算已使用次數；入口文案須明示為延續的新練習。

替代方案：單一 JSON blob 雖便於匯入，但不利於 App 逐訊息保存、證據關聯與去重；只存彙總次數則無法核對這場 Review 為何修改狀態。

### 4. Practice context 是完整唯讀快照

新增 `GET /speaking/practice-context`，在一致的 DB 讀取快照中取得完整字表與最近有效已整理練習，回傳：

- `schemaVersion`、`userId`、`generatedAt`、`vocabularyVersion`、`vocabularyCount`。
- `targetVocabulary[]`：id、term、zhMeaning、status、useCount、recommendationCount、expressionContext、naturalSentence、recommendationReason、addedCardId。
- `lastPractice`：場次 ID、來源、練習時間、title、summary；沒有則 null。
- `nextPractice`：topic、speakingGoal、guidingQuestions、recallTargets；沒有則 null。

第一版直接回傳目前字表完整快照，避免讓 Agent 自行循環 cursor 而漏頁；設置明確回應上限，超限失敗而非截斷。未來資料量需要分頁時，再加入快照游標，CLI 仍須輸出完整 JSON。

最新計畫從最近「練習結束時間」的有效已整理場次推導，以場次 ID 作同時間排序；不要在每次匯入時盲目覆寫 User 上的一份 summary。舊資料補匯入、搬移或晚到重試不會使計畫倒退。搬移場次可用原 LegacySummary 作最近摘要；只有可證實關聯的 legacyPracticeContext 才提供下一次計畫，不能把另一場較舊計畫假裝成最新場次的建議。

Review skill 可以沿用 Practice 的快照，也可以獨立呼叫相同 command 取得目前資料。context 是背景資訊而非授權或使用證據，取得它不建立任何學習事件。

### 5. Review 草稿是一份可驗證、可保存的檔案

第一版核心形狀如下，正式欄位以 OpenAPI schema 定義；這是契約示意，不是已存在 API：

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
    "review": "你用完整句子表達了週末散步的習慣。",
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

JSON 中的帳號／環境只用於防誤送，後端仍從 session 判斷擁有者。CLI 只向本機已配置且與草稿匹配的 API 送出資料，絕不根據檔案內 URL 自動改目的地。API 對未知欄位採拒絕，尤其不接受音訊、`userId` 代操作、直接指定 status／次數等欄位。

Array 順序代表對話順序；訊息 ID 與引文是可核對的證據。一般外部 Review 必須有實際文字與可靠場次時間，時間不明時由 Agent 先確認，不補假值。舊音訊缺字只走專用搬移契約的 `transcriptStatus=unavailable`，不能變成新 Review 的使用證據。

同一字可以各有一筆使用與推薦，不能同 type 重複。`deckCandidates` 只能引用本次 actualUses 的合法字詞且不得冒充已建卡；後端保存「當時候選」，App 顯示時另讀目前狀態，以免已加入後仍顯示可重複加入。

### 6. validate 與 save 使用相同驗證但不同副作用

`review validate`：讀一次檔案，執行本機結構驗證，呼叫唯讀驗證 API 核對帳號／字表／引文／來源／時間／候選，回傳 `valid`、`contentHash`、`errors[{path,code,message}]`、warnings。不上傳持久草稿，不記錄原始 payload 日誌。

這個「唯讀」表示不改變學習紀錄；伺服器記憶體處理草稿是線上字表核對所需，因此文件須說明驗證會傳輸草稿文字，但不保存草稿、不呼叫 AI。

`review save`：使用該次讀檔的不可變快照，做相同驗證後送出保存，由後端再次核對並以交易執行。與已保存 sourceKey 比對時，先判斷相同內容是否已成功保存，再判斷目前候選資格，避免重試遇到單字已加入而被誤判成新請求失敗。

技術驗證能證明欄位、目標歸屬、引文在 user 文字中及獨立詞匹配，不能證明整段語意一定屬於真實運用；這部分由 Agent 的 Review 規則與使用者審閱負責。第一版延續目前 FlashMind 提示詞的保守規則，並新增目前程式尚未具備的確定性檢查：大小寫與 Unicode 正規化後需為相同獨立詞／片語，不能以 substring 或同義字認定。字形表尚未成為後端契約，暫不把 `practiced` 自動算為 `practice`；不確定者回報驗證問題，由 Agent 移至推薦或修正證據。後續字形支援須獨立明訂，不把外部 skill 的字表默默搬進此 change。

context 過時時，不一律拒絕所有狀態變動：字仍有效且只是已推進為 ADDED 時保留目前狀態並追加事件；字已刪除、帳號／環境不同或語意所依賴的 term 已改變則拒絕，要求更新草稿重新 Review。不得靜默重寫已確認的自然句或推薦。

Skill 規約是「明確儲存授權」的執行邊界，CLI 的 save 呼叫本身代表使用者／Agent 有意寫入；CLI 無法從 JSON 證明人類真的看過對話，不新增虛假的 `approved=true` 安全保證。需在整合文件與操作紀錄清楚描述此限制。

### 7. 保存交易與防重優先於彙總次數

交易順序：

1. 由 session 確定 userId，核對來源識別、目標環境及 payload hash。
2. 以 `(userId, source, sourceKey)` 的唯一限制取得／建立寫入識別；相同內容已保存則回傳原結果，內容不同回 409。
3. 核對場次訊息與目標字表最新資料，建立本機場次／訊息或引用已保存 App 場次。
4. 保存 Review 與唯一單字事件；只對新事件增量套用 count 與狀態。
5. 寫入完成結果後提交；任一步失敗全部回滾。

`TargetVocabularyService` 需允許在呼叫方交易內套用 Review，不再自行建立與 Review 分離的另一個交易。資料庫唯一限制處理同時送出，不能僅用先查再新增的程式檢查。對來源識別及 schema-normalized JSON 計算指紋，忽略 JSON 排版與 object key 順序，保留訊息陣列順序與全部語意欄位。

狀態規則：推薦只推進 UNSEEN → PRACTICING；實際使用推進 UNSEEN／PRACTICING → USED；USED 與 ADDED 不降級。同場同字同 type 一次，加入牌組和 FSRS 完全不在此交易內。補匯入舊事件可增加累積次數，但最近語境／自然例句依事件練習時間更新，不能讓舊資料覆寫更新的例句。

第一版已保存 Review 不可覆寫，內容不同回 409；避免在沒有完整撤銷／重算規則前加入 `--force`。歷史刪除保留不含文字的 receipt 防止舊重試復活，移除可回顧文字、Review 及其詳細證據，但不回溯修改原有單字彙總或卡片；原有 reject-use 操作另有自己的語意，本次不把歷史刪除當成它。

替代方案：只加 requestId 防重無法阻止 Agent 每次生成新 ID；只包單字交易仍可能留下有 Review 沒更新單字的半成品；用上次 context 的 status 覆寫會使跨裝置已加入狀態倒退。

### 8. API 表面與 App Summary 切換

以下路徑均由既有 `/api` prefix 提供；在 OpenAPI 完整定義 Wrapper、錯誤、operationId、認證及分頁。正式實作需先完成契約，再生成 client。

| Method／路徑                            | operationId                     | 行為                                             |
| --------------------------------------- | ------------------------------- | ------------------------------------------------ |
| GET `/speaking/sessions`                | `listSpeakingSessions`          | 練習時間排序的 cursor 列表                       |
| POST `/speaking/sessions`               | `createSpeakingSession`         | 建立 APP 未整理場次；穩定 client ID 防重         |
| GET `/speaking/sessions/{id}`           | `getSpeakingSession`            | 場次、Review 與訊息分頁資訊                      |
| GET `/speaking/sessions/{id}/messages`  | `listSpeakingMessages`          | 按 ordinal 取得完整對話的後續頁                  |
| POST `/speaking/sessions/{id}/messages` | `appendSpeakingMessages`        | 已完成文字批次，client ID／revision 防重與防過期 |
| DELETE `/speaking/sessions/{id}`        | `deleteSpeakingSession`         | 經 App 確認後刪除，保留去重 receipt              |
| GET `/speaking/practice-context`        | `getSpeakingPracticeContext`    | 完整唯讀學習快照                                 |
| POST `/speaking/reviews/validate`       | `validateSpeakingReview`        | 不落地的草稿驗證                                 |
| POST `/speaking/reviews`                | `saveSpeakingReview`            | 原子保存；APP 引用已保存訊息，LOCAL 可含新場次   |
| POST `/speaking/history-migrations`     | `migrateSpeakingHistory`        | 小批次逐場搬移與映射／衝突結果                   |
| POST `/speaking/summarize`              | `summarizeSpeakingConversation` | 既有 AI 分析，改成無學習資料寫入；加入證據欄位   |

驗證回傳 200 且包含 valid=false／欄位錯誤；無法解析 HTTP JSON 則 400。保存 schema 錯誤回 400、商業驗證不符回 422、內容或 revision 衝突回 409。未登入 401、白名單 403、他人資源 404。首次成功建立回 201，相同內容重試回 200，DELETE 成功回 204。設定訊息筆數與 body 限制（第一版建議 2 MiB、每場 2,000 則；超限明確拒絕，不截斷），不沿用全站 2 GiB 作為文字匯入的實際上限。

App Summary 先同步已完成文字，固定這次 practice/sourceKey 和輸入 revision，再呼叫分析並保存。按原 Summary 按鈕可視為 App 使用者要求整理與保存，不新增本機對話確認要求。分析成功但保存失敗時保留同一份結果供重試，不再次呼叫 AI 得到不同 hash。

切換時需要一併移除舊 `summarizeConversation()` 的 applyReview。不得讓舊 API 分析加一次、新保存再加一次。舊 PWA 頁面呼叫分析可取得結果但不再改單字；前端版本更新須提示重新載入，不能宣稱舊頁面仍能完整同步。

### 9. CLI login 使用瀏覽器授權與既有 session

預設採瀏覽器登入授權，避免第一版只支援密碼帳號而讓 Google 登入使用者無法使用。流程由 CLI 發起短期授權，瀏覽器沿用既有 Email／Google 登入，顯示帳號、環境與一次性配對提示；使用者確認後，僅發起 CLI 可兌換新的 session cookie。

新增三個窄範圍 API：建立授權 `createCliLoginAuthorization`、瀏覽器確認 `approveCliLoginAuthorization`、發起端查詢／兌換 `exchangeCliLoginAuthorization`。公開授權 ID 與私密 verifier 分離，後端只存 verifier 的雜湊；私密材料不放 URL、stdout、命令列參數或日誌。有效期建議 5 分鐘，兌換原子且一次有效；回應遺失時重新 login，不重用已兌換授權。瀏覽器確認須有 session、可信 Origin 與 CSRF 防護，建立／查詢限流，回應 no-store。

CLI 使用明確配置的 API origin，正式環境只允許 HTTPS；本機 loopback 開發可用 HTTP。憑證置於使用者設定目錄，目錄 0700、檔案 0600、依 origin 隔離，僅保存 session 與期限，不保存密碼。不向不同 origin 的 redirect 轉送 Cookie。錯誤／輸出隱藏所有機密，context 與草稿只帶帳號、環境識別。

這是可審閱的登入設計選擇，並非使用者已決定新增長期 API key。替代方案：直接使用 Email/password 實作較小但不涵蓋 Google-only；手動貼上瀏覽器 cookie 容易外洩且不適合 Agent；建立全新 PAT／scope 體系超出第一版需求。

### 10. App 搬移採逐場交易並保留備份

搬移入口顯示目前帳號、未搬移筆數與可選紀錄。舊 IndexedDB 沒有 userId，不能自動判定歸屬；須由使用者確認，並把選擇與成功映射依帳號保存。

每場使用舊 conversation.id 作穩定來源，保留原時間與訊息 ID；`role=summary` 保存在 LegacySummary，不靠字串剖析偽造事件。多個舊 Summary 原樣保留，沒有字詞事件就不新增。缺逐字稿的 audio-only 訊息保存缺漏標記，音訊仍留本機。翻譯文字與既有 usage 等必要非音訊資料可保留，但不重新計費或判斷使用。

後端逐場交易回報 imported／alreadyImported／conflict／failed 及 ID 映射。App 只有取得成功結果才標記已搬移，失敗可重試；所有舊文字保留備份，不自動清空 IndexedDB。列表以後端為主，另顯示未搬移／未同步項目，不重複列兩份成功資料。

`lastPractice`／`nextPractice` 只有在可唯一對應至舊場次、且不覆蓋更新計畫時才搬入；無法證實來源的設定留在本機。搬移完全繞過 AI 與單字事件套用，線上既有 useCount／recommendationCount 原值維持。

## Risks / Trade-offs

- [舊瀏覽器資料未分帳號] → 使用者選擇與確認歸屬，搬移映射分帳號，不登入即搬。
- [Agent 提供的「完整對話」本身可能缺漏] → 要求明確來源／範圍，保留原文與證據；工具不宣稱能驗證外部平台真實性。
- [驗證草稿也會把文字送到 API] → 明示傳輸但不保存，禁寫 payload 日誌；未獲儲存授權時只有本機草稿持久化。
- [App／CLI 的 context 同時變動] → 保存時用最新權限／字表／狀態驗證；不降級，必要時拒絕，不改寫草稿。
- [本機音訊可能被清除] → UI 明確不可用，文字永不連帶刪除；不承諾跨裝置原音播放。
- [目前 App 詞形規則與外部 skill 不同] → 第一版維持保守匹配並回報，不靜默擴大已使用範圍；字形表支援另議。
- [舊 PWA 仍走舊 Summary 前端] → 同步部署並提示更新，舊分析停止副作用；驗證混合版本不重算。
- [一次完整 context／對話太大] → 明確 byte／筆數限制、可核對總數，拒絕超限，不靜默截斷。
- [重新產生已保存 Review 的需求] → 第一版相同內容去重、不同內容拒絕；不提供 force 覆寫，後續另訂撤銷／重算。
- [刪除歷史後仍保留單字累積] → 維持既有歷史刪除與學習狀態分離語意，提示不撤銷單字；只留最小去重 receipt。

## Migration Plan

1. 先完成 OpenAPI 與 schema，補上契約、Service／Domain Red 測試；新增向後相容資料表，不動既有 TargetVocabulary 次數。
2. 部署新歷史、context、Review 驗證／保存及 CLI 授權 API；驗證 userId 隔離與交易防重。
3. 原子協調後端 Summary 副作用移除與新版 Web 使用保存流程，保留原逐字稿／播放回歸；在入口提供舊前端更新提示。
4. 新 App 使用後端文字歷史，保留音訊與待同步佇列；提供手動搬移，先在受控測試資料確認重試、衝突與回顧一致性，再由使用者執行正式搬移。
5. 提供 CLI 的本機安裝／連結指引、四個命令及 skill 整合範例。用測試帳號完成「context → Agent 範例草稿 → validate → save → App 歷史」驗收。
6. 回滾先停用新寫入入口、保留新表及 receipts，不逆向刪除用戶歷史或清零次數。不回滾到會再次 applyReview 的舊 Summary 行為；必要時只提供唯讀歷史與本機備份，待修復後重試。

## Open Questions

以下為實作前可調整的設計預設，不阻擋先產生需求文件：

- CLI 安裝先提供本機 workspace 建置／連結，是否另發佈套件尚未要求，先不包含發佈任務。
- 瀏覽器登入授權頁及新場次「延續練習」文案需與既有 UI 對齊；授權採上述短期交換預設，不要求使用者提供密碼給 Agent。
- 字形對應第一版不新增規則；若要讓外部 skill 的 `word-forms.json` 行為也適用 App，另訂共用且可驗證的字形契約。
- 本 change 提供整合文件；既有外部 Practice／Review skill 的實際更新時機與是否繼續寫 English Study 檔案，由後續獨立工作決定。

### 實作補充：跨分頁帳號防護

建立場次、追加訊息、舊資料搬移與 CLI 授權確認的 request 帶入 `expectedUserId`。此值必須與伺服器驗證 session 得到的 userId 相同；不符即以 403 `ACCOUNT_CHANGED` 拒絕，不能只依賴前端快取的登入狀態。Review 沿用草稿 `target.userId` 的同等檢查。此欄位不代表權限來源，真正權限仍由 session 與白名單決定。
